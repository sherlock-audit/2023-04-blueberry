import { ethers, upgrades } from "hardhat";
import { CONTRACT_NAMES } from "../../constant";
import { deployment, writeDeployments } from '../../utils';

async function main(): Promise<void> {
	const [deployer] = await ethers.getSigners();
	console.log("Deployer:", deployer.address);

	const BlueBerryBank = await ethers.getContractFactory(CONTRACT_NAMES.BlueBerryBank);
	const bank = await upgrades.deployProxy(BlueBerryBank, [
		deployment.CoreOracle,
		deployment.ProtocolConfig
	]);
	await bank.deployed();
	console.log("Bank Deployed:", bank.address);
	deployment.BlueBerryBank = bank.address;
	writeDeployments(deployment);
}

main()
	.then(() => process.exit(0))
	.catch((error: Error) => {
		console.error(error);
		process.exit(1);
	});
