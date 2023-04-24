import fs from 'fs';
import { BigNumber, utils } from 'ethers';
import { ethers, upgrades, network } from 'hardhat';
import { ADDRESS_GOERLI, CONTRACT_NAMES } from '../../constant';
import SpellABI from '../../abi/IchiSpell.json';
import { AggregatorOracle, BlueBerryBank, ChainlinkAdapterOracle, CoreOracle, IchiVaultOracle, IchiSpell, IICHIVault, MockFeedRegistry, MockIchiFarm, MockIchiVault, ProtocolConfig, UniswapV3AdapterOracle, WERC20, WIchiFarm } from '../../typechain-types';

const deploymentPath = "./deployments";
const deploymentFilePath = `${deploymentPath}/${network.name}.json`;

function writeDeployments(deployment: any) {
	if (!fs.existsSync(deploymentPath)) {
		fs.mkdirSync(deploymentPath);
	}
	fs.writeFileSync(deploymentFilePath, JSON.stringify(deployment, null, 2));
}

async function main(): Promise<void> {
	const deployment = fs.existsSync(deploymentFilePath)
		? JSON.parse(fs.readFileSync(deploymentFilePath).toString())
		: {};

	const [deployer] = await ethers.getSigners();
	console.log("Deployer:", deployer.address);

	// Deploy Mock ICHI contracts
	const MockERC20 = await ethers.getContractFactory("MockERC20");
	const ichiV1 = await MockERC20.deploy("ICHI.Farm", "ICHI", 9);
	await ichiV1.deployed();
	deployment.MockIchiV1 = ichiV1.address;
	writeDeployments(deployment);

	const MockIchiV2 = await ethers.getContractFactory("MockIchiV2");
	const ichiV2 = await MockIchiV2.deploy(deployment.MockIchiV1);
	await ichiV2.deployed();

	deployment.MockIchiV2 = ichiV2.address;
	writeDeployments(deployment);

	// Deploy Mock USDC
	const mockUSDC = await MockERC20.deploy("Mock USDC", "USDC", 6);
	await mockUSDC.deployed();

	deployment.MockUSDC = mockUSDC.address;
	writeDeployments(deployment);

	// Chainlink Adapter Oracle
	const MockFeedRegistry = await ethers.getContractFactory(CONTRACT_NAMES.MockFeedRegistry);
	const feedRegistry = <MockFeedRegistry>await MockFeedRegistry.deploy();
	await feedRegistry.deployed();
	console.log('Chainlink Feed Registry:', feedRegistry.address);

	deployment.MockFeedRegistry = feedRegistry.address;
	writeDeployments(deployment);

	await feedRegistry.setFeed(
		deployment.MockUSDC,
		ADDRESS_GOERLI.CHAINLINK_USD,
		'0xAb5c49580294Aff77670F839ea425f5b78ab3Ae7' // USDC/USD Data Feed
	);

	const ChainlinkAdapterOracle = await ethers.getContractFactory(CONTRACT_NAMES.ChainlinkAdapterOracle);
	const chainlinkOracle = <ChainlinkAdapterOracle>await ChainlinkAdapterOracle.deploy(feedRegistry.address);
	await chainlinkOracle.deployed();
	console.log('Chainlink Oracle Address:', chainlinkOracle.address);
	deployment.ChainlinkAdapterOracle = chainlinkOracle.address;
	writeDeployments(deployment);

	console.log('Setting up USDC config on Chainlink Oracle\nMax Delay Times: 129900s');
	await chainlinkOracle.setMaxDelayTimes([deployment.MockUSDC], [129900]);

	// Aggregator Oracle
	const AggregatorOracle = await ethers.getContractFactory(CONTRACT_NAMES.AggregatorOracle);
	const aggregatorOracle = <AggregatorOracle>await AggregatorOracle.deploy();
	await aggregatorOracle.deployed();
	console.log('Aggregator Oracle Address:', aggregatorOracle.address);
	deployment.AggregatorOracle = aggregatorOracle.address;
	writeDeployments(deployment);

	await aggregatorOracle.setPrimarySources(
		deployment.MockUSDC,
		BigNumber.from(10).pow(16).mul(105), // 5%
		[chainlinkOracle.address]
	);

	// Uni V3 Adapter Oracle
	const UniswapV3AdapterOracle = await ethers.getContractFactory(CONTRACT_NAMES.UniswapV3AdapterOracle);
	const uniV3Oracle = <UniswapV3AdapterOracle>await UniswapV3AdapterOracle.deploy(aggregatorOracle.address);
	await uniV3Oracle.deployed();
	console.log('Uni V3 Oracle Address:', uniV3Oracle.address);
	deployment.UniswapV3AdapterOracle = uniV3Oracle.address;
	writeDeployments(deployment);

	await uniV3Oracle.setStablePools([deployment.MockIchiV2], [ADDRESS_GOERLI.UNI_V3_ICHI_USDC]);
	await uniV3Oracle.setMaxDelayTimes([deployment.MockIchiV2], [10]); // 10s ago

	// Core Oracle
	const CoreOracle = await ethers.getContractFactory(CONTRACT_NAMES.CoreOracle);
	const coreOracle = <CoreOracle>await CoreOracle.deploy();
	await coreOracle.deployed();
	console.log('Core Oracle Address:', coreOracle.address);
	deployment.CoreOracle = coreOracle.address;
	writeDeployments(deployment);

	// Ichi Lp Oracle
	const IchiVaultOracle = await ethers.getContractFactory(CONTRACT_NAMES.IchiVaultOracle);
	const ichiVaultOracle = <IchiVaultOracle>await IchiVaultOracle.deploy(deployment.CoreOracle);
	await ichiVaultOracle.deployed();
	console.log('Ichi Lp Oracle Address:', ichiVaultOracle.address);
	deployment.IchiVaultOracle = ichiVaultOracle.address;
	writeDeployments(deployment);

	// Config, set deployer addresss as treasury wallet in default
	const Config = await ethers.getContractFactory("ProtocolConfig");
	const config = <ProtocolConfig>await upgrades.deployProxy(Config, [deployer.address]);
	await config.deployed();
	console.log('Config Address:', config.address);
	deployment.ProtocolConfig = config.address;
	writeDeployments(deployment);

	// Bank
	const Bank = await ethers.getContractFactory(CONTRACT_NAMES.BlueBerryBank);
	const bank = <BlueBerryBank>await upgrades.deployProxy(Bank, [
		deployment.CoreOracle, deployment.ProtocolConfig, 2000
	])
	console.log('Bank:', bank.address);
	deployment.BlueBerryBank = bank.address;
	writeDeployments(deployment);

	// WERC20 of Ichi Vault Lp
	const WERC20 = await ethers.getContractFactory(CONTRACT_NAMES.WERC20);
	const werc20 = <WERC20>await upgrades.deployProxy(WERC20);
	await werc20.deployed();
	console.log('WERC20:', werc20.address);
	deployment.WERC20 = werc20.address;
	writeDeployments(deployment);

	// MockIchiFarm
	const MockIchiFarm = await ethers.getContractFactory("MockIchiFarm");
	const ichiFarm = <MockIchiFarm>await MockIchiFarm.deploy(
		deployment.MockIchiV1,
		utils.parseUnits("1", 9), // 1 ICHI per block
	)
	await ichiFarm.deployed();
	console.log("Mock ICHI Farm:", ichiFarm.address);
	deployment.MockIchiFarm = ichiFarm.address;
	writeDeployments(deployment);

	// WIchiFarm
	const WIchiFarm = await ethers.getContractFactory(CONTRACT_NAMES.WIchiFarm);
	const wichiFarm = <WIchiFarm>await upgrades.deployProxy(WIchiFarm, [
		deployment.MockIchiV2, deployment.MockIchiFarm
	]);
	await wichiFarm.deployed();
	console.log('WIchiFarm:', wichiFarm.address);
	deployment.WIchiFarm = wichiFarm.address;
	writeDeployments(deployment);

	// Mock ICHI Angel Vault
	const MockIchiVault = await ethers.getContractFactory("MockIchiVault");
	const ichiVaultUSDC = <MockIchiVault>await MockIchiVault.deploy(
		"0x0167ab6BA8ef6a8964aa9DFD5364090C8162AD8D",
		deployment.MockIchiV2,
		deployment.MockUSDC,
		deployer.address,
		deployer.address, // factory address
		3600
	);
	await ichiVaultUSDC.deployed();
	console.log('Mock Ichi Vault:', ichiVaultUSDC.address);
	deployment.MockIchiVault = ichiVaultUSDC.address;
	writeDeployments(deployment);

	await coreOracle.setWhitelistERC1155(
		[deployment.WERC20, deployment.MockIchiVault],
		true
	);
	await coreOracle.setTokenSettings(
		[deployment.MockIchiV2, ADDRESS_GOERLI.MockUSDC, deployment.MockIchiVault],
		[{
			liqThreshold: 8000,
			route: deployment.UniswapV3AdapterOracle,
		}, {
			liqThreshold: 9000,
			route: deployment.AggregatorOracle,
		}, {
			liqThreshold: 10000,
			route: deployment.IchiVaultOracle,
		}]
	)

	// Ichi Vault Spell
	const IchiSpell = await ethers.getContractFactory(CONTRACT_NAMES.IchiSpell);
	const ichiSpell = <IchiSpell>await upgrades.deployProxy(IchiSpell, [
		deployment.BlueBerryBank,
		deployment.WERC20,
		ADDRESS_GOERLI.WETH,
		deployment.WIchiFarm
	])
	await ichiSpell.deployed();
	console.log('Ichi Spell:', ichiSpell.address);
	await ichiSpell.addVault(deployment.MockUSDC, deployment.MockIchiVault);
	deployment.IchiSpell = ichiSpell.address;
	writeDeployments(deployment);

	await bank.whitelistSpells([deployment.IchiSpell], [true]);

	// SafeBox
	const SafeBox = await ethers.getContractFactory(CONTRACT_NAMES.SoftVault);
	const safeBox = <SafeBox>await upgrades.deployProxy(SafeBox, [
		ADDRESS_GOERLI.bUSDC,
		"Interest Bearing USDC",
		"ibUSDC"
	]);
	await safeBox.deployed();
	console.log('SafeBox:', safeBox.address);
	deployment.USDC_SafeBox = safeBox.address;
	writeDeployments(deployment);

	// Add Bank
	await bank.whitelistTokens([deployment.MockUSDC], [true])
	await bank.addBank(
		deployment.MockUSDC,
		ADDRESS_GOERLI.bUSDC,
		deployment.USDC_SafeBox
	)
}

main()
	.then(() => process.exit(0))
	.catch((error: Error) => {
		console.error(error);
		process.exit(1);
	});
