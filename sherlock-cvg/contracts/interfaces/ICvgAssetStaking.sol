// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ICvgAssetStaking {
    // Deposit Principle token in Treasury through Bond contract
    function processStakersRewards(uint256 amount) external;

    function symbol() external view returns (string memory);
}
