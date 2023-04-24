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

import "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import "../utils/BlueBerryErrors.sol" as Errors;
import "../utils/EnsureApprove.sol";
import "../interfaces/IERC20Wrapper.sol";
import "../interfaces/IWCurveGauge.sol";
import "../interfaces/curve/ILiquidityGauge.sol";

interface ILiquidityGaugeMinter {
    function mint(address gauge) external;
}

/**
 * @title WCurveGauge
 * @author BlueberryProtocol
 * @notice Wrapped Curve Gauge is the wrapper of Gauge positions
 * @dev Leveraged LP Tokens will be wrapped here and be held in BlueberryBank 
 *      and do not generate yields. LP Tokens are identified by tokenIds 
 *      encoded from lp token address.
 */
contract WCurveGauge is
    ERC1155Upgradeable,
    ReentrancyGuardUpgradeable,
    OwnableUpgradeable,
    EnsureApprove,
    IERC20Wrapper,
    IWCurveGauge
{
    using SafeERC20Upgradeable for IERC20Upgradeable;

    /// @dev Address of Curve Registry
    ICurveRegistry public registry;
    /// @dev Address of Curve Gauge Controller
    ICurveGaugeController public gaugeController;
    /// @dev Address of CRV token
    IERC20Upgradeable public CRV;
    /// @dev Mapping from gauge id to accCrvPerShare
    mapping(uint256 => uint256) public accCrvPerShares;

    function initialize(
        address crv_,
        address crvRegistry_,
        address gaugeController_
    ) external initializer {
        __ReentrancyGuard_init();
        __ERC1155_init("WCurveGauge");
        CRV = IERC20Upgradeable(crv_);
        registry = ICurveRegistry(crvRegistry_);
        gaugeController = ICurveGaugeController(gaugeController_);
    }

    /// @notice Encode pid, crvPerShare to ERC1155 token id
    /// @param pid Pool id (16-bit)
    /// @param crvPerShare CRV amount per share, multiplied by 1e18 (240-bit)
    function encodeId(
        uint256 pid,
        uint256 crvPerShare
    ) public pure returns (uint256 id) {
        if (pid >= (1 << 16)) revert Errors.BAD_PID(pid);
        if (crvPerShare >= (1 << 240))
            revert Errors.BAD_REWARD_PER_SHARE(crvPerShare);
        return (pid << 240) | crvPerShare;
    }

    /// @notice Decode ERC1155 token id to pid, crvPerShare
    /// @param id Token id
    function decodeId(
        uint256 id
    ) public pure returns (uint256 gid, uint256 crvPerShare) {
        gid = id >> 240; // First 16 bits
        crvPerShare = id & ((1 << 240) - 1); // Last 240 bits
    }

    /// @notice Get underlying ERC20 token of ERC1155 given token id
    /// @param id Token id
    function getUnderlyingToken(
        uint256 id
    ) external view override returns (address) {
        (uint256 gid, ) = decodeId(id);
        return getLpFromGaugeId(gid);
    }

    function getLpFromGaugeId(uint256 gid) public view returns (address) {
        return ILiquidityGauge(gaugeController.gauges(gid)).lp_token();
    }

    /// @notice Return pending rewards from the farming pool
    /// @dev Reward tokens can be multiple tokens
    /// @param tokenId Token Id
    /// @param amount amount of share
    function pendingRewards(
        uint256 tokenId,
        uint256 amount
    )
        public
        view
        override
        returns (address[] memory tokens, uint256[] memory rewards)
    {}

    /// @notice Mint ERC1155 token for the given LP token
    /// @param gid Gauge id
    /// @param amount Token amount to wrap
    function mint(
        uint256 gid,
        uint256 amount
    ) external nonReentrant returns (uint256) {
        ILiquidityGauge gauge = ILiquidityGauge(gaugeController.gauges(gid));
        if (address(gauge) == address(0)) revert Errors.NO_GAUGE();

        _mintCrv(gauge, gid);
        IERC20Upgradeable lpToken = IERC20Upgradeable(gauge.lp_token());
        lpToken.safeTransferFrom(msg.sender, address(this), amount);

        _ensureApprove(address(lpToken), address(gauge), amount);
        gauge.deposit(amount);

        uint256 id = encodeId(gid, accCrvPerShares[gid]);
        _mint(msg.sender, id, amount, "");
        return id;
    }

    /// @notice Burn ERC1155 token to redeem ERC20 token back
    /// @param id Token id to burn
    /// @param amount Token amount to burn
    /// @return rewards CRV rewards harvested
    function burn(
        uint256 id,
        uint256 amount
    ) external nonReentrant returns (uint256 rewards) {
        if (amount == type(uint256).max) {
            amount = balanceOf(msg.sender, id);
        }
        (uint256 gid, uint256 stCrvPerShare) = decodeId(id);
        _burn(msg.sender, id, amount);
        ILiquidityGauge gauge = ILiquidityGauge(gaugeController.gauges(gid));
        require(address(gauge) != address(0), "gauge not registered");
        _mintCrv(gauge, gid);
        gauge.withdraw(amount);
        IERC20Upgradeable(gauge.lp_token()).safeTransfer(msg.sender, amount);
        uint256 stCrv = (stCrvPerShare * amount) / 1e18;
        uint256 enCrv = (accCrvPerShares[gid] * amount) / 1e18;
        if (enCrv > stCrv) {
            rewards = enCrv - stCrv;
            CRV.safeTransfer(msg.sender, rewards);
        }
        return rewards;
    }

    /// @notice Mint CRV reward for curve gauge
    /// @param gauge Curve gauge to mint reward
    function _mintCrv(ILiquidityGauge gauge, uint256 gid) internal {
        uint256 balanceBefore = CRV.balanceOf(address(this));
        ILiquidityGaugeMinter(gauge.minter()).mint(address(gauge));
        uint256 balanceAfter = CRV.balanceOf(address(this));
        uint256 gain = balanceAfter - balanceBefore;
        uint256 supply = gauge.balanceOf(address(this));
        if (gain > 0 && supply > 0) {
            accCrvPerShares[gid] += (gain * 1e18) / supply;
        }
    }
}
