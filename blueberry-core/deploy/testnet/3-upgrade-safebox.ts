import fs from 'fs';
import { ethers, network, upgrades } from "hardhat";
import { SafeBox } from "../../typechain-types";

const deploymentPath = "./deployments";
const deploymentFilePath = `${deploymentPath}/${network.name}.json`;

async function main(): Promise<void> {
	const deployment = fs.existsSync(deploymentFilePath)
		? JSON.parse(fs.readFileSync(deploymentFilePath).toString())
		: {};

	const [deployer] = await ethers.getSigners();
	console.log("Deployer:", deployer.address);

	// SafeBox
	const SafeBox = await ethers.getContractFactory("SafeBox");
	let safeBox = <SafeBox>await upgrades.upgradeProxy(deployment.USDC_SafeBox, SafeBox);
	await safeBox.deployed();

	safeBox = <SafeBox>await upgrades.upgradeProxy(deployment.ICHI_SafeBox, SafeBox);
	await safeBox.deployed();
}

main()
	.then(() => process.exit(0))
	.catch((error: Error) => {
		console.error(error);
		process.exit(1);
	});
