import chai, { expect } from 'chai';
import { BigNumber, utils } from 'ethers';
import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ADDRESS, CONTRACT_NAMES } from '../../constant';
import {
  BandAdapterOracle,
  IStdReference,
} from '../../typechain-types';
import BandOracleABI from '../../abi/IStdReference.json';

import { solidity } from 'ethereum-waffle'
import { near } from '../assertions/near'
import { roughlyNear } from '../assertions/roughlyNear'

chai.use(solidity)
chai.use(near)
chai.use(roughlyNear)

const OneDay = 86400;

describe('Base Oracle / Band Adapter Oracle', () => {
  let admin: SignerWithAddress;
  let alice: SignerWithAddress;

  let bandAdapterOracle: BandAdapterOracle;
  let bandBaseOracle: IStdReference;

  before(async () => {
    [admin, alice] = await ethers.getSigners();
    bandBaseOracle = <IStdReference>await ethers.getContractAt(BandOracleABI, ADDRESS.BandStdRef);
  });

  beforeEach(async () => {
    const BandAdapterOracle = await ethers.getContractFactory(CONTRACT_NAMES.BandAdapterOracle);
    bandAdapterOracle = <BandAdapterOracle>await BandAdapterOracle.deploy(ADDRESS.BandStdRef);
    await bandAdapterOracle.deployed();

    await bandAdapterOracle.setTimeGap(
      [ADDRESS.USDC, ADDRESS.UNI],
      [OneDay, OneDay]
    );
    await bandAdapterOracle.setSymbols(
      [ADDRESS.USDC, ADDRESS.UNI],
      ['USDC', 'UNI']
    );
  })

  describe("Constructor", () => {
    it("should revert when std ref address is invalid", async () => {
      const BandAdapterOracle = await ethers.getContractFactory(CONTRACT_NAMES.BandAdapterOracle);
      await expect(
        BandAdapterOracle.deploy(ethers.constants.AddressZero)
      ).to.be.revertedWith('ZERO_ADDRESS');
    });
    it("should set feed registry", async () => {
      expect(await bandAdapterOracle.ref()).to.be.equal(ADDRESS.BandStdRef);
    })
  })
  describe("Owner", () => {
    it("should be able to set std ref", async () => {
      await expect(
        bandAdapterOracle.connect(alice).setRef(ADDRESS.BandStdRef)
      ).to.be.revertedWith('Ownable: caller is not the owner');

      await expect(
        bandAdapterOracle.setRef(ethers.constants.AddressZero)
      ).to.be.revertedWith('ZERO_ADDRESS');

      await expect(
        bandAdapterOracle.setRef(ADDRESS.BandStdRef)
      ).to.be.emit(bandAdapterOracle, "SetRef").withArgs(ADDRESS.BandStdRef);

      expect(await bandAdapterOracle.ref()).to.be.equal(ADDRESS.BandStdRef);
    })
    it("should allow symbol settings only for owner", async () => {
      await expect(bandAdapterOracle.connect(alice).setSymbols(
        [ADDRESS.USDC, ADDRESS.UNI],
        ['USDC', 'UNI']
      )).to.be.revertedWith('Ownable: caller is not the owner');

      await expect(bandAdapterOracle.setSymbols(
        [ADDRESS.USDC, ADDRESS.UNI],
        ['USDC', 'UNI', 'DAI']
      )).to.be.revertedWith('INPUT_ARRAY_MISMATCH');

      await expect(bandAdapterOracle.setSymbols(
        [ADDRESS.USDC, ethers.constants.AddressZero],
        ['USDC', 'UNI']
      )).to.be.revertedWith('ZERO_ADDRESS');

      await expect(bandAdapterOracle.setSymbols(
        [ADDRESS.USDC, ADDRESS.UNI],
        ['USDC', 'UNI']
      )).to.be.emit(bandAdapterOracle, 'SetSymbol');

      expect(await bandAdapterOracle.symbols(ADDRESS.USDC)).to.be.equal('USDC');
    })

    it("should allow maxDelayTimes setting only for owner", async () => {
      await expect(bandAdapterOracle.connect(alice).setTimeGap(
        [ADDRESS.USDC, ADDRESS.UNI],
        [OneDay, OneDay]
      )).to.be.revertedWith('Ownable: caller is not the owner');

      await expect(bandAdapterOracle.setTimeGap(
        [ADDRESS.USDC, ADDRESS.UNI],
        [OneDay, OneDay, OneDay]
      )).to.be.revertedWith('INPUT_ARRAY_MISMATCH');

      await expect(bandAdapterOracle.setTimeGap(
        [ADDRESS.USDC, ethers.constants.AddressZero],
        [OneDay, OneDay]
      )).to.be.revertedWith('ZERO_ADDRESS');

      await expect(bandAdapterOracle.setTimeGap(
        [ADDRESS.USDC, ADDRESS.UNI],
        [OneDay, OneDay * 3]
      )).to.be.revertedWith('TOO_LONG_DELAY');

      await expect(bandAdapterOracle.setTimeGap(
        [ADDRESS.USDC, ADDRESS.UNI],
        [OneDay, OneDay]
      )).to.be.emit(bandAdapterOracle, 'SetTimeGap');

      expect(await bandAdapterOracle.timeGaps(ADDRESS.USDC)).to.be.equal(OneDay);
    })
  })
  describe('Price Feeds', () => {
    it("should revert when symbol map is not set", async () => {
      await expect(
        bandAdapterOracle.getPrice(ADDRESS.CRV)
      ).to.be.revertedWith('NO_SYM_MAPPING');
    })
    it("should revert when max delay time is not set", async () => {
      await bandAdapterOracle.setSymbols([ADDRESS.CRV], ['CRV']);
      await expect(
        bandAdapterOracle.getPrice(ADDRESS.CRV)
      ).to.be.revertedWith('NO_MAX_DELAY');
    })
    it('USDC price feeds / based 10^18', async () => {
      const { rate } = await bandBaseOracle.getReferenceData('USDC', 'USD');
      const price = await bandAdapterOracle.getPrice(ADDRESS.USDC);

      expect(rate).to.be.equal(price);
      // real usdc price should be closed to $1
      expect(price).to.be.roughlyNear(BigNumber.from(10).pow(18));
      console.log('USDC Price:', utils.formatUnits(price, 18));
    })
    it('UNI price feeds / based 10^18', async () => {
      const { rate } = await bandBaseOracle.getReferenceData('UNI', 'USD');
      const price = await bandAdapterOracle.getPrice(ADDRESS.UNI);

      expect(rate).to.be.equal(price);
      console.log('UNI Price:', utils.formatUnits(price, 18));
    })
  })
});
