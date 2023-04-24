import chai, { expect } from "chai";
import { BigNumber } from "ethers";
import { ethers, upgrades } from "hardhat";
import { ADDRESS } from "../../constant";
import { MockIchiFarm, WIchiFarm } from "../../typechain-types";

import { solidity } from 'ethereum-waffle'

chai.use(solidity)

const USDC = ADDRESS.USDC;

describe("Wrapped Ichi Farm", () => {
  let ichiFarm: MockIchiFarm;
  let wichi: WIchiFarm;

  before(async () => {
    const MockIchiFarm = await ethers.getContractFactory("MockIchiFarm");
    ichiFarm = <MockIchiFarm>await MockIchiFarm.deploy(
      ADDRESS.ICHI_FARM,
      ethers.utils.parseUnits("1", 9) // 1 ICHI.FARM per block
    );
    const WIchiFarm = await ethers.getContractFactory("WIchiFarm");
    wichi = <WIchiFarm>await upgrades.deployProxy(WIchiFarm, [
      ADDRESS.ICHI,
      ADDRESS.ICHI_FARM,
      ichiFarm.address
    ]);
    await wichi.deployed();
  })

  describe("Constructor", () => {
    it("should revert when zero address is provided in params", async () => {
      const WIchiFarm = await ethers.getContractFactory("WIchiFarm");
      await expect(
        upgrades.deployProxy(WIchiFarm, [
          ethers.constants.AddressZero,
          ADDRESS.ICHI_FARM,
          ichiFarm.address
        ])
      ).to.be.revertedWith("ZERO_ADDRESS");
      await expect(
        upgrades.deployProxy(WIchiFarm, [
          ADDRESS.ICHI,
          ethers.constants.AddressZero,
          ichiFarm.address
        ])
      ).to.be.revertedWith("ZERO_ADDRESS");
      await expect(
        upgrades.deployProxy(WIchiFarm, [
          ADDRESS.ICHI,
          ADDRESS.ICHI_FARM,
          ethers.constants.AddressZero,
        ])
      ).to.be.revertedWith("ZERO_ADDRESS");
    })
    it("should revert initializing twice", async () => {
      await expect(
        wichi.initialize(
          ADDRESS.ICHI,
          ADDRESS.ICHI_FARM,
          ichiFarm.address
        )
      ).to.be.revertedWith("Initializable: contract is already initialized")
    })
  })

  it("should encode pool id and reward per share to tokenId", async () => {
    const poolId = BigNumber.from(10);
    const rewardPerShare = BigNumber.from(10000);

    await expect(
      wichi.encodeId(BigNumber.from(2).pow(16), rewardPerShare)
    ).to.be.revertedWith("BAD_PID");

    await expect(
      wichi.encodeId(poolId, BigNumber.from(2).pow(240))
    ).to.be.revertedWith("BAD_REWARD_PER_SHARE");

    const tokenId = await wichi.encodeId(poolId, rewardPerShare);
    expect(tokenId).to.be.equal(BigNumber.from(2).pow(240).mul(poolId).add(rewardPerShare));
  })
})