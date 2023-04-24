import { ethers, upgrades } from "hardhat";
import { ADDRESS_GOERLI, CONTRACT_NAMES } from "../../constant";
import { HardVault, SoftVault } from "../../typechain-types";
import { deployment, writeDeployments } from '../../utils';

async function main(): Promise<void> {
	const [deployer] = await ethers.getSigners();
	console.log("Deployer:", deployer.address);

	// HardVault
	// const HardVault = await ethers.getContractFactory(CONTRACT_NAMES.HardVault);
	// const hardVault = <HardVault>await upgrades.deployProxy(HardVault, [
	// 	deployment.ProtocolConfig,
	// ])
	// await hardVault.deployed();
	// console.log("Hard Vault:", hardVault.address);
	// deployment.HardVault = hardVault.address;
	// writeDeployments(deployment);

	// SoftVault
	const SoftVault = await ethers.getContractFactory(CONTRACT_NAMES.SoftVault);

	const vault = <SoftVault>await upgrades.deployProxy(SoftVault, [
		deployment.ProtocolConfig,
		ADDRESS_GOERLI.bOHM,
		"Interest Bearing OHM",
		"ibOHM"
	]);
	await vault.deployed();
	console.log('Soft Vault-OHM:', vault.address);
	deployment.SoftVault_OHM = vault.address;
	writeDeployments(deployment);


	// const vault = <SoftVault>await upgrades.deployProxy(SoftVault, [
	// 	deployment.ProtocolConfig,
	// 	ADDRESS_GOERLI.bMIM,
	// 	"Interest Bearing MIM",
	// 	"ibMIM"
	// ]);
	// await vault.deployed();
	// console.log('Soft Vault-MIM:', vault.address);
	// deployment.SoftVault_MIM = vault.address;
	// writeDeployments(deployment);

	// const vault = <SoftVault>await upgrades.deployProxy(SoftVault, [
	// 	deployment.ProtocolConfig,
	// 	ADDRESS_GOERLI.bLINK,
	// 	"Interest Bearing LINK",
	// 	"ibLINK"
	// ]);
	// await vault.deployed();
	// console.log('Soft Vault-LINK:', vault.address);
	// deployment.SoftVault_LINK = vault.address;
	// writeDeployments(deployment);

	// const vault = <SoftVault>await upgrades.deployProxy(SoftVault, [
	// 	deployment.ProtocolConfig,
	// 	ADDRESS_GOERLI.bICHI,
	// 	"Interest Bearing ICHI",
	// 	"ibICHI"
	// ]);
	// await vault.deployed();
	// console.log('Soft Vault-ICHI:', vault.address);
	// deployment.SoftVault_ICHI = vault.address;
	// writeDeployments(deployment);

	// const vault = <SoftVault>await upgrades.deployProxy(SoftVault, [
	// 	deployment.ProtocolConfig,
	// 	ADDRESS_GOERLI.bUSDC,
	// 	"Interest Bearing USDC",
	// 	"ibUSDC"
	// ]);
	// await vault.deployed();
	// console.log('Soft Vault-USDC:', vault.address);
	// deployment.SoftVault_USDC = vault.address;
	// writeDeployments(deployment);

	// const vault = <SoftVault>await upgrades.deployProxy(SoftVault, [
	// 	deployment.ProtocolConfig,
	// 	ADDRESS_GOERLI.bALCX,
	// 	"Interest Bearing ALCX",
	// 	"ibALCX"
	// ]);
	// await vault.deployed();
	// console.log('Soft Vault-ALCX:', vault.address);
	// deployment.SoftVault_ALCX = vault.address;
	// writeDeployments(deployment);

	// const vault = <SoftVault>await upgrades.deployProxy(SoftVault, [
	// 	deployment.ProtocolConfig,
	// 	ADDRESS_GOERLI.bBAL,
	// 	"Interest Bearing BAL",
	// 	"ibBAL"
	// ]);
	// await vault.deployed();
	// console.log('Soft Vault-BAL:', vault.address);
	// deployment.SoftVault_BAL = vault.address;
	// writeDeployments(deployment);

	// const vault = <SoftVault>await upgrades.deployProxy(SoftVault, [
	// 	deployment.ProtocolConfig,
	// 	ADDRESS_GOERLI.bBLB,
	// 	"Interest Bearing BLB",
	// 	"ibBLB"
	// ]);
	// await vault.deployed();
	// console.log('Soft Vault-BLB:', vault.address);
	// deployment.SoftVault_BLB = vault.address;
	// writeDeployments(deployment);

	// const vault = <SoftVault>await upgrades.deployProxy(SoftVault, [
	// 	deployment.ProtocolConfig,
	// 	ADDRESS_GOERLI.bDAI,
	// 	"Interest Bearing DAI",
	// 	"ibDAI"
	// ]);
	// await vault.deployed();
	// console.log('Soft Vault-DAI:', vault.address);
	// deployment.SoftVault_DAI = vault.address;
	// writeDeployments(deployment);

	// const vault = <SoftVault>await upgrades.deployProxy(SoftVault, [
	// 	deployment.ProtocolConfig,
	// 	ADDRESS_GOERLI.bSUSHI,
	// 	"Interest Bearing SUSHI",
	// 	"ibSUSHI"
	// ]);
	// await vault.deployed();
	// console.log('Soft Vault-SUSHI:', vault.address);
	// deployment.SoftVault_SUSHI = vault.address;
	// writeDeployments(deployment);

	// const vault = <SoftVault>await upgrades.deployProxy(SoftVault, [
	// 	deployment.ProtocolConfig,
	// 	ADDRESS_GOERLI.bUSDD,
	// 	"Interest Bearing USDD",
	// 	"ibUSDD"
	// ]);
	// await vault.deployed();
	// console.log('Soft Vault-USDD:', vault.address);
	// deployment.SoftVault_USDD = vault.address;
	// writeDeployments(deployment);

	// const vault = <SoftVault>await upgrades.deployProxy(SoftVault, [
	// 	deployment.ProtocolConfig,
	// 	ADDRESS_GOERLI.bWBTC,
	// 	"Interest Bearing WBTC",
	// 	"ibWBTC"
	// ]);
	// await vault.deployed();
	// console.log('Soft Vault-WBTC:', vault.address);
	// deployment.SoftVault_WBTC = vault.address;
	// writeDeployments(deployment);

	// const vault = <SoftVault>await upgrades.deployProxy(SoftVault, [
	// 	deployment.ProtocolConfig,
	// 	ADDRESS_GOERLI.bWETH,
	// 	"Interest Bearing WETH",
	// 	"ibWETH"
	// ]);
	// await vault.deployed();
	// console.log('Soft Vault-WETH:', vault.address);
	// deployment.SoftVault_WETH = vault.address;
	// writeDeployments(deployment);
}

main()
	.then(() => process.exit(0))
	.catch((error: Error) => {
		console.error(error);
		process.exit(1);
	});
