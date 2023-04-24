import { ethers, upgrades } from "hardhat";
import { ADDRESS_GOERLI, CONTRACT_NAMES } from "../../constant";
import { CoreOracle } from "../../typechain-types";
import { deployment, writeDeployments } from '../../utils';

async function main(): Promise<void> {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  // Set oracle configs
  // const oracle = <CoreOracle>await ethers.getContractAt(CONTRACT_NAMES.CoreOracle, deployment.CoreOracle);
  const CoreOracle = await ethers.getContractFactory(CONTRACT_NAMES.CoreOracle);
  const oracle = <CoreOracle>await upgrades.deployProxy(CoreOracle);
  await oracle.deployed();

  deployment.CoreOracle = oracle.address;
  writeDeployments(deployment)

  await oracle.setLiqThresholds(
    [
      deployment.MockIchiV2,
      deployment.MockWBTC,
      deployment.MockWETH,
      deployment.MockALCX,
      deployment.MockBAL,
      deployment.MockSUSHI,
      deployment.MockCRV,
      deployment.MockBLB,
      deployment.MockDAI,
      deployment.MockUSDD,
      deployment.MockUSDC,
    ],
    [
      9000,
      9000,
      9000,
      9000,
      9000,
      9000,
      9000,
      8500,
      8500,
      8500,
      8500,
    ]
  )
  await oracle.setRoutes(
    [
      deployment.MockALCX,
      deployment.MockBAL,
      deployment.MockBLB,
      deployment.MockCRV,
      deployment.MockDAI,
      deployment.MockIchiV2,
      deployment.MockSUSHI,
      deployment.MockUSDC,
      deployment.MockUSDD,
      deployment.MockWBTC,
      deployment.MockWETH,
    ],
    [
      deployment.UniswapV3AdapterOracle,
      deployment.UniswapV3AdapterOracle,
      deployment.UniswapV3AdapterOracle,
      deployment.UniswapV3AdapterOracle,
      deployment.AggregatorOracle,
      deployment.UniswapV3AdapterOracle,
      deployment.UniswapV3AdapterOracle,
      deployment.AggregatorOracle,
      deployment.AggregatorOracle,
      deployment.AggregatorOracle,
      deployment.AggregatorOracle,
    ]
  )
}

main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  });
