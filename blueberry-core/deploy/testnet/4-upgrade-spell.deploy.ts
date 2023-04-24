import { ethers, upgrades } from "hardhat";
import { ADDRESS_GOERLI, CONTRACT_NAMES } from "../../constant";
import { IchiSpell } from "../../typechain-types";
import { deployment, writeDeployments } from '../../utils';

async function main(): Promise<void> {
	const [deployer] = await ethers.getSigners();
	console.log("Deployer:", deployer.address);

	const IchiSpell = await ethers.getContractFactory(CONTRACT_NAMES.IchiSpell);
	const spell = <IchiSpell>await upgrades.deployProxy(IchiSpell, [
		deployment.BlueBerryBank,
		deployment.WERC20,
		ADDRESS_GOERLI.WETH,
		deployment.WIchiFarm
	])
	await spell.deployed();
	console.log("Ichi Vault Spell Deployed:", spell.address);
	deployment.IchiSpell = spell.address;
	writeDeployments(deployment)
}

main()
	.then(() => process.exit(0))
	.catch((error: Error) => {
		console.error(error);
		process.exit(1);
	});
