// SPDX-License-Identifier: MIT

pragma solidity 0.8.16;

import "@openzeppelin/contracts-upgradeable/token/ERC1155/IERC1155Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

import "./IERC20Wrapper.sol";
import "./balancer/IBalancerPool.sol";
import "./balancer/IBalancerVault.sol";
import "./aura/IAuraPools.sol";

interface IWAuraPools is IERC1155Upgradeable, IERC20Wrapper {
    function AURA() external view returns (IERC20Upgradeable);

    function encodeId(uint, uint) external pure returns (uint);

    function decodeId(uint id) external pure returns (uint, uint);

    function getPoolTokens(
        address bpt
    )
        external
        view
        returns (
            address[] memory tokens,
            uint256[] memory balances,
            uint256 lastChangedBlock
        );

    function getPool(
        address vault,
        uint256 pid
    ) external view returns (address, uint256);

    function getVault(address bpt) external view returns (IBalancerVault);

    function auraPools() external view returns (IAuraPools);

    function getPoolInfoFromPoolId(
        uint256 pid
    )
        external
        view
        returns (
            address lptoken,
            address token,
            address gauge,
            address crvRewards,
            address stash,
            bool shutdown
        );

    /// @dev Mint ERC1155 token for the given ERC20 token.
    function mint(uint gid, uint amount) external returns (uint id);

    /// @dev Burn ERC1155 token to redeem ERC20 token back.
    function burn(
        uint id,
        uint amount
    )
        external
        returns (address[] memory rewardTokens, uint256[] memory rewards);
}
