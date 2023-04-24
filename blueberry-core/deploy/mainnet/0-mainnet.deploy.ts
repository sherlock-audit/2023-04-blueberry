import { BigNumber } from 'ethers';
import { ethers, upgrades } from 'hardhat';
import { ADDRESS, CONTRACT_NAMES } from '../../constant';
import { AggregatorOracle, BandAdapterOracle, BlueBerryBank, ChainlinkAdapterOracle, CoreOracle, IchiVaultOracle, IchiSpell, ProtocolConfig, UniswapV3AdapterOracle, WERC20, WIchiFarm } from '../../typechain-types';

async function main(): Promise<void> {
	const [deployer] = await ethers.getSigners();

	// Band Adapter Oracle
	const BandAdapterOracle = await ethers.getContractFactory(CONTRACT_NAMES.BandAdapterOracle);
	const bandOracle = <BandAdapterOracle>await BandAdapterOracle.deploy(ADDRESS.BandStdRef);
	await bandOracle.deployed();
	console.log("Band Oracle Address:", bandOracle.address);

	console.log('Setting up USDC config on Band Oracle\nMax Delay Times: 11100s, Symbol: USDC');
	await bandOracle.setMaxDelayTimes([ADDRESS.USDC], [11100]);
	await bandOracle.setSymbols([ADDRESS.USDC], ['USDC']);

	// Chainlink Adapter Oracle
	const ChainlinkAdapterOracle = await ethers.getContractFactory(CONTRACT_NAMES.ChainlinkAdapterOracle);
	const chainlinkOracle = <ChainlinkAdapterOracle>await ChainlinkAdapterOracle.deploy(ADDRESS.ChainlinkRegistry);
	await chainlinkOracle.deployed();
	console.log('Chainlink Oracle Address:', chainlinkOracle.address);

	console.log('Setting up USDC config on Chainlink Oracle\nMax Delay Times: 129900s');
	await chainlinkOracle.setMaxDelayTimes([ADDRESS.USDC], [129900]);

	// Aggregator Oracle
	const AggregatorOracle = await ethers.getContractFactory(CONTRACT_NAMES.AggregatorOracle);
	const aggregatorOracle = <AggregatorOracle>await AggregatorOracle.deploy();
	await aggregatorOracle.deployed();
	console.log('Aggregator Oracle Address:', aggregatorOracle.address);

	await aggregatorOracle.setPrimarySources(
		ADDRESS.USDC,
		BigNumber.from(10).pow(16).mul(105), // 5%
		[bandOracle.address, chainlinkOracle.address]
	);

	// Uni V3 Adapter Oracle
	const UniswapV3AdapterOracle = await ethers.getContractFactory(CONTRACT_NAMES.UniswapV3AdapterOracle);
	const uniV3Oracle = <UniswapV3AdapterOracle>await UniswapV3AdapterOracle.deploy(aggregatorOracle.address);
	await uniV3Oracle.deployed();
	console.log('Uni V3 Oracle Address:', uniV3Oracle.address);

	await uniV3Oracle.setStablePools([ADDRESS.ICHI], [ADDRESS.UNI_V3_ICHI_USDC]);
	await uniV3Oracle.setMaxDelayTimes([ADDRESS.ICHI], [10]); // 10s ago

	// Core Oracle
	const CoreOracle = await ethers.getContractFactory(CONTRACT_NAMES.CoreOracle);
	const coreOracle = <CoreOracle>await CoreOracle.deploy();
	await coreOracle.deployed();
	console.log('Core Oracle Address:', coreOracle.address);

	await coreOracle.setRoute(
		[ADDRESS.USDC, ADDRESS.ICHI],
		[aggregatorOracle.address, uniV3Oracle.address]
	);

	// Ichi Lp Oracle
	const IchiVaultOracle = await ethers.getContractFactory(CONTRACT_NAMES.IchiVaultOracle);
	const ichiVaultOracle = <IchiVaultOracle>await IchiVaultOracle.deploy(coreOracle.address);
	await ichiVaultOracle.deployed();
	console.log('Ichi Lp Oracle Address:', ichiVaultOracle.address);

	await coreOracle.setRoute(
		[ADDRESS.ICHI_VAULT_USDC],
		[ichiVaultOracle.address]
	);

	// Bank
	const Config = await ethers.getContractFactory("ProtocolConfig");
	const config = <ProtocolConfig>await upgrades.deployProxy(Config, [deployer]);
	await config.deployed();

	const BlueBerryBank = await ethers.getContractFactory(CONTRACT_NAMES.BlueBerryBank);
	const bank = <BlueBerryBank>await upgrades.deployProxy(BlueBerryBank, [coreOracle.address, config.address, 2000]);
	await bank.deployed();

	// WERC20 of Ichi Vault Lp
	const WERC20 = await ethers.getContractFactory(CONTRACT_NAMES.WERC20);
	const werc20 = <WERC20>await WERC20.deploy();
	await werc20.deployed();

	// WIchiFarm
	const WIchiFarm = await ethers.getContractFactory(CONTRACT_NAMES.WIchiFarm);
	const wichiFarm = <WIchiFarm>await upgrades.deployProxy(WIchiFarm, [ADDRESS.ICHI, ADDRESS.ICHI_FARMING]);
	await wichiFarm.deployed();

	// Ichi Vault Spell
	const IchiSpell = await ethers.getContractFactory(CONTRACT_NAMES.IchiSpell);
	const ichiSpell = <IchiSpell>await IchiSpell.deploy(
		bank.address,
		werc20.address,
		ADDRESS.WETH,
		wichiFarm.address
	)
	await ichiSpell.deployed();
}

main()
	.then(() => process.exit(0))
	.catch((error: Error) => {
		console.error(error);
		process.exit(1);
	});
