import { makeForceImport } from '@openzeppelin/hardhat-upgrades/dist/force-import';
import { utils } from 'ethers';
import { ethers, upgrades } from "hardhat";
import { CONTRACT_NAMES } from '../../constant';
import { MockIchiFarm, WIchiFarm } from '../../typechain-types';
import { deployment, writeDeployments } from '../../utils';

async function main(): Promise<void> {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  // // Mock Ichi Farm
  // const MockIchiFarm = await ethers.getContractFactory("MockIchiFarm");
  // const ichiFarm = <MockIchiFarm>await MockIchiFarm.deploy(
  //   deployment.MockIchiV1,
  //   utils.parseUnits("1", 9), // 1 ICHI per block
  // )
  // await ichiFarm.deployed();
  // console.log("Mock ICHI Farm:", ichiFarm.address);
  // deployment.MockIchiFarm = ichiFarm.address;
  // writeDeployments(deployment);

  // WIchiFarm
  const WIchiFarm = await ethers.getContractFactory(CONTRACT_NAMES.WIchiFarm);
  const wichiFarm = <WIchiFarm>await upgrades.deployProxy(WIchiFarm, [
    deployment.MockIchiV2, deployment.MockIchiV1, deployment.MockIchiFarm
  ]);
  await wichiFarm.deployed();
  console.log('WIchiFarm:', wichiFarm.address);
  deployment.WIchiFarm = wichiFarm.address;
  writeDeployments(deployment);
}

main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  });
