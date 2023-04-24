// SPDX-License-Identifier: MIT

pragma solidity 0.8.16;

interface IBalancerPool {
    function getVault() external view returns (address);

    function getPoolId() external view returns (bytes32);

    function totalSupply() external view returns (uint256);

    function getNormalizedWeights() external view returns (uint256[] memory);
}
