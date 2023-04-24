import { BigNumber } from 'ethers';
import fs from 'fs';
import { ethers, network } from "hardhat";
import { ADDRESS } from '../../constant';
import { AggregatorOracle, BandAdapterOracle, ChainlinkAdapterOracle, CoreOracle, UniswapV3AdapterOracle } from '../../typechain-types';

const deploymentPath = "./deployments";
const deploymentFilePath = `${deploymentPath}/${network.name}.json`;

function writeDeployments(deployment: any) {
  if (!fs.existsSync(deploymentPath)) {
    fs.mkdirSync(deploymentPath);
  }
  fs.writeFileSync(deploymentFilePath, JSON.stringify(deployment, null, 2));
}

async function main(): Promise<void> {
  const deployment = fs.existsSync(deploymentFilePath)
    ? JSON.parse(fs.readFileSync(deploymentFilePath).toString())
    : {};

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  // Band Adapter Oracle
  const BandAdapterOracle = await ethers.getContractFactory("BandAdapterOracle");
  const bandOracle = <BandAdapterOracle>await BandAdapterOracle.deploy(ADDRESS.BandStdRef);
  await bandOracle.deployed();
  console.log("Band Oracle Address:", bandOracle.address);
  deployment.BandAdapterOracle = bandOracle.address;
  writeDeployments(deployment);

  console.log('Setting up Token configs on Band Oracle\nMax Delay Times: 1 day 12 hours');
  await bandOracle.setMaxDelayTimes([
    ADDRESS.USDC,
    ADDRESS.DAI,
    ADDRESS.CRV,
    ADDRESS.SUSHI,
    ADDRESS.WBTC,
    ADDRESS.WETH,
  ], [
    129600, 129600, 129600, 129600, 129600, 129600,
  ]);
  await bandOracle.setSymbols([
    ADDRESS.USDC,
    ADDRESS.DAI,
    ADDRESS.CRV,
    ADDRESS.SUSHI,
    ADDRESS.WBTC,
    ADDRESS.WETH,
  ], ['USDC', 'DAI', 'CRV', 'SUSHI', 'WBTC', 'ETH']);

  // Chainlink Adapter Oracle
  const ChainlinkAdapterOracle = await ethers.getContractFactory("ChainlinkAdapterOracle");
  const chainlinkOracle = <ChainlinkAdapterOracle>await ChainlinkAdapterOracle.deploy(ADDRESS.ChainlinkRegistry);
  await chainlinkOracle.deployed();
  console.log('Chainlink Oracle Address:', chainlinkOracle.address);
  deployment.ChainlinkAdapterOracle = chainlinkOracle.address;
  writeDeployments(deployment);

  console.log('Setting up USDC config on Chainlink Oracle\nMax Delay Times: 129900s');
  await chainlinkOracle.setMaxDelayTimes([
    ADDRESS.USDC,
    ADDRESS.DAI,
    ADDRESS.CRV,
    ADDRESS.SUSHI,
    ADDRESS.WBTC,
    ADDRESS.WETH,
  ], [
    129600, 129600, 129600, 129600, 129600, 129600,
  ]);
  await chainlinkOracle.setTokenRemappings([
    ADDRESS.USDC,
    ADDRESS.DAI,
    ADDRESS.CRV,
    ADDRESS.SUSHI,
    ADDRESS.WBTC,
    ADDRESS.WETH,
  ], [
    ADDRESS.USDC,
    ADDRESS.DAI,
    ADDRESS.CRV,
    ADDRESS.SUSHI,
    ADDRESS.CHAINLINK_BTC,
    ADDRESS.CHAINLINK_ETH,
  ]);

  // Aggregator Oracle
  const AggregatorOracle = await ethers.getContractFactory("AggregatorOracle");
  const aggregatorOracle = <AggregatorOracle>await AggregatorOracle.deploy();
  await aggregatorOracle.deployed();
  console.log('Aggregator Oracle Address:', aggregatorOracle.address);
  deployment.AggregatorOracle = aggregatorOracle.address;
  writeDeployments(deployment);

  await aggregatorOracle.setMultiPrimarySources(
    [
      ADDRESS.USDC,
      ADDRESS.DAI,
      ADDRESS.CRV,
      ADDRESS.SUSHI,
      ADDRESS.WBTC,
      ADDRESS.WETH,
    ], [
    ethers.utils.parseEther("1.05"),
    ethers.utils.parseEther("1.05"),
    ethers.utils.parseEther("1.05"),
    ethers.utils.parseEther("1.05"),
    ethers.utils.parseEther("1.05"),
    ethers.utils.parseEther("1.05"),
  ], [
    [bandOracle.address, chainlinkOracle.address],
    [bandOracle.address, chainlinkOracle.address],
    [bandOracle.address, chainlinkOracle.address],
    [bandOracle.address, chainlinkOracle.address],
    [bandOracle.address, chainlinkOracle.address],
    [bandOracle.address, chainlinkOracle.address],
  ]);

  // Uni V3 Adapter Oracle
  const UniswapV3AdapterOracle = await ethers.getContractFactory("UniswapV3AdapterOracle");
  const uniV3Oracle = <UniswapV3AdapterOracle>await UniswapV3AdapterOracle.deploy(aggregatorOracle.address);
  await uniV3Oracle.deployed();
  console.log('Uni V3 Oracle Address:', uniV3Oracle.address);
  deployment.UniswapV3AdapterOracle = uniV3Oracle.address;
  writeDeployments(deployment);

  await uniV3Oracle.setStablePools([ADDRESS.ICHI], [ADDRESS.UNI_V3_ICHI_USDC]);
  await uniV3Oracle.setTimeAgos([ADDRESS.ICHI], [10]); // 10s ago

  // Core Oracle
  const CoreOracle = await ethers.getContractFactory("CoreOracle");
  const coreOracle = <CoreOracle>await CoreOracle.deploy();
  await coreOracle.deployed();
  console.log('Core Oracle Address:', coreOracle.address);
  deployment.CoreOracle = coreOracle.address;
  writeDeployments(deployment);

  await coreOracle.setRoute([
    ADDRESS.USDC,
    ADDRESS.DAI,
    ADDRESS.CRV,
    ADDRESS.SUSHI,
    ADDRESS.WBTC,
    ADDRESS.WETH,
    ADDRESS.ICHI
  ], [
    aggregatorOracle.address,
    aggregatorOracle.address,
    aggregatorOracle.address,
    aggregatorOracle.address,
    aggregatorOracle.address,
    aggregatorOracle.address,
    uniV3Oracle.address
  ]);
}

main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  });
