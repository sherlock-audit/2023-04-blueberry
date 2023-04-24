// SPDX-License-Identifier: MIT

pragma solidity 0.8.16;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../../interfaces/paraswap/IParaswap.sol";
import "./Utils.sol";

library PSwapLib {
    function _approve(
        IERC20 inToken,
        address spender,
        uint256 amount
    ) internal {
        // approve zero before reset allocation
        inToken.approve(spender, 0);
        inToken.approve(spender, amount);
    }

    function megaSwap(
        address augustusSwapper,
        address tokenTransferProxy,
        Utils.MegaSwapSellData calldata data
    ) external returns (uint256) {
        _approve(IERC20(data.fromToken), tokenTransferProxy, data.fromAmount);

        return IParaswap(augustusSwapper).megaSwap(data);
    }
}
