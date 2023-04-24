import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers, upgrades } from "hardhat";
import chai, { expect } from "chai";
import { FeeManager, MockERC20, ProtocolConfig } from "../typechain-types";
import { ADDRESS } from "../constant";
import { solidity } from 'ethereum-waffle'
import { BigNumber, utils } from "ethers";
import { roughlyNear } from "./assertions/roughlyNear";
import { near } from "./assertions/near";

chai.use(solidity);
chai.use(roughlyNear);
chai.use(near);

const USDC = ADDRESS.USDC;
const WETH = ADDRESS.WETH;

describe("Fee Manager", () => {
  let admin: SignerWithAddress;
  let alice: SignerWithAddress;
  let treasury: SignerWithAddress;

  let mockToken: MockERC20;
  let config: ProtocolConfig;
  let feeManager: FeeManager;

  before(async () => {
    [admin, alice, treasury] = await ethers.getSigners();

    const ProtocolConfig = await ethers.getContractFactory("ProtocolConfig");
    config = <ProtocolConfig>await upgrades.deployProxy(ProtocolConfig, [treasury.address]);

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    mockToken = await MockERC20.deploy("Mock Token", "MOCK", 18);
    await mockToken.deployed()
    await mockToken.mint();
  })

  beforeEach(async () => {
    const FeeManager = await ethers.getContractFactory("FeeManager");
    feeManager = <FeeManager>await upgrades.deployProxy(FeeManager, [config.address]);
  })

  describe("Constructor", () => {
    it("should revert initializing twice", async () => {
      await expect(
        feeManager.initialize(config.address)
      ).to.be.revertedWith("Initializable: contract is already initialized")
    })
    it("should revert deployment when zero address provided as config address", async () => {
      const FeeManager = await ethers.getContractFactory("FeeManager");
      await expect(
        upgrades.deployProxy(FeeManager, [ethers.constants.AddressZero])
      ).to.be.revertedWith("ZERO_ADDRESS");
    })
  })

  it("should cut fee and transfer to treasury wallet", async () => {
    const beforeBalance = await mockToken.balanceOf(admin.address);
    await mockToken.approve(feeManager.address, beforeBalance);

    await feeManager.doCutRewardsFee(mockToken.address, beforeBalance);
    const rewardsFee = await config.rewardFee();

    const afterBalance = await mockToken.balanceOf(admin.address);
    expect(afterBalance).to.be.equal(beforeBalance.sub(beforeBalance.mul(rewardsFee).div(10000)))

    await feeManager.doCutRewardsFee(mockToken.address, 0);
    expect(await mockToken.balanceOf(admin.address)).to.be.equal(afterBalance)
  })
})