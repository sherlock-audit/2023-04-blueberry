import { ethers } from "hardhat";
import { ADDRESS_GOERLI, CONTRACT_NAMES } from "../../constant";
import { IchiVaultOracle } from "../../typechain-types";
import { deployment, writeDeployments } from "../../utils";

async function main(): Promise<void> {
	const [deployer] = await ethers.getSigners();
	console.log("Deployer:", deployer.address);

	// Ichi Lp Oracle
	const IchiVaultOracle = await ethers.getContractFactory(CONTRACT_NAMES.IchiVaultOracle, {
		libraries: {
			UniV3WrappedLibMockup: deployment.UNI_LIB
		}
	});
	const ichiVaultOracle = <IchiVaultOracle>await IchiVaultOracle.deploy(deployment.CoreOracle);
	await ichiVaultOracle.deployed();
	console.log('Ichi Lp Oracle Address:', ichiVaultOracle.address);
	deployment.IchiVaultOracle = ichiVaultOracle.address;
	writeDeployments(deployment);

	await ichiVaultOracle.setPriceDeviation(ADDRESS_GOERLI.MockIchiV2, 300);

	// Set Ichi Lp Oracle Routes
	const coreOracle = await ethers.getContractAt(CONTRACT_NAMES.CoreOracle, deployment.CoreOracle);
	await coreOracle.setRoutes([
		deployment.MockIchiVault_USDC_ALCX,
		deployment.MockIchiVault_USDC_BLB,
		deployment.MockIchiVault_USDC_ICHI,
		deployment.MockIchiVault_USDC_WBTC,
		deployment.MockIchiVault_USDC_WETH,
	], [
		deployment.IchiVaultOracle,
		deployment.IchiVaultOracle,
		deployment.IchiVaultOracle,
		deployment.IchiVaultOracle,
		deployment.IchiVaultOracle,
	])
}

main()
	.then(() => process.exit(0))
	.catch((error: Error) => {
		console.error(error);
		process.exit(1);
	});
