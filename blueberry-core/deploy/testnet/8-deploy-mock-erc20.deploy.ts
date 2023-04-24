import { ethers } from "hardhat";
import { deployment, writeDeployments } from '../../utils';

async function main(): Promise<void> {
	const [deployer] = await ethers.getSigners();
	console.log("Deployer:", deployer.address);

	// Deploy Mock Token
	const MockERC20 = await ethers.getContractFactory("MockERC20");
	let mock = await MockERC20.deploy("ICHI.Farm", "ICHI", 9);
	await mock.deployed();
	deployment.MockIchiV1 = mock.address;
	writeDeployments(deployment);

	const MockIchiV2 = await ethers.getContractFactory("MockIchiV2");
	let mockIchi = await MockIchiV2.deploy(deployment.MockIchiV1);
	await mockIchi.deployed();
	deployment.MockIchiV2 = mockIchi.address;
	writeDeployments(deployment);

	mock = await MockERC20.deploy("Mock BAL", "BAL", 18);
	await mock.deployed();
	deployment.MockBAL = mock.address;
	writeDeployments(deployment);

	mock = await MockERC20.deploy("Mock ALCX", "ALCX", 18);
	await mock.deployed();
	deployment.MockALCX = mock.address;
	writeDeployments(deployment);

	mock = await MockERC20.deploy("Mock CRV", "CRV", 18);
	await mock.deployed();
	deployment.MockCRV = mock.address;
	writeDeployments(deployment);

	mock = await MockERC20.deploy("Mock DAI", "DAI", 18);
	await mock.deployed();
	deployment.MockDAI = mock.address;
	writeDeployments(deployment);

	mock = await MockERC20.deploy("Mock SUSHI", "SUSHI", 18);
	await mock.deployed();
	deployment.MockSUSHI = mock.address;
	writeDeployments(deployment);

	mock = await MockERC20.deploy("Mock USDC", "USDC", 6);
	await mock.deployed();
	deployment.MockUSDC = mock.address;
	writeDeployments(deployment);

	mock = await MockERC20.deploy("Mock USDD", "USDD", 18);
	await mock.deployed();
	deployment.MockUSDD = mock.address;
	writeDeployments(deployment);

	mock = await MockERC20.deploy("Mock WBTC", "WBTC", 8);
	await mock.deployed();
	deployment.MockWBTC = mock.address;
	writeDeployments(deployment);

	mock = await MockERC20.deploy("Mock WETH", "WETH", 18);
	await mock.deployed();
	deployment.MockWETH = mock.address;
	writeDeployments(deployment);

	mock = await MockERC20.deploy("Mock OHM", "OHM", 9);
	await mock.deployed();
	deployment.MockOHM = mock.address;
	writeDeployments(deployment);
}

main()
	.then(() => process.exit(0))
	.catch((error: Error) => {
		console.error(error);
		process.exit(1);
	});
