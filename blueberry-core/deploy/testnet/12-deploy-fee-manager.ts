import { ethers, upgrades } from "hardhat";
import { CONTRACT_NAMES } from "../../constant";
import { deployment, writeDeployments } from "../../utils";

async function main(): Promise<void> {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  // Protocol Config
  const FeeManager = await ethers.getContractFactory(CONTRACT_NAMES.FeeManager);
  const feeManager = await upgrades.deployProxy(FeeManager, [deployment.ProtocolConfig]);
  console.log('Fee Manager:', feeManager.address);
  deployment.FeeManager = feeManager.address;
  writeDeployments(deployment);

  // Set fee manager address
  const config = await ethers.getContractAt(CONTRACT_NAMES.ProtocolConfig, deployment.ProtocolConfig);
  await config.setFeeManager(feeManager.address)
}

main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  });
