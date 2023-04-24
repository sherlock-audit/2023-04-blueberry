import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import chai, { expect } from 'chai';
import { BigNumber, utils } from 'ethers';
import { ethers } from 'hardhat';
import { ADDRESS, CONTRACT_NAMES } from '../../constant';
import {
  MockOracle,
  UniswapV3AdapterOracle,
} from '../../typechain-types';

import { solidity } from 'ethereum-waffle'

chai.use(solidity)

describe('Uniswap V3 Oracle', () => {
  let admin: SignerWithAddress;
  let alice: SignerWithAddress;

  let mockOracle: MockOracle;
  let uniswapV3Oracle: UniswapV3AdapterOracle;

  before(async () => {
    [admin, alice] = await ethers.getSigners();

    const LinkedLibFactory = await ethers.getContractFactory("UniV3WrappedLib");
    const LibInstance = await LinkedLibFactory.deploy();
    console.log("Uni V3 Lib Wrapper:", LibInstance.address)
    const MockOracle = await ethers.getContractFactory(
      CONTRACT_NAMES.MockOracle
    );
    mockOracle = <MockOracle>await MockOracle.deploy();
    await mockOracle.deployed();

    const UniswapV3AdapterOracle = await ethers.getContractFactory(
      CONTRACT_NAMES.UniswapV3AdapterOracle,
      {
        libraries: {
          UniV3WrappedLibMockup: LibInstance.address
        }
      }
    );
    uniswapV3Oracle = <UniswapV3AdapterOracle>(
      await UniswapV3AdapterOracle.deploy(mockOracle.address)
    );
    await uniswapV3Oracle.deployed();
  });

  describe("Owner", () => {
    it("should be able to set stable pools", async () => {
      await expect(
        uniswapV3Oracle.connect(alice).setStablePools(
          [ADDRESS.UNI, ADDRESS.ICHI],
          [ADDRESS.UNI_V3_UNI_USDC, ADDRESS.UNI_V3_ICHI_USDC]
        )
      ).to.be.revertedWith('Ownable: caller is not the owner');

      await expect(
        uniswapV3Oracle.setStablePools(
          [ADDRESS.UNI],
          [ADDRESS.UNI_V3_UNI_USDC, ADDRESS.UNI_V3_ICHI_USDC]
        )
      ).to.be.revertedWith('INPUT_ARRAY_MISMATCH');

      await expect(
        uniswapV3Oracle.setStablePools(
          [ADDRESS.UNI, ethers.constants.AddressZero],
          [ADDRESS.UNI_V3_UNI_USDC, ADDRESS.UNI_V3_ICHI_USDC]
        )
      ).to.be.revertedWith('ZERO_ADDRESS');

      await expect(
        uniswapV3Oracle.setStablePools(
          [ADDRESS.UNI, ADDRESS.ICHI],
          [ADDRESS.UNI_V3_UNI_USDC, ethers.constants.AddressZero]
        )
      ).to.be.revertedWith('ZERO_ADDRESS');

      await expect(
        uniswapV3Oracle.setStablePools(
          [ADDRESS.CRV],
          [ADDRESS.UNI_V3_UNI_USDC]
        )
      ).to.be.revertedWith('NO_STABLEPOOL');

      await expect(
        uniswapV3Oracle.setStablePools(
          [ADDRESS.UNI, ADDRESS.ICHI],
          [ADDRESS.UNI_V3_UNI_USDC, ADDRESS.UNI_V3_ICHI_USDC]
        )
      ).to.be.emit(uniswapV3Oracle, "SetPoolStable");

      const stablePool = await uniswapV3Oracle.stablePools(ADDRESS.UNI);
      expect(stablePool).to.be.equal(ADDRESS.UNI_V3_UNI_USDC);
    })
    it("should be able to set times ago", async () => {
      await expect(
        uniswapV3Oracle.connect(alice).setTimeGap(
          [ADDRESS.UNI, ADDRESS.ICHI],
          [3600, 3600]
        )
      ).to.be.revertedWith('Ownable: caller is not the owner');

      await expect(
        uniswapV3Oracle.setTimeGap(
          [ADDRESS.UNI, ADDRESS.ICHI],
          [3600, 3600, 3600]
        )
      ).to.be.revertedWith('INPUT_ARRAY_MISMATCH');

      await expect(
        uniswapV3Oracle.setTimeGap(
          [ADDRESS.UNI, ethers.constants.AddressZero],
          [3600, 3600]
        )
      ).to.be.revertedWith('ZERO_ADDRESS');

      await expect(
        uniswapV3Oracle.setTimeGap(
          [ADDRESS.UNI, ADDRESS.ICHI],
          [3600, 5]
        )
      ).to.be.revertedWith('TOO_LOW_MEAN');

      await expect(
        uniswapV3Oracle.setTimeGap(
          [ADDRESS.UNI, ADDRESS.ICHI],
          [3600, 3600]
        )
      ).to.be.emit(uniswapV3Oracle, "SetTimeGap");

      expect(await uniswapV3Oracle.timeGaps(ADDRESS.UNI)).to.be.equal(3600);
    })
  })

  describe("Price Feeds", () => {
    beforeEach(async () => {
      await mockOracle.setPrice(
        [ADDRESS.USDC],
        [BigNumber.from(10).pow(18)]  // $1
      )
      await uniswapV3Oracle.setStablePools(
        [ADDRESS.UNI, ADDRESS.ICHI, ADDRESS.CRV],
        [ADDRESS.UNI_V3_UNI_USDC, ADDRESS.UNI_V3_ICHI_USDC, ADDRESS.UNI_V3_USDC_CRV]
      );
      await uniswapV3Oracle.setTimeGap(
        [ADDRESS.UNI, ADDRESS.ICHI, ADDRESS.CRV],
        [3600, 3600, 3600] // timeAgo - 1 hour
      );
    })

    it("should revert when mean time is not set", async () => {
      await expect(
        uniswapV3Oracle.getPrice(ADDRESS.USDC)
      ).to.be.revertedWith('NO_MEAN');
    })
    it("should revert when stable pool is not set", async () => {
      await uniswapV3Oracle.setTimeGap([ADDRESS.USDC], [3600]);
      await expect(
        uniswapV3Oracle.getPrice(ADDRESS.USDC)
      ).to.be.revertedWith('NO_STABLEPOOL');
    })
    it('$UNI Price', async () => {
      const price = await uniswapV3Oracle.getPrice(ADDRESS.UNI);
      console.log(utils.formatUnits(price, 18));
    });
    it('$ICHI Price', async () => {
      const price = await uniswapV3Oracle.getPrice(ADDRESS.ICHI);
      console.log(utils.formatUnits(price, 18));
    });
  })
});
