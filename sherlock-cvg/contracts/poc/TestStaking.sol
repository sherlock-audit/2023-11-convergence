// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interfaces/ICommonStruct.sol";

contract TestStaking {
    /// @dev defines the information about a CVG cycle
    struct CycleInfo {
        uint256 cvgRewardsAmount;
        uint128 isCvgProcessed;
    }

    mapping(uint256 => CycleInfo) public cvgCycleInfo;

    uint256 public cvgStakingCycle = 1;

    function processStakersRewards(uint256 amount) external {
        /// @dev increment cvg cycle
        uint256 _cvgStakingCycle = cvgStakingCycle++;

        /// @dev set next CVG cycle info
        cvgCycleInfo[_cvgStakingCycle].cvgRewardsAmount = amount;
        cvgCycleInfo[_cvgStakingCycle].isCvgProcessed = 1;
    }
}
