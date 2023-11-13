// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IFeeDistributor {
    function claim(address addr) external returns (uint256);

    function token() external view returns (address);
}
