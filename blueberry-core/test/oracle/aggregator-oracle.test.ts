import chai, { expect } from 'chai';
import { BigNumber, utils } from 'ethers';
import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ADDRESS, CONTRACT_NAMES } from '../../constant';
import {
  AggregatorOracle,
  BandAdapterOracle,
  ChainlinkAdapterOracle,
  MockOracle,
} from '../../typechain-types';

import { solidity } from 'ethereum-waffle'
import { near } from '../assertions/near'
import { roughlyNear } from '../assertions/roughlyNear'

chai.use(solidity)
chai.use(near)
chai.use(roughlyNear)

const OneDay = 86400;
const DEVIATION = 500; // 5%

describe('Aggregator Oracle', () => {
  let admin: SignerWithAddress;
  let alice: SignerWithAddress;

  let mockOracle1: MockOracle;
  let mockOracle2: MockOracle;
  let mockOracle3: MockOracle;

  let chainlinkOracle: ChainlinkAdapterOracle;
  let bandOracle: BandAdapterOracle;
  let aggregatorOracle: AggregatorOracle

  before(async () => {
    [admin, alice] = await ethers.getSigners();

    // Chainlink Oracle
    const ChainlinkAdapterOracle = await ethers.getContractFactory(CONTRACT_NAMES.ChainlinkAdapterOracle);
    chainlinkOracle = <ChainlinkAdapterOracle>await ChainlinkAdapterOracle.deploy(ADDRESS.ChainlinkRegistry);
    await chainlinkOracle.deployed();

    await chainlinkOracle.setTimeGap(
      [ADDRESS.USDC, ADDRESS.UNI, ADDRESS.CRV],
      [OneDay, OneDay, OneDay]
    );

    // Band Oracle
    const BandAdapterOracle = await ethers.getContractFactory(CONTRACT_NAMES.BandAdapterOracle);
    bandOracle = <BandAdapterOracle>await BandAdapterOracle.deploy(ADDRESS.BandStdRef);
    await bandOracle.deployed();

    await bandOracle.setTimeGap(
      [ADDRESS.USDC, ADDRESS.UNI],
      [OneDay, OneDay]
    );
    await bandOracle.setSymbols(
      [ADDRESS.USDC, ADDRESS.UNI],
      ['USDC', 'UNI']
    );

    // Mock Oracle
    const MockOracle = await ethers.getContractFactory(CONTRACT_NAMES.MockOracle);
    mockOracle1 = <MockOracle>await MockOracle.deploy();
    mockOracle2 = <MockOracle>await MockOracle.deploy();
    mockOracle3 = <MockOracle>await MockOracle.deploy();

    await mockOracle1.setPrice(
      [ADDRESS.ICHI],
      [utils.parseEther("1")]
    )
    await mockOracle2.setPrice(
      [ADDRESS.ICHI],
      [utils.parseEther("0.5")]
    )
    await mockOracle3.setPrice(
      [ADDRESS.ICHI],
      [utils.parseEther("0.7")]
    )
  });

  beforeEach(async () => {
    const AggregatorOracle = await ethers.getContractFactory(CONTRACT_NAMES.AggregatorOracle);
    aggregatorOracle = <AggregatorOracle>await AggregatorOracle.deploy();
    await aggregatorOracle.deployed();
  })

  describe("Owner", () => {
    it("should be able to set primary sources", async () => {
      await expect(
        aggregatorOracle.connect(alice).setPrimarySources(
          ADDRESS.USDC,
          DEVIATION,
          [chainlinkOracle.address, bandOracle.address]
        )
      ).to.be.revertedWith('Ownable: caller is not the owner');

      await expect(
        aggregatorOracle.setPrimarySources(
          ethers.constants.AddressZero,
          DEVIATION,
          [chainlinkOracle.address, bandOracle.address]
        )
      ).to.be.revertedWith('ZERO_ADDRESS');

      await expect(
        aggregatorOracle.setPrimarySources(
          ADDRESS.UNI,
          DEVIATION,
          [chainlinkOracle.address, bandOracle.address, bandOracle.address, bandOracle.address]
        )
      ).to.be.revertedWith('EXCEED_SOURCE_LEN(4)');

      await expect(
        aggregatorOracle.setPrimarySources(
          ADDRESS.UNI,
          DEVIATION,
          [chainlinkOracle.address, ethers.constants.AddressZero]
        )
      ).to.be.revertedWith('ZERO_ADDRESS');

      await expect(
        aggregatorOracle.setPrimarySources(
          ADDRESS.UNI,
          1500,
          [chainlinkOracle.address, bandOracle.address]
        )
      ).to.be.revertedWith("OUT_OF_DEVIATION_CAP")

      await expect(
        aggregatorOracle.setPrimarySources(
          ADDRESS.UNI,
          DEVIATION,
          [chainlinkOracle.address, bandOracle.address]
        )
      ).to.be.emit(aggregatorOracle, "SetPrimarySources");

      expect(await aggregatorOracle.maxPriceDeviations(ADDRESS.UNI)).to.be.equal(DEVIATION);
      expect(await aggregatorOracle.primarySourceCount(ADDRESS.UNI)).to.be.equal(2);
      expect(await aggregatorOracle.primarySources(ADDRESS.UNI, 0)).to.be.equal(chainlinkOracle.address);
      expect(await aggregatorOracle.primarySources(ADDRESS.UNI, 1)).to.be.equal(bandOracle.address);
    })
    it("should be able to set multiple primary sources", async () => {
      await expect(
        aggregatorOracle.connect(alice).setMultiPrimarySources(
          [ADDRESS.USDC, ADDRESS.UNI],
          [DEVIATION, DEVIATION],
          [
            [chainlinkOracle.address, bandOracle.address],
            [chainlinkOracle.address, bandOracle.address]
          ]
        )
      ).to.be.revertedWith('Ownable: caller is not the owner');

      await expect(
        aggregatorOracle.setMultiPrimarySources(
          [ADDRESS.USDC, ADDRESS.UNI],
          [DEVIATION],
          [
            [chainlinkOracle.address, bandOracle.address],
            [chainlinkOracle.address, bandOracle.address]
          ]
        )
      ).to.be.revertedWith('INPUT_ARRAY_MISMATCH');

      await expect(
        aggregatorOracle.setMultiPrimarySources(
          [ADDRESS.USDC, ADDRESS.UNI],
          [DEVIATION, DEVIATION],
          [
            [chainlinkOracle.address, bandOracle.address]
          ]
        )
      ).to.be.revertedWith('INPUT_ARRAY_MISMATCH');

      await expect(
        aggregatorOracle.setMultiPrimarySources(
          [ADDRESS.USDC, ADDRESS.UNI],
          [DEVIATION, DEVIATION],
          [
            [chainlinkOracle.address, bandOracle.address],
            [chainlinkOracle.address, bandOracle.address]
          ]
        )
      ).to.be.emit(aggregatorOracle, "SetPrimarySources");

      expect(await aggregatorOracle.maxPriceDeviations(ADDRESS.UNI)).to.be.equal(DEVIATION);
      expect(await aggregatorOracle.primarySourceCount(ADDRESS.UNI)).to.be.equal(2);
      expect(await aggregatorOracle.primarySources(ADDRESS.UNI, 0)).to.be.equal(chainlinkOracle.address);
      expect(await aggregatorOracle.primarySources(ADDRESS.UNI, 1)).to.be.equal(bandOracle.address);
    })
  })

  describe('Price Feeds', () => {
    beforeEach(async () => {
      await aggregatorOracle.setMultiPrimarySources(
        [ADDRESS.USDC, ADDRESS.UNI, ADDRESS.CRV, ADDRESS.ICHI],
        [DEVIATION, DEVIATION, DEVIATION, DEVIATION],
        [
          [bandOracle.address, chainlinkOracle.address],
          [chainlinkOracle.address, bandOracle.address, bandOracle.address],
          [chainlinkOracle.address],
          [mockOracle1.address, mockOracle2.address, mockOracle3.address],
        ]
      )
    })
    it("should revert when there is no source", async () => {
      await expect(
        aggregatorOracle.getPrice(ADDRESS.BLB_COMPTROLLER)
      ).to.be.revertedWith(`NO_PRIMARY_SOURCE`);
    })
    it("should revert when there is no source returning valid price", async () => {
      await mockOracle1.setPrice([ADDRESS.ICHI], [0]);
      await mockOracle2.setPrice([ADDRESS.ICHI], [0]);
      await mockOracle3.setPrice([ADDRESS.ICHI], [0]);

      await expect(
        aggregatorOracle.getPrice(ADDRESS.ICHI)
      ).to.be.revertedWith(`NO_VALID_SOURCE`);
    })
    it("should revert when source prices exceed deviation", async () => {
      await aggregatorOracle.setPrimarySources(
        ADDRESS.ICHI,
        DEVIATION,
        [mockOracle1.address, mockOracle2.address],
      );

      await mockOracle1.setPrice([ADDRESS.ICHI], [utils.parseEther("0.7")]);
      await mockOracle2.setPrice([ADDRESS.ICHI], [utils.parseEther("1")]);

      await expect(
        aggregatorOracle.getPrice(ADDRESS.ICHI)
      ).to.be.revertedWith("EXCEED_DEVIATION")
    })
    it("should take avgerage of valid prices within deviation", async () => {
      await mockOracle1.setPrice([ADDRESS.ICHI], [utils.parseEther("0.7")]);
      await mockOracle2.setPrice([ADDRESS.ICHI], [utils.parseEther("0.96")]);
      await mockOracle3.setPrice([ADDRESS.ICHI], [utils.parseEther("1")]);

      expect(await aggregatorOracle.getPrice(ADDRESS.ICHI)).to.be.equal(utils.parseEther("0.98"))

      await mockOracle1.setPrice([ADDRESS.ICHI], [utils.parseEther("0.68")]);
      await mockOracle2.setPrice([ADDRESS.ICHI], [utils.parseEther("0.7")]);
      await mockOracle3.setPrice([ADDRESS.ICHI], [utils.parseEther("1")]);
      expect(await aggregatorOracle.getPrice(ADDRESS.ICHI)).to.be.equal(utils.parseEther("0.69"))
    })
    it("CRV price feeds", async () => {
      const token = ADDRESS.CRV;
      const chainlinkPrice = await chainlinkOracle.getPrice(token);
      console.log('CRV Price (Chainlink):', utils.formatUnits(chainlinkPrice, 18));

      const aggregatorPrice = await aggregatorOracle.getPrice(token);
      console.log('CRV Price (Oracle):', utils.formatUnits(aggregatorPrice, 18))
      expect(chainlinkPrice).to.be.equal(aggregatorPrice);
    })
    it("UNI price feeds", async () => {
      const token = ADDRESS.UNI;
      const chainlinkPrice = await chainlinkOracle.getPrice(token);
      const bandPrice = await bandOracle.getPrice(token);
      console.log('UNI Price (Chainlink / Band):', utils.formatUnits(chainlinkPrice, 18), '/', utils.formatUnits(bandPrice, 18));

      const aggregatorPrice = await aggregatorOracle.getPrice(token);
      console.log('USDC Price (Oracle):', utils.formatUnits(aggregatorPrice, 18))
      expect(bandPrice).to.be.equal(aggregatorPrice);
    })
    it("USDC price feeds", async () => {
      const token = ADDRESS.USDC;
      const chainlinkPrice = await chainlinkOracle.getPrice(token);
      const bandPrice = await bandOracle.getPrice(token);
      console.log('USDC Price (Chainlink / Band):', utils.formatUnits(chainlinkPrice, 18), '/', utils.formatUnits(bandPrice, 18));

      const aggregatorPrice = await aggregatorOracle.getPrice(token);
      console.log('USDC Price (Oracle):', utils.formatUnits(aggregatorPrice, 18))
      expect(chainlinkPrice.add(bandPrice).div(2)).to.be.equal(aggregatorPrice);
    })
  })
});
