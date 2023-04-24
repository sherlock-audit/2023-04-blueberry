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
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/IERC20MetadataUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import "../utils/BlueBerryErrors.sol" as Errors;
import "../utils/EnsureApprove.sol";
import "../interfaces/IWAuraPools.sol";
import "../interfaces/IERC20Wrapper.sol";
import "../interfaces/aura/IAuraRewarder.sol";

/**
 * @title WAuraPools
 * @author BlueberryProtocol
 * @notice Wrapped Aura Pools is the wrapper of LP positions
 * @dev Leveraged LP Tokens will be wrapped here and be held in BlueberryBank 
 *      and do not generate yields. LP Tokens are identified by tokenIds 
 *      encoded from lp token address.
 */
contract WAuraPools is
    ERC1155Upgradeable,
    ReentrancyGuardUpgradeable,
    OwnableUpgradeable,
    EnsureApprove,
    IERC20Wrapper,
    IWAuraPools
{
    using SafeERC20Upgradeable for IERC20Upgradeable;

    /// @dev Address to Aura Pools contract
    IAuraPools public auraPools;
    /// @dev Address to AURA token
    IERC20Upgradeable public AURA;
    /// @dev Mapping from gauge id to accBalPerShare
    mapping(uint256 => uint256) public accCrvPerShares;
    /// @dev Mapping from token id to accExtPerShare
    mapping(uint256 => uint256[]) public accExtPerShare;

    function initialize(
        address aura_,
        address auraPools_
    ) external initializer {
        __ReentrancyGuard_init();
        __ERC1155_init("WAuraPools");
        AURA = IERC20Upgradeable(aura_);
        auraPools = IAuraPools(auraPools_);
    }

    /// @notice Encode pid, auraPerShare to ERC1155 token id
    /// @param pid Pool id (16-bit)
    /// @param auraPerShare AURA amount per share, multiplied by 1e18 (240-bit)
    function encodeId(
        uint256 pid,
        uint256 auraPerShare
    ) public pure returns (uint256 id) {
        if (pid >= (1 << 16)) revert Errors.BAD_PID(pid);
        if (auraPerShare >= (1 << 240))
            revert Errors.BAD_REWARD_PER_SHARE(auraPerShare);
        return (pid << 240) | auraPerShare;
    }

    /// @notice Decode ERC1155 token id to pid, auraPerShare
    /// @param id Token id
    function decodeId(
        uint256 id
    ) public pure returns (uint256 gid, uint256 auraPerShare) {
        gid = id >> 240; // First 16 bits
        auraPerShare = id & ((1 << 240) - 1); // Last 240 bits
    }

    /// @notice Get underlying ERC20 token of ERC1155 given token id
    /// @param id Token id
    function getUnderlyingToken(
        uint256 id
    ) external view override returns (address uToken) {
        (uint256 pid, ) = decodeId(id);
        (uToken, , , , , ) = getPoolInfoFromPoolId(pid);
    }

    function getVault(address bpt) public view returns (IBalancerVault) {
        return IBalancerVault(IBalancerPool(bpt).getVault());
    }

    function getPoolTokens(
        address bpt
    )
        external
        view
        returns (
            address[] memory tokens,
            uint256[] memory balances,
            uint256 lastChangedBlock
        )
    {
        return getVault(bpt).getPoolTokens(IBalancerPool(bpt).getPoolId());
    }

    function getPool(
        address bpt,
        uint256 pid
    ) external view returns (address, uint256) {
        return getVault(bpt).getPool(bytes32(pid));
    }

    function getPoolInfoFromPoolId(
        uint256 pid
    )
        public
        view
        returns (
            address lptoken,
            address token,
            address gauge,
            address crvRewards,
            address stash,
            bool shutdown
        )
    {
        return auraPools.poolInfo(pid);
    }

    function _getPendingReward(
        uint stRewardPerShare,
        address rewarder,
        uint amount,
        uint lpDecimals
    ) internal view returns (uint rewards) {
        uint256 enRewardPerShare = IAuraRewarder(rewarder).rewardPerToken();
        uint256 share = enRewardPerShare > stRewardPerShare
            ? enRewardPerShare - stRewardPerShare
            : 0;
        rewards = (share * amount) / (10 ** lpDecimals);
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
    {
        (uint256 pid, uint256 stCrvPerShare) = decodeId(tokenId);
        (address lpToken, , , address crvRewarder, , ) = getPoolInfoFromPoolId(
            pid
        );
        uint256 lpDecimals = IERC20MetadataUpgradeable(lpToken).decimals();
        uint extraRewardsCount = IAuraRewarder(crvRewarder)
            .extraRewardsLength();
        tokens = new address[](extraRewardsCount + 1);
        rewards = new uint256[](extraRewardsCount + 1);

        tokens[0] = IAuraRewarder(crvRewarder).rewardToken();
        rewards[0] = _getPendingReward(
            stCrvPerShare,
            crvRewarder,
            amount,
            lpDecimals
        );

        for (uint i = 0; i < extraRewardsCount; i++) {
            address rewarder = IAuraRewarder(crvRewarder).extraRewards(i);
            uint256 stRewardPerShare = accExtPerShare[tokenId][i];
            tokens[i + 1] = IAuraRewarder(rewarder).rewardToken();
            rewards[i + 1] = _getPendingReward(
                stRewardPerShare,
                rewarder,
                amount,
                lpDecimals
            );
        }
    }

    /// @notice Mint ERC1155 token for the given LP token
    /// @param pid Aura Pool id
    /// @param amount Token amount to wrap
    function mint(
        uint256 pid,
        uint256 amount
    ) external nonReentrant returns (uint256 id) {
        (address lpToken, , , address crvRewarder, , ) = getPoolInfoFromPoolId(
            pid
        );
        IERC20Upgradeable(lpToken).safeTransferFrom(
            msg.sender,
            address(this),
            amount
        );

        _ensureApprove(lpToken, address(auraPools), amount);
        auraPools.deposit(pid, amount, true);

        uint256 crvRewardPerToken = IAuraRewarder(crvRewarder).rewardPerToken();
        id = encodeId(pid, crvRewardPerToken);
        _mint(msg.sender, id, amount, "");
        // Store extra rewards info
        uint extraRewardsCount = IAuraRewarder(crvRewarder)
            .extraRewardsLength();
        for (uint i = 0; i < extraRewardsCount; i++) {
            address extraRewarder = IAuraRewarder(crvRewarder).extraRewards(i);
            uint rewardPerToken = IAuraRewarder(extraRewarder).rewardPerToken();
            accExtPerShare[id].push(rewardPerToken);
        }
    }

    /// @notice Burn ERC1155 token to redeem ERC20 token back
    /// @param id Token id to burn
    /// @param amount Token amount to burn
    /// @return rewardTokens Reward tokens rewards harvested
    function burn(
        uint256 id,
        uint256 amount
    )
        external
        nonReentrant
        returns (address[] memory rewardTokens, uint256[] memory rewards)
    {
        if (amount == type(uint256).max) {
            amount = balanceOf(msg.sender, id);
        }
        (uint256 pid, ) = decodeId(id);
        _burn(msg.sender, id, amount);

        (address lpToken, , , address balRewarder, , ) = getPoolInfoFromPoolId(
            pid
        );
        // Claim Rewards
        IAuraRewarder(balRewarder).withdraw(amount, true);
        // Withdraw LP
        auraPools.withdraw(pid, amount);

        // Transfer LP Tokens
        IERC20Upgradeable(lpToken).safeTransfer(msg.sender, amount);

        // Transfer Reward Tokens
        (rewardTokens, rewards) = pendingRewards(id, amount);

        for (uint i = 0; i < rewardTokens.length; i++) {
            IERC20Upgradeable(rewardTokens[i]).safeTransfer(
                msg.sender,
                rewards[i]
            );
        }
    }
}
