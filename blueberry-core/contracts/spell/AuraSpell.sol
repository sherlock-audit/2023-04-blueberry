// SPDX-License-Identifier: MIT
/*
██████╗ ██╗     ██╗   ██╗███████╗██████╗ ███████╗██████╗ ██████╗ ██╗   ██╗
██╔══██╗██║     ██║   ██║██╔════╝██╔══██╗██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝
██████╔╝██║     ██║   ██║█████╗  ██████╔╝█████╗  ██████╔╝██████╔╝ ╚████╔╝
██╔══██╗██║     ██║   ██║██╔══╝  ██╔══██╗██╔══╝  ██╔══██╗██╔══██╗  ╚██╔╝
██████╔╝███████╗╚██████╔╝███████╗██████╔╝███████╗██║  ██║██║  ██║   ██║
╚═════╝ ╚══════╝ ╚═════╝ ╚══════╝╚═════╝ ╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝
*/

pragma solidity 0.8.16;

import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";

import "./BasicSpell.sol";
import "../interfaces/ICurveOracle.sol";
import "../interfaces/IWAuraPools.sol";
import "../interfaces/balancer/IBalancerPool.sol";
import "../interfaces/uniswap/IUniswapV2Router02.sol";

/**
 * @title AuraSpell
 * @author BlueberryProtocol
 * @notice AuraSpell is the factory contract that
 * defines how Blueberry Protocol interacts with Aura pools
 */
