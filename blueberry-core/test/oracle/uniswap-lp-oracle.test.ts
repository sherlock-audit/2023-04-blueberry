import chai, { expect } from 'chai';
import { BigNumber, utils } from 'ethers';
import { ethers } from 'hardhat';
import { ADDRESS, CONTRACT_NAMES } from "../../constant"
import {
  UniswapV2Oracle,
  IUniswapV2Pair,
  ChainlinkAdapterOracle,
  IERC20Metadata,
} from '../../typechain-types';
import UniPairABI from '../../abi/IUniswapV2Pair.json';
import { roughlyNear } from '../assertions/roughlyNear'

chai.use(roughlyNear)

const OneDay = 86400;

describe('Uniswap V2 LP Oracle', () => {
  let uniswapOracle: UniswapV2Oracle;
  let chainlinkAdapterOracle: ChainlinkAdapterOracle;
  before(async () => {
    const ChainlinkAdapterOracle = await ethers.getContractFactory(CONTRACT_NAMES.ChainlinkAdapterOracle);
    chainlinkAdapterOracle = <ChainlinkAdapterOracle>await ChainlinkAdapterOracle.deploy(ADDRESS.ChainlinkRegistry);
    await chainlinkAdapterOracle.deployed();

    await chainlinkAdapterOracle.setTimeGap(
      [ADDRESS.USDC, ADDRESS.CRV],
      [OneDay, OneDay]
    );

    const UniswapOracleFactory = await ethers.getContractFactory(CONTRACT_NAMES.UniswapV2Oracle);
    uniswapOracle = <UniswapV2Oracle>await UniswapOracleFactory.deploy(chainlinkAdapterOracle.address);
    await uniswapOracle.deployed();
  })

  it("USDC/CRV LP Price", async () => {
    const pair = <IUniswapV2Pair>await ethers.getContractAt(UniPairABI, ADDRESS.UNI_V2_USDC_CRV);
    const oraclePrice = await uniswapOracle.getPrice(ADDRESS.UNI_V2_USDC_CRV);

    // Calculate real lp price manually
    const { reserve0, reserve1 } = await pair.getReserves();
    const totalSupply = await pair.totalSupply();
    const token0 = await pair.token0();
    const token1 = await pair.token1();
    const token0Price = await chainlinkAdapterOracle.getPrice(token0);
    const token1Price = await chainlinkAdapterOracle.getPrice(token1);
    const token0Contract = <IERC20Metadata>await ethers.getContractAt(CONTRACT_NAMES.IERC20Metadata, token0);
    const token1Contract = <IERC20Metadata>await ethers.getContractAt(CONTRACT_NAMES.IERC20Metadata, token1);
    const token0Decimal = await token0Contract.decimals();
    const token1Decimal = await token1Contract.decimals();

    const token0Amount = token0Price.mul(reserve0)
      .div(BigNumber.from(10).pow(token0Decimal));
    const token1Amount = token1Price.mul(reserve1)
      .div(BigNumber.from(10).pow(token1Decimal));
    const price = token0Amount.add(token1Amount).mul(BigNumber.from(10).pow(18)).div(totalSupply);

    console.log('USDC/CRV LP Price:', utils.formatUnits(oraclePrice, 18), utils.formatUnits(price, 18));
  })
  it("should return 0 when invalid lp address provided", async () => {
    const MockToken = await ethers.getContractFactory(CONTRACT_NAMES.MockERC20);
    const mockToken = await MockToken.deploy("Uniswap Lp Token", "UNI_LP", 18);
    const price = await uniswapOracle.getPrice(mockToken.address);
    expect(price.isZero()).to.be.true;
  })
});