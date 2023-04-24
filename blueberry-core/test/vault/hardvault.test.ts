import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers, upgrades } from "hardhat";
import chai, { expect } from "chai";
import { ERC20, FeeManager, HardVault, IUniswapV2Router02, IWETH, ProtocolConfig } from "../../typechain-types";
import { ADDRESS, CONTRACT_NAMES } from "../../constant";
import { solidity } from 'ethereum-waffle'
import { BigNumber, utils } from "ethers";
import { roughlyNear } from "../assertions/roughlyNear";
import { near } from "../assertions/near";
import { evm_increaseTime } from "../helpers";

chai.use(solidity);
chai.use(roughlyNear);
chai.use(near);

const USDC = ADDRESS.USDC;
const WETH = ADDRESS.WETH;

describe("HardVault", () => {
  let admin: SignerWithAddress;
  let alice: SignerWithAddress;
  let bank: SignerWithAddress;
  let treasury: SignerWithAddress;

  let usdc: ERC20;
  let weth: IWETH;
  let vault: HardVault;
  let config: ProtocolConfig;

  before(async () => {
    [admin, alice, bank, treasury] = await ethers.getSigners();
    usdc = <ERC20>await ethers.getContractAt("ERC20", USDC, admin);
    weth = <IWETH>await ethers.getContractAt(CONTRACT_NAMES.IWETH, WETH);

    const ProtocolConfig = await ethers.getContractFactory("ProtocolConfig");
    config = <ProtocolConfig>await upgrades.deployProxy(ProtocolConfig, [treasury.address]);

    const FeeManager = await ethers.getContractFactory("FeeManager");
    const feeManager = <FeeManager>await upgrades.deployProxy(FeeManager, [config.address]);
    await feeManager.deployed()
    await config.setFeeManager(feeManager.address);
    await config.startVaultWithdrawFee();
  })

  beforeEach(async () => {
    const HardVault = await ethers.getContractFactory(CONTRACT_NAMES.HardVault);
    vault = <HardVault>await upgrades.deployProxy(HardVault, [config.address]);
    await vault.deployed();

    // deposit 50 eth -> 50 WETH
    await weth.deposit({ value: utils.parseUnits('50') });
    await weth.approve(ADDRESS.UNI_V2_ROUTER, ethers.constants.MaxUint256);

    // swap 50 weth -> usdc
    const uniV2Router = <IUniswapV2Router02>await ethers.getContractAt(
      CONTRACT_NAMES.IUniswapV2Router02,
      ADDRESS.UNI_V2_ROUTER
    );
    await uniV2Router.swapExactTokensForTokens(
      utils.parseUnits('50'),
      0,
      [WETH, USDC],
      admin.address,
      ethers.constants.MaxUint256
    )
  })

  describe("Constructor", () => {
    it("should revert when config address is invalid", async () => {
      const HardVault = await ethers.getContractFactory(CONTRACT_NAMES.HardVault);
      await expect(upgrades.deployProxy(HardVault, [
        ethers.constants.AddressZero,
      ])).to.be.revertedWith('ZERO_ADDRESS');

      expect(await vault.config()).to.be.equal(config.address);
    })
    it("should revert initializing twice", async () => {
      await expect(
        vault.initialize(config.address)
      ).to.be.revertedWith("Initializable: contract is already initialized")
    })
  })
  describe("Deposit", () => {
    const depositAmount = utils.parseUnits("100", 6);
    beforeEach(async () => {
    })
    it("should revert if deposit amount is zero", async () => {
      await expect(vault.deposit(USDC, 0)).to.be.revertedWith("ZERO_AMOUNT");
    })
    it("should be able to deposit underlying token on vault", async () => {
      await usdc.approve(vault.address, depositAmount);
      await expect(vault.deposit(USDC, depositAmount)).to.be.emit(vault, "Deposited");

      expect(await usdc.balanceOf(vault.address)).to.be.equal(depositAmount);

      const tokenID = BigNumber.from(USDC);
      const shareBalance = await vault.balanceOf(admin.address, tokenID);
      expect(shareBalance).to.be.equal(depositAmount);
    })
  })

  describe("Withdraw", () => {
    const depositAmount = utils.parseUnits("100", 6);
    const tokenId = BigNumber.from(USDC);

    beforeEach(async () => {
      await usdc.approve(vault.address, depositAmount);
      await vault.deposit(USDC, depositAmount);
    })

    it("should revert if withdraw amount is zero", async () => {
      await expect(vault.withdraw(USDC, 0)).to.be.revertedWith("ZERO_AMOUNT");
    })

    it("should cut withdraw fee when withdraw within withdraw fee window", async () => {
      const beforeUSDCBalance = await usdc.balanceOf(admin.address);
      const shareBalance = await vault.balanceOf(admin.address, tokenId);

      await expect(
        vault.withdraw(USDC, shareBalance)
      ).to.be.emit(vault, "Withdrawn");

      expect(await vault.balanceOf(admin.address, tokenId)).to.be.equal(0);

      const afterUSDCBalance = await usdc.balanceOf(admin.address);
      const feeRate = await config.withdrawVaultFee();
      const fee = depositAmount.mul(feeRate).div(10000);
      const treasuryBalance = await usdc.balanceOf(treasury.address);
      expect(treasuryBalance).to.be.near(fee);

      expect(afterUSDCBalance.sub(beforeUSDCBalance)).to.be.roughlyNear(depositAmount.sub(fee));
    })
    it("should not cut fee after withdraw fee window", async () => {
      await evm_increaseTime(60 * 60 * 24 * 100);
      const beforeUSDCBalance = await usdc.balanceOf(admin.address);
      const shareBalance = await vault.balanceOf(admin.address, tokenId);

      await expect(
        vault.withdraw(USDC, shareBalance)
      ).to.be.emit(vault, "Withdrawn");

      expect(await vault.balanceOf(admin.address, tokenId)).to.be.equal(0);

      const afterUSDCBalance = await usdc.balanceOf(admin.address);
      expect(afterUSDCBalance.sub(beforeUSDCBalance)).to.be.equal(depositAmount);
    })
  })

  describe("Utils", () => {
    const depositAmount = utils.parseUnits("100", 6);
    const tokenId = BigNumber.from(USDC);

    beforeEach(async () => {
      await usdc.approve(vault.address, depositAmount);
      await vault.deposit(USDC, depositAmount);
    })

    it("should return balance of underlying token", async () => {
      expect(await vault.balanceOfERC20(USDC, admin.address)).to.be.equal(depositAmount);
    })
    it("should return token id from uToken address", async () => {
      expect(await vault.getUnderlyingToken(tokenId)).to.be.equal(USDC);

      await expect(
        vault.getUnderlyingToken(ethers.constants.MaxUint256)
      ).to.be.revertedWith("INVALID_TOKEN_ID");
    })
  })
})