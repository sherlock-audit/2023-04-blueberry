// SPDX-License-Identifier: MIT

pragma solidity 0.8.16;

interface ICurveCryptoFactory {
    function get_coins(address lp) external view returns (address[2] memory);
}
