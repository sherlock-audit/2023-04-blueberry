import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
  BlueBerryBank,
  IWETH,
  MockOracle,
  WERC20,
  WCurveGauge,
  ERC20,
  CurveSpell,
  CurveOracle,
  ConvexSpell,
  WConvexPools,
  ICvxPools,
  IRewarder
} from '../../typechain-types';
import { ethers, upgrades } from "hardhat";
import { ADDRESS, CONTRACT_NAMES } from "../../constant";
import { CvxProtocol, setupCvxProtocol, evm_mine_blocks } from "../helpers";
import SpellABI from '../../abi/ConvexSpell.json';
import chai, { expect } from "chai";
import { solidity } from 'ethereum-waffle'
import { near } from '../assertions/near'
import { roughlyNear } from '../assertions/roughlyNear'
import { BigNumber, utils } from "ethers";

chai.use(solidity)
chai.use(near)
chai.use(roughlyNear)

const CUSDC = ADDRESS.bUSDC;
const CDAI = ADDRESS.bDAI;
const CCRV = ADDRESS.bCRV;
const WETH = ADDRESS.WETH;
const USDC = ADDRESS.USDC;
const DAI = ADDRESS.DAI;
const CRV = ADDRESS.CRV;
const ETH_PRICE = 1600;
const GAUGE_ID = ADDRESS.CRV_GAUGE_3CrvId;

