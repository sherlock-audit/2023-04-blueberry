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

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import "./utils/BlueBerryConst.sol" as Constants;
import "./utils/BlueBerryErrors.sol" as Errors;
import "./interfaces/IProtocolConfig.sol";

/**
 * @title ProtocolConfig
 * @author BlueberryProtocol
 * @notice Hotspot of all configurable states of the protocol
 */
contract ProtocolConfig is OwnableUpgradeable, IProtocolConfig {
    // Protocol
    IFeeManager public feeManager;

    // Leveraging Fee
    uint256 public depositFee;
    uint256 public withdrawFee;
    uint256 public rewardFee;

    // Liquidity Vault SoftVault Fee
    uint256 public withdrawVaultFee;
    uint256 public withdrawVaultFeeWindow;
    uint256 public withdrawVaultFeeWindowStartTime;

    /// @dev Slippage of converting withdrawn reserves to debt tokens when closing position
    uint256 public maxSlippageOfClose;

    uint256 public treasuryFeeRate;
    uint256 public blbStablePoolFeeRate;
    uint256 public blbIchiVaultFeeRate;

    address public treasury;
    address public blbUsdcIchiVault;
    /// @dev $BLB liquidity pool against stablecoins
    address public blbStabilityPool;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address treasury_) external initializer {
        __Ownable_init();
        if (treasury_ == address(0)) revert Errors.ZERO_ADDRESS();
        treasury = treasury_;

        depositFee = 50; // 0.5% as default, base 10000
        withdrawFee = 50; // 0.5% as default, base 10000
        rewardFee = 1000; // 10% as default, base 10000

        treasuryFeeRate = 3000; // 30% of deposit/withdraw fee => 0.15%
        blbStablePoolFeeRate = 3500; //  35% of deposit/withdraw fee => 0.175%
        blbIchiVaultFeeRate = 3500; //  35% of deposit/withdraw fee => 0.175%

        withdrawVaultFee = 100; // 1% as default, base 10000
        withdrawVaultFeeWindow = 60 days; // Liquidity boot strapping event per vault

        maxSlippageOfClose = 300; // 3% of Max Slippage as default, base 10000
    }

    function startVaultWithdrawFee() external onlyOwner {
        if (withdrawVaultFeeWindowStartTime > 0)
            revert Errors.FEE_WINDOW_ALREADY_STARTED();
        withdrawVaultFeeWindowStartTime = block.timestamp;
    }

    /**
     * @dev Owner priviledged function to set deposit fee
     */
    function setDepositFee(uint256 depositFee_) external onlyOwner {
        // Cap to 20%
        if (depositFee_ > Constants.MAX_FEE_RATE)
            revert Errors.RATIO_TOO_HIGH(depositFee_);
        depositFee = depositFee_;
    }
    /**
     *  @dev Owner priviledged function to set withdraw fee 
     */
    function setWithdrawFee(uint256 withdrawFee_) external onlyOwner {
        // Cap to 20%
        if (withdrawFee_ > Constants.MAX_FEE_RATE)
            revert Errors.RATIO_TOO_HIGH(withdrawFee_);
        withdrawFee = withdrawFee_;
    }

    /**
     * @dev Owner priviledged function to set withdraw vault fee window 
     */
    function setWithdrawVaultFeeWindow(uint256 withdrawVaultFeeWindow_) external onlyOwner {
        // Cap to 60 days
        if (withdrawVaultFeeWindow_ > Constants.MAX_WITHDRAW_VAULT_FEE_WINDOW)
            revert Errors.FEE_WINDOW_TOO_LONG(withdrawVaultFeeWindow_);
        withdrawVaultFeeWindow = withdrawVaultFeeWindow_;
    }

    /**
     * @dev Owner priviledged function to set maximum slippage to close a position 
     */
    function setMaxSlippageOfClose(uint256 slippage_) external onlyOwner {
        // Cap to 20%
        if (maxSlippageOfClose > Constants.MAX_FEE_RATE)
            revert Errors.RATIO_TOO_HIGH(slippage_);
        maxSlippageOfClose = slippage_;
    }

    /**
     * @dev Owner priviledged function to set reward fee 
     */
    function setRewardFee(uint256 rewardFee_) external onlyOwner {
        // Cap to 20%
        if (rewardFee_ > Constants.MAX_FEE_RATE)
            revert Errors.RATIO_TOO_HIGH(rewardFee_);
        rewardFee = rewardFee_;
    }

    /**
     * @dev Owner priviledged function to set fee distribution  
     */
    function setFeeDistribution(
        uint256 treasuryFeeRate_,
        uint256 blbStablePoolFeeRate_,
        uint256 blbIchiVaultFeeRate_
    ) external onlyOwner {
        if (
            (treasuryFeeRate_ + blbStablePoolFeeRate_ + blbIchiVaultFeeRate_) !=
            Constants.DENOMINATOR
        ) revert Errors.INVALID_FEE_DISTRIBUTION();
        treasuryFeeRate = treasuryFeeRate_;
        blbStablePoolFeeRate = blbStablePoolFeeRate_;
        blbIchiVaultFeeRate = blbIchiVaultFeeRate_;
    }

    /**
     * @dev Owner priviledged function to set treasury wallet address
     */
    function setTreasuryWallet(address treasury_) external onlyOwner {
        if (treasury_ == address(0)) revert Errors.ZERO_ADDRESS();
        treasury = treasury_;
    }

    /**
     * @dev Owner priviledged function to set fee manager address
     */
    function setFeeManager(address feeManager_) external onlyOwner {
        if (feeManager_ == address(0)) revert Errors.ZERO_ADDRESS();
        feeManager = IFeeManager(feeManager_);
    }

    function setBlbUsdcIchiVault(address vault_) external onlyOwner {
        if (vault_ == address(0)) revert Errors.ZERO_ADDRESS();
        blbUsdcIchiVault = vault_;
    }

    /**
     * @dev Owner priviledged function to set blb stability pool address
     */
    function setBlbStabilityPool(address pool_) external onlyOwner {
        if (pool_ == address(0)) revert Errors.ZERO_ADDRESS();
        blbStabilityPool = pool_;
    }
}
