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

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "../utils/BlueBerryErrors.sol" as Errors;
import "./UsingBaseOracle.sol";
import "../interfaces/ICurveOracle.sol";
import "../interfaces/curve/ICurveRegistry.sol";
import "../interfaces/curve/ICurveCryptoSwapRegistry.sol";
import "../interfaces/curve/ICurveAddressProvider.sol";

/**
 * @author BlueberryProtocol
 * @title Curve Oracle
 * @notice Oracle contract which privides price feeds of Curve Lp tokens
 */
contract CurveOracle is UsingBaseOracle, ICurveOracle, Ownable {
    ICurveAddressProvider public immutable addressProvider;

    event CurveLpRegistered(
        address crvLp,
        address pool,
        address[] underlyingTokens
    );

    constructor(
        IBaseOracle base_,
        ICurveAddressProvider addressProvider_
    ) UsingBaseOracle(base_) {
        addressProvider = addressProvider_;
    }

    /**
     * @dev Get Curve pool info of given curve lp
     * @param crvLp Curve LP token address to get the pool info of
     * @return pool The address of curve pool
     * @return ulTokens Underlying tokens of curve pool
     * @return virtualPrice Virtual price of curve pool
     */
    function _getPoolInfo(
        address crvLp
    )
        internal
        view
        returns (address pool, address[] memory ulTokens, uint256 virtualPrice)
    {
        // 1. Try from main registry
        address registry = addressProvider.get_registry();
        pool = ICurveRegistry(registry).get_pool_from_lp_token(crvLp);
        if (pool != address(0)) {
            (uint256 n, ) = ICurveRegistry(registry).get_n_coins(pool);
            address[8] memory coins = ICurveRegistry(registry).get_coins(pool);
            ulTokens = new address[](n);
            for (uint256 i = 0; i < n; i++) {
                ulTokens[i] = coins[i];
            }
            virtualPrice = ICurveRegistry(registry)
                .get_virtual_price_from_lp_token(crvLp);
            return (pool, ulTokens, virtualPrice);
        }

        // 2. Try from CryptoSwap Registry
        registry = addressProvider.get_address(5);
        pool = ICurveCryptoSwapRegistry(registry).get_pool_from_lp_token(crvLp);
        if (pool != address(0)) {
            uint256 n = ICurveCryptoSwapRegistry(registry).get_n_coins(pool);
            address[8] memory coins = ICurveCryptoSwapRegistry(registry)
                .get_coins(pool);
            ulTokens = new address[](n);
            for (uint256 i = 0; i < n; i++) {
                ulTokens[i] = coins[i];
            }
            virtualPrice = ICurveCryptoSwapRegistry(registry)
                .get_virtual_price_from_lp_token(crvLp);
            return (pool, ulTokens, virtualPrice);
        }

        // 3. Try from Metaregistry
        registry = addressProvider.get_address(7);
        pool = ICurveCryptoSwapRegistry(registry).get_pool_from_lp_token(crvLp);
        if (pool != address(0)) {
            uint256 n = ICurveCryptoSwapRegistry(registry).get_n_coins(pool);
            address[8] memory coins = ICurveCryptoSwapRegistry(registry)
                .get_coins(pool);
            ulTokens = new address[](n);
            for (uint256 i = 0; i < n; i++) {
                ulTokens[i] = coins[i];
            }
            virtualPrice = ICurveCryptoSwapRegistry(registry)
                .get_virtual_price_from_lp_token(crvLp);
            return (pool, ulTokens, virtualPrice);
        }

        revert Errors.ORACLE_NOT_SUPPORT_LP(crvLp);
    }

    function getPoolInfo(
        address crvLp
    )
        external
        view
        returns (address pool, address[] memory coins, uint256 virtualPrice)
    {
        return _getPoolInfo(crvLp);
    }

    /**
     * @notice Return the USD value of given Curve Lp, with 18 decimals of precision.
     * @param crvLp The ERC-20 Curve LP token to check the value.
     */
    function getPrice(address crvLp) external view override returns (uint256) {
        (, address[] memory tokens, uint256 virtualPrice) = _getPoolInfo(crvLp);

        uint256 minPrice = type(uint256).max;
        for (uint256 idx = 0; idx < tokens.length; idx++) {
            uint256 tokenPrice = base.getPrice(tokens[idx]);
            if (tokenPrice < minPrice) minPrice = tokenPrice;
        }
        if (minPrice == type(uint256).max)
            revert Errors.ORACLE_NOT_SUPPORT_LP(crvLp);
        // Use min underlying token prices
        return (minPrice * virtualPrice) / 1e18;
    }
}