describe("Convex Spell", () => {
  let admin: SignerWithAddress;
  let alice: SignerWithAddress;
  let treasury: SignerWithAddress;

  let usdc: ERC20;
  let dai: ERC20;
  let crv: ERC20;
  let weth: IWETH;
  let werc20: WERC20;
  let mockOracle: MockOracle;
  let spell: ConvexSpell;
  let curveOracle: CurveOracle;
  let wconvex: WConvexPools;
  let bank: BlueBerryBank;
  let protocol: CvxProtocol;
  let cvxBooster: ICvxPools;
  let crvRewarder: IRewarder;

  before(async () => {
    [admin, alice, treasury] = await ethers.getSigners();
    usdc = <ERC20>await ethers.getContractAt("ERC20", USDC);
    dai = <ERC20>await ethers.getContractAt("ERC20", DAI);
    crv = <ERC20>await ethers.getContractAt("ERC20", CRV);
    usdc = <ERC20>await ethers.getContractAt("ERC20", USDC);
    weth = <IWETH>await ethers.getContractAt(CONTRACT_NAMES.IWETH, WETH);
    cvxBooster = <ICvxPools>await ethers.getContractAt("ICvxPools", ADDRESS.CVX_BOOSTER)
    const poolInfo = await cvxBooster.poolInfo(ADDRESS.CVX_3Crv_Id)
    crvRewarder = <IRewarder>await ethers.getContractAt("IRewarder", poolInfo.crvRewards)

    protocol = await setupCvxProtocol();
    bank = protocol.bank;
    spell = protocol.convexSpell;
    wconvex = protocol.wconvex;
    werc20 = protocol.werc20;
    mockOracle = protocol.mockOracle;
    curveOracle = protocol.curveOracle;
  })

  describe("Constructor", () => {
    it("should revert when zero address is provided in param", async () => {
      const ConvexSpell = await ethers.getContractFactory(CONTRACT_NAMES.ConvexSpell);
      await expect(
        upgrades.deployProxy(ConvexSpell, [
          ethers.constants.AddressZero,
          werc20.address,
          WETH,
          wconvex.address,
          curveOracle.address
        ])
      ).to.be.revertedWith("ZERO_ADDRESS");
      await expect(
        upgrades.deployProxy(ConvexSpell, [
          bank.address,
          ethers.constants.AddressZero,
          WETH,
          wconvex.address,
          curveOracle.address
        ])
      ).to.be.revertedWith("ZERO_ADDRESS");
      await expect(
        upgrades.deployProxy(ConvexSpell, [
          bank.address,
          werc20.address,
          ethers.constants.AddressZero,
          wconvex.address,
          curveOracle.address
        ])
      ).to.be.revertedWith("ZERO_ADDRESS");
      await expect(
        upgrades.deployProxy(ConvexSpell, [
          bank.address,
          werc20.address,
          WETH,
          ethers.constants.AddressZero,
          curveOracle.address
        ])
      ).to.be.revertedWith("ZERO_ADDRESS");
      await expect(
        upgrades.deployProxy(ConvexSpell, [
          bank.address,
          werc20.address,
          WETH,
          wconvex.address,
          ethers.constants.AddressZero
        ])
      ).to.be.revertedWith("ZERO_ADDRESS");
    })
    it("should revert initializing twice", async () => {
      await expect(
        spell.initialize(
          bank.address,
          werc20.address,
          WETH,
          ethers.constants.AddressZero,
          curveOracle.address
        )
      ).to.be.revertedWith("Initializable: contract is already initialized")
    })
  })

  describe("Convex Pool Farming Position", () => {
    const depositAmount = utils.parseUnits('100', 18); // CRV => $100
    const borrowAmount = utils.parseUnits('250', 6);	 // USDC
    const iface = new ethers.utils.Interface(SpellABI);

    before(async () => {
      await usdc.approve(bank.address, ethers.constants.MaxUint256);
      await crv.approve(bank.address, ethers.constants.MaxUint256);
    })

    it("should revert when opening position exceeds max LTV", async () => {
      await expect(bank.execute(
        0,
        spell.address,
        iface.encodeFunctionData("openPositionFarm", [{
          strategyId: 0,
          collToken: CRV,
          borrowToken: USDC,
          collAmount: depositAmount,
          borrowAmount: borrowAmount.mul(4),
          farmingPoolId: GAUGE_ID
        }, 0])
      )).to.be.revertedWith("EXCEED_MAX_LTV");
    })
    it("should revert when opening a position for non-existing strategy", async () => {
      await expect(
        bank.execute(
          0,
          spell.address,
          iface.encodeFunctionData("openPositionFarm", [{
            strategyId: 5,
            collToken: CRV,
            borrowToken: USDC,
            collAmount: depositAmount,
            borrowAmount: borrowAmount,
            farmingPoolId: GAUGE_ID
          }, 0])
        )
      ).to.be.revertedWith("STRATEGY_NOT_EXIST")
    })
    it("should revert when opening a position for non-existing collateral", async () => {
      await expect(
        bank.execute(
          0,
          spell.address,
          iface.encodeFunctionData("openPositionFarm", [{
            strategyId: 0,
            collToken: WETH,
            borrowToken: USDC,
            collAmount: depositAmount,
            borrowAmount: borrowAmount,
            farmingPoolId: GAUGE_ID
          }, 0])
        )
      ).to.be.revertedWith("COLLATERAL_NOT_EXIST")
    })
    it("should revert when opening a position for incorrect farming pool id", async () => {
      await expect(
        bank.execute(
          0,
          spell.address,
          iface.encodeFunctionData("openPositionFarm", [{
            strategyId: 0,
            collToken: CRV,
            borrowToken: USDC,
            collAmount: depositAmount,
            borrowAmount: borrowAmount,
            farmingPoolId: GAUGE_ID + 1
          }, 0])
        )
      ).to.be.revertedWith("INCORRECT_LP")
    })
    it("should be able to farm USDC on Convex", async () => {
      const positionId = await bank.nextPositionId();
      const beforeTreasuryBalance = await crv.balanceOf(treasury.address);
      await bank.execute(
        0,
        spell.address,
        iface.encodeFunctionData("openPositionFarm", [{
          strategyId: 0,
          collToken: CRV,
          borrowToken: USDC,
          collAmount: depositAmount,
          borrowAmount: borrowAmount,
          farmingPoolId: GAUGE_ID
        }, 0])
      )

      const bankInfo = await bank.getBankInfo(USDC);
      console.log("USDC Bank Info:", bankInfo);

      const pos = await bank.positions(positionId);
      console.log("Position Info:", pos)
      console.log("Position Value:", await bank.getPositionValue(1));
      expect(pos.owner).to.be.equal(admin.address);
      expect(pos.collToken).to.be.equal(wconvex.address);
      expect(pos.debtToken).to.be.equal(USDC);
      expect(pos.collateralSize.gt(ethers.constants.Zero)).to.be.true;
      // expect(
      //   await wgauge.balanceOf(bank.address, collId)
      // ).to.be.equal(pos.collateralSize);

      const afterTreasuryBalance = await crv.balanceOf(treasury.address);
      expect(
        afterTreasuryBalance.sub(beforeTreasuryBalance)
      ).to.be.equal(depositAmount.mul(50).div(10000))

      const rewarderBalance = await crvRewarder.balanceOf(wconvex.address);
      expect(rewarderBalance).to.be.equal(pos.collateralSize);
    })
    it("should be able to get position risk ratio", async () => {
      let risk = await bank.getPositionRisk(1);
      let pv = await bank.getPositionValue(1);
      let ov = await bank.getDebtValue(1);
      let cv = await bank.getIsolatedCollateralValue(1);
      console.log("PV:", utils.formatUnits(pv));
      console.log("OV:", utils.formatUnits(ov));
      console.log("CV:", utils.formatUnits(cv));
      console.log('Prev Position Risk', utils.formatUnits(risk, 2), '%');
      await mockOracle.setPrice(
        [USDC, CRV],
        [
          BigNumber.from(10).pow(17).mul(15), // $1
          BigNumber.from(10).pow(17).mul(5), // $0.4
        ]
      );
      risk = await bank.getPositionRisk(1);
      pv = await bank.getPositionValue(1);
      ov = await bank.getDebtValue(1);
      cv = await bank.getIsolatedCollateralValue(1);
      console.log("=======")
      console.log("PV:", utils.formatUnits(pv));
      console.log("OV:", utils.formatUnits(ov));
      console.log("CV:", utils.formatUnits(cv));
      console.log('Position Risk', utils.formatUnits(risk, 2), '%');
    })
    // TODO: Find another USDC curve pool
    // it("should revert increasing existing position when diff pos param given", async () => {
    //   const positionId = (await bank.nextPositionId()).sub(1);
    //   await expect(
    //     bank.execute(
    //       positionId,
    //       spell.address,
    //       iface.encodeFunctionData("openPositionFarm", [{
    //         strategyId: 1,
    //         collToken: CRV,
    //         borrowToken: USDC,
    //         collAmount: depositAmount,
    //         borrowAmount: borrowAmount,
    //         farmingPoolId: 0
    //       }, 0])
    //     )
    //   ).to.be.revertedWith("INCORRECT_PID")
    // })
    it("should be able to harvest on Convex", async () => {
      evm_mine_blocks(1000);
      const positionId = (await bank.nextPositionId()).sub(1);
      const position = await bank.positions(positionId);

      const totalEarned = await crvRewarder.earned(wconvex.address);
      console.log("Wrapper Total Earned:", utils.formatUnits(totalEarned))

      const pendingRewardsInfo = await wconvex.pendingRewards(position.collId, position.collateralSize);
      console.log("Pending Rewards", pendingRewardsInfo)

      // Manually transfer CRV rewards to spell
      await crv.transfer(spell.address, utils.parseUnits('10', 18));

      const beforeTreasuryBalance = await crv.balanceOf(treasury.address);
      const beforeUSDCBalance = await usdc.balanceOf(admin.address);
      const beforeCrvBalance = await crv.balanceOf(admin.address);

      const iface = new ethers.utils.Interface(SpellABI);
      await bank.execute(
        positionId,
        spell.address,
        iface.encodeFunctionData("closePositionFarm", [{
          strategyId: 0,
          collToken: CRV,
          borrowToken: USDC,
          amountRepay: ethers.constants.MaxUint256,
          amountPosRemove: ethers.constants.MaxUint256,
          amountShareWithdraw: ethers.constants.MaxUint256,
          sellSlippage: 50,
          sqrtRatioLimit: 0
        }, ADDRESS.SUSHI_ROUTER, [[CRV, WETH, USDC], [ADDRESS.FRAX, ADDRESS.SUSHI, USDC]]])
      )
      const afterUSDCBalance = await usdc.balanceOf(admin.address);
      const afterCrvBalance = await crv.balanceOf(admin.address);
      console.log('USDC Balance Change:', afterUSDCBalance.sub(beforeUSDCBalance));
      console.log('CRV Balance Change:', afterCrvBalance.sub(beforeCrvBalance));
      const depositFee = depositAmount.mul(50).div(10000);
      const withdrawFee = depositAmount.sub(depositFee).mul(50).div(10000);
      expect(afterCrvBalance.sub(beforeCrvBalance)).to.be.gte(depositAmount.sub(depositFee).sub(withdrawFee));

      const afterTreasuryBalance = await crv.balanceOf(treasury.address);
      // Plus rewards fee
      expect(afterTreasuryBalance.sub(beforeTreasuryBalance)).to.be.gte(withdrawFee);
    })
  })

})