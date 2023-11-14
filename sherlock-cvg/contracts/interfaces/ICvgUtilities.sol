// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./IBondDepository.sol";
import "./IAggregationRouterV5.sol";

interface ICvgUtilities {
    function swapTokenBondAndLock(
        IBondDepository _bondContract,
        uint256 _bondTokenId,
        uint256 _lockTokenId,
        uint256 _bondTokenAmount,
        uint96 _lockDuration,
        uint256 _durationAdd,
        uint64 _ysPercentage,
        IAggregationRouterV5.SwapTransaction calldata _swapTransaction
    ) external;
}
