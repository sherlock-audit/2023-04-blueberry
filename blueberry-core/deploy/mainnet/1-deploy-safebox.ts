import { BigNumber } from 'ethers';
import fs from 'fs';
import { ethers, network, upgrades } from "hardhat";
import { ADDRESS } from '../../constant';
import { AggregatorOracle, BandAdapterOracle, ChainlinkAdapterOracle, CoreOracle, UniswapV3AdapterOracle } from '../../typechain-types';

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

	// // Deploy Config
	// const Config = await ethers.getContractFactory("ProtocolConfig");
	// const config = await upgrades.deployProxy(Config, ["0xE4D701c6E3bFbA3e50D1045A3cef4797b6165119"])
	// await config.deployed();
	// console.log("ProtocolConfig deployed at:", config.address);
	// deployment.ProtocolConfig = config.address;
	// writeDeployments(deployment);

	const SafeBox = await ethers.getContractFactory("SafeBox");

	// Deploy USDC Safebox
	const safeBox = await upgrades.deployProxy(SafeBox, [
		deployment.ProtocolConfig,
		ADDRESS.bWETH,
		"Interest Bearing WETH",
		"ibWETH",
	])
	await safeBox.deployed();
	console.log(safeBox.address);
	deployment.SafeBox_WETH = safeBox.address;
	writeDeployments(deployment);
}

main()
	.then(() => process.exit(0))
	.catch((error: Error) => {
		console.error(error);
		process.exit(1);
	});
