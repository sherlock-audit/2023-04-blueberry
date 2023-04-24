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
import "@openzeppelin/contracts/utils/math/SafeCast.sol";

import "./BasicSpell.sol";

import "../interfaces/ISoftVault.sol";
import "../interfaces/IWERC20.sol";
import "../libraries/Paraswap/PSwapLib.sol";

/**
 * @title Short/Long Spell
 * @author BlueberryProtocol
 * @notice Short/Long Spell is the factory contract that
 * defines how Blueberry Protocol interacts for leveraging
 * an asset either long or short
 */
contract ShortLongSpell is BasicSpell {
    using SafeCast for uint256;
    using SafeCast for int256;
    using SafeERC20Upgradeable for IERC20Upgradeable;

    /// @dev WERC20
    IWERC20 public wrapper;

    /// @dev paraswap AugustusSwapper address
    address public augustusSwapper;

    /// @dev paraswap TokenTransferProxy address
    address public tokenTransferProxy;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        IBank bank_,
        address werc20_,
        address weth_,
        address augustusSwapper_,
        address tokenTransferProxy_
    ) external initializer {
        if (augustusSwapper_ == address(0)) revert Errors.ZERO_ADDRESS();
        if (tokenTransferProxy_ == address(0)) revert Errors.ZERO_ADDRESS();

        augustusSwapper = augustusSwapper_;
        tokenTransferProxy = tokenTransferProxy_;
        wrapper = IWERC20(werc20_);

        __BasicSpell_init(bank_, werc20_, weth_);
    }

    /**
     * @notice Internal function to swap token using paraswap assets
     * @dev Deposit isolated underlying to Blueberry Money Market,
     *      Borrow tokens from Blueberry Money Market,
     *      Swap borrowed token to another token
     *      Then deposit swapped token to softvault,
     *
     */
    function _deposit(
        OpenPosParam calldata param,
        Utils.MegaSwapSellData calldata swapData
    ) internal {
        Strategy memory strategy = strategies[param.strategyId];

        // 1. Deposit isolated collaterals on Blueberry Money Market
        _doLend(param.collToken, param.collAmount);

        // 2. Borrow specific amounts
        uint256 strTokenAmt = _doBorrow(param.borrowToken, param.borrowAmount);

        // 3. Swap borrowed token to strategy token
        IERC20Upgradeable swapToken = ISoftVault(strategy.vault).uToken();
        // swapData.fromAmount = strTokenAmt;
        PSwapLib.megaSwap(augustusSwapper, tokenTransferProxy, swapData);
        strTokenAmt = swapToken.balanceOf(address(this)) - strTokenAmt;
        if (strTokenAmt < swapData.expectedAmount)
            revert Errors.SWAP_FAILED(address(swapToken));

        // 4. Deposit to SoftVault directly
        _ensureApprove(
            address(swapToken),
            address(strategy.vault),
            strTokenAmt
        );
        ISoftVault(strategy.vault).deposit(strTokenAmt);

        // 5. Validate MAX LTV
        _validateMaxLTV(param.strategyId);

        // 6. Validate Max Pos Size
        _validateMaxPosSize(param.strategyId);
    }

    /**
     * @notice External function to deposit assets
     */
    function openPosition(
        OpenPosParam calldata param,
        Utils.MegaSwapSellData calldata swapData
    )
        external
        existingStrategy(param.strategyId)
        existingCollateral(param.strategyId, param.collToken)
    {
        Strategy memory strategy = strategies[param.strategyId];
        if (
            address(ISoftVault(strategy.vault).uToken()) != param.borrowToken ||
            swapData.fromToken != param.borrowToken
        ) revert Errors.INCORRECT_LP(param.borrowToken);

        // 1-3 Swap to strategy underlying token, deposit to softvault
        _deposit(param, swapData);

        // 4. Put collateral -
        {
            IBank.Position memory pos = bank.getCurrentPositionInfo();
            address posCollToken = pos.collToken;
            uint256 collSize = pos.collateralSize;
            address burnToken = address(ISoftVault(strategy.vault).uToken());
            if (collSize > 0) {
                if (posCollToken != address(wrapper))
                    revert Errors.INCORRECT_COLTOKEN(posCollToken);
                bank.takeCollateral(collSize);
                wrapper.burn(burnToken, collSize);
                _doRefund(burnToken);
            }
        }

        // 5. Put collateral - strategy token
        address vault = strategies[param.strategyId].vault;
        _doPutCollateral(
            vault,
            IERC20Upgradeable(ISoftVault(vault).uToken()).balanceOf(
                address(this)
            )
        );
    }

    /**
     * @notice Internal function to withdraw assets from SoftVault
     * @dev Withdraw assets from Soft Vault,
     *      Swap withdrawn assets to debt token,
     *      Withdraw isolated collaterals from Blueberry Money Market,
     *      Repay Debt and refund rest to user
     */
    function _withdraw(
        ClosePosParam calldata param,
        Utils.MegaSwapSellData calldata swapData
    ) internal {
        if (param.sellSlippage > bank.config().maxSlippageOfClose())
            revert Errors.RATIO_TOO_HIGH(param.sellSlippage);

        Strategy memory strategy = strategies[param.strategyId];
        ISoftVault vault = ISoftVault(strategy.vault);
        uint256 positionId = bank.POSITION_ID();

        // 1. Calculate actual amount to remove
        uint256 amountPosRemove = param.amountPosRemove;
        if (amountPosRemove == type(uint256).max) {
            amountPosRemove = vault.balanceOf(address(this));
        }

        // 2. Withdraw from softvault
        vault.withdraw(amountPosRemove);

        // 3. Swap strategy token to isolated collateral token
        {
            PSwapLib.megaSwap(augustusSwapper, tokenTransferProxy, swapData);
        }

        // 4. Withdraw isolated collateral from Bank
        _doWithdraw(param.collToken, param.amountShareWithdraw);

        // 5. Repay
        {
            uint256 amountRepay = param.amountRepay;
            if (amountRepay == type(uint256).max) {
                amountRepay = bank.currentPositionDebt(positionId);
            }
            _doRepay(param.borrowToken, amountRepay);
        }

        _validateMaxLTV(param.strategyId);

        // 6. Refund
        _doRefund(param.borrowToken);
        _doRefund(param.collToken);
    }

    /**
     * @notice External function to withdraw assets
     */
    function closePosition(
        ClosePosParam calldata param,
        Utils.MegaSwapSellData calldata swapData
    )
        external
        existingStrategy(param.strategyId)
        existingCollateral(param.strategyId, param.collToken)
    {
        Strategy memory strategy = strategies[param.strategyId];

        if (address(ISoftVault(strategy.vault).uToken()) != swapData.fromToken)
            revert Errors.INCORRECT_LP(swapData.fromToken);

        address vault = strategies[param.strategyId].vault;
        IBank.Position memory pos = bank.getCurrentPositionInfo();
        address posCollToken = pos.collToken;
        uint256 collId = pos.collId;
        if (IWERC20(posCollToken).getUnderlyingToken(collId) != vault)
            revert Errors.INCORRECT_UNDERLYING(vault);
        if (posCollToken != address(werc20))
            revert Errors.INCORRECT_COLTOKEN(posCollToken);

        // 1. Take out collateral
        bank.takeCollateral(param.amountPosRemove);
        werc20.burn(
            address(ISoftVault(strategy.vault).uToken()),
            param.amountPosRemove
        );

        // 2-7. Remove liquidity
        _withdraw(param, swapData);
    }

    /**
     * @notice Add strategy to the spell
     * @param swapToken Address of token for given strategy
     * @param maxPosSize, USD price of maximum position size for given strategy, based 1e18
     */
    function addStrategy(
        address swapToken,
        uint256 maxPosSize
    ) external onlyOwner {
        _addStrategy(swapToken, maxPosSize);
    }
}
