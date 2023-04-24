import { utils } from 'ethers';
import { ethers } from "hardhat";
import { ADDRESS_GOERLI, CONTRACT_NAMES } from "../../constant";
import { ERC20, MockIchiVault } from "../../typechain-types";
import { deployment, writeDeployments } from '../../utils';

async function main(): Promise<void> {
	const [deployer] = await ethers.getSigners();
	console.log("Deployer:", deployer.address);

	// const usdc = <ERC20>await ethers.getContractAt("ERC20", ADDRESS_GOERLI.MockUSDC);
	// const blb = <ERC20>await ethers.getContractAt("ERC20", ADDRESS_GOERLI.BLB);
	// const ichiVault = <MockIchiVault>await ethers.getContractAt("MockIchiVault", ADDRESS_GOERLI.ICHI_VAULT_USDC_BLB)
	// await usdc.approve(ichiVault.address, utils.parseUnits("100", 6));
	// await blb.approve(ichiVault.address, utils.parseUnits("100", 18));
	// await ichiVault.deposit(utils.parseUnits("100", 6), 0, deployer.address)

	// // Mock ICHI Angel Vault
	// const LinkedLibFactory = await ethers.getContractFactory("UniV3WrappedLib");
	// const LibInstance = await LinkedLibFactory.deploy();
	// deployment.UNI_LIB = LibInstance.address;
	// writeDeployments(deployment);

	const MockIchiVault = await ethers.getContractFactory("MockIchiVault", {
		libraries: {
			UniV3WrappedLibMockup: deployment.UNI_LIB
		}
	});
	const ichiVault = <MockIchiVault>await MockIchiVault.deploy(
		ADDRESS_GOERLI.UNI_V3_USDC_WBTC,
		true,
		true,
		deployer.address,
		deployer.address, // factory address
		3600
	);
	await ichiVault.deployed();
	console.log('Mock Ichi Vault:', ichiVault.address);
	deployment.MockIchiVault_USDC_WBTC = ichiVault.address;
	writeDeployments(deployment);
}

main()
	.then(() => process.exit(0))
	.catch((error: Error) => {
		console.error(error);
		process.exit(1);
	});