contract AuraSpell is BasicSpell {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    /// @dev Address to Wrapped Aura Pools
    IWAuraPools public wAuraPools;
    /// @dev address of CurveOracle
    ICurveOracle public crvOracle;
    /// @dev address of AURA token
    address public AURA;

    function initialize(
        IBank bank_,
        address werc20_,
        address weth_,
        address wAuraPools_
    ) external initializer {
        __BasicSpell_init(bank_, werc20_, weth_);
        if (wAuraPools_ == address(0)) revert Errors.ZERO_ADDRESS();

        wAuraPools = IWAuraPools(wAuraPools_);
        AURA = address(wAuraPools.AURA());
        IWAuraPools(wAuraPools_).setApprovalForAll(address(bank_), true);
    }

    /**
     * @notice Add strategy to the spell
     * @param bpt Address of Balaner Pool Token
     * @param maxPosSize, USD price of maximum position size for given strategy, based 1e18
     */
    function addStrategy(address bpt, uint256 maxPosSize) external onlyOwner {
        _addStrategy(bpt, maxPosSize);
    }

    /**
     * @notice Add liquidity to Balancer pool, with staking to Aura
     */
    function openPositionFarm(
        OpenPosParam calldata param
    )
        external
        existingStrategy(param.strategyId)
        existingCollateral(param.strategyId, param.collToken)
    {
        Strategy memory strategy = strategies[param.strategyId];
        (address lpToken, ) = wAuraPools.getPool(
            strategy.vault,
            param.farmingPoolId
        );
        if (strategy.vault != lpToken) revert Errors.INCORRECT_LP(lpToken);

        // 1. Deposit isolated collaterals on Blueberry Money Market
        _doLend(param.collToken, param.collAmount);

        // 2. Borrow specific amounts
        uint256 borrowBalance = _doBorrow(
            param.borrowToken,
            param.borrowAmount
        );

        // 3. Add liquidity on Balancer, get BPT
        {
            IBalancerVault vault = wAuraPools.getVault(lpToken);
            _ensureApprove(param.borrowToken, address(vault), borrowBalance);

            (address[] memory tokens, uint256[] memory balances, ) = wAuraPools
                .getPoolTokens(lpToken);
            uint[] memory maxAmountsIn = new uint[](2);
            maxAmountsIn[0] = IERC20(tokens[0]).balanceOf(address(this));
            maxAmountsIn[1] = IERC20(tokens[1]).balanceOf(address(this));

            uint totalLPSupply = IBalancerPool(lpToken).totalSupply();
            // compute in reverse order of how Balancer's `joinPool` computes tokenAmountIn
            uint poolAmountFromA = (maxAmountsIn[0] * totalLPSupply) /
                balances[0];
            uint poolAmountFromB = (maxAmountsIn[1] * totalLPSupply) /
                balances[1];
            uint poolAmountOut = poolAmountFromA > poolAmountFromB
                ? poolAmountFromB
                : poolAmountFromA;

            bytes32 poolId = bytes32(param.farmingPoolId);
            if (poolAmountOut > 0) {
                vault.joinPool(
                    poolId,
                    address(this),
                    address(this),
                    IBalancerVault.JoinPoolRequest(
                        tokens,
                        maxAmountsIn,
                        "",
                        false
                    )
                );
            }
        }

        // 4. Validate MAX LTV
        _validateMaxLTV(param.strategyId);

        // 5. Validate Max Pos Size
        _validateMaxPosSize(param.strategyId);

        // 6. Take out existing collateral and burn
        IBank.Position memory pos = bank.getCurrentPositionInfo();
        if (pos.collateralSize > 0) {
            (uint256 pid, ) = wAuraPools.decodeId(pos.collId);
            if (param.farmingPoolId != pid)
                revert Errors.INCORRECT_PID(param.farmingPoolId);
            if (pos.collToken != address(wAuraPools))
                revert Errors.INCORRECT_COLTOKEN(pos.collToken);
            bank.takeCollateral(pos.collateralSize);
            wAuraPools.burn(pos.collId, pos.collateralSize);
            _doRefundRewards(AURA);
        }

        // 7. Deposit on Aura Pool, Put wrapped collateral tokens on Blueberry Bank
        uint256 lpAmount = IERC20Upgradeable(lpToken).balanceOf(address(this));
        _ensureApprove(lpToken, address(wAuraPools), lpAmount);
        uint256 id = wAuraPools.mint(param.farmingPoolId, lpAmount);
        bank.putCollateral(address(wAuraPools), id, lpAmount);
    }

    function closePositionFarm(
        ClosePosParam calldata param,
        IUniswapV2Router02 swapRouter,
        address[][] calldata swapPath
    )
        external
        existingStrategy(param.strategyId)
        existingCollateral(param.strategyId, param.collToken)
    {
        address lpToken = strategies[param.strategyId].vault;
        IBank.Position memory pos = bank.getCurrentPositionInfo();
        if (pos.collToken != address(wAuraPools))
            revert Errors.INCORRECT_COLTOKEN(pos.collToken);
        if (wAuraPools.getUnderlyingToken(pos.collId) != lpToken)
            revert Errors.INCORRECT_UNDERLYING(lpToken);

        // 1. Take out collateral - Burn wrapped tokens, receive BPT tokens and harvest AURA
        bank.takeCollateral(param.amountPosRemove);
        (address[] memory rewardTokens, ) = wAuraPools.burn(
            pos.collId,
            param.amountPosRemove
        );

        {
            // 2. Calculate actual amount to remove
            uint256 amountPosRemove = param.amountPosRemove;
            if (amountPosRemove == type(uint256).max) {
                amountPosRemove = IERC20Upgradeable(lpToken).balanceOf(
                    address(this)
                );
            }

            // 3. Remove liquidity
            (address[] memory tokens, , ) = wAuraPools.getPoolTokens(lpToken);
            uint[] memory minAmountsOut = new uint[](2);
            wAuraPools.getVault(lpToken).exitPool(
                IBalancerPool(lpToken).getPoolId(),
                address(this),
                address(this),
                IBalancerVault.ExitPoolRequest(tokens, minAmountsOut, "", false)
            );
        }

        // 4. Swap rewards tokens to debt token
        for (uint256 i = 0; i < rewardTokens.length; i++) {
            uint256 rewards = _doCutRewardsFee(rewardTokens[i]);
            _ensureApprove(rewardTokens[i], address(swapRouter), rewards);
            swapRouter.swapExactTokensForTokens(
                rewards,
                0,
                swapPath[i],
                address(this),
                type(uint256).max
            );
        }

        // 5. Withdraw isolated collateral from Bank
        _doWithdraw(param.collToken, param.amountShareWithdraw);

        // 6. Repay
        {
            // Compute repay amount if MAX_INT is supplied (max debt)
            uint256 amountRepay = param.amountRepay;
            if (amountRepay == type(uint256).max) {
                amountRepay = bank.currentPositionDebt(bank.POSITION_ID());
            }
            _doRepay(param.borrowToken, amountRepay);
        }

        _validateMaxLTV(param.strategyId);

        // 7. Refund
        _doRefund(param.borrowToken);
        _doRefund(param.collToken);
        _doRefund(AURA);
    }
}
