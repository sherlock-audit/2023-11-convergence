// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./ICommonStruct.sol";

interface ISdtRewardReceiver {
    function claimCvgSdtSimple(
        address receiver,
        uint256 cvgAmount,
        ICommonStruct.TokenAmount[] memory sdtRewards,
        bool isConvert,
        bool isMint
    ) external;
}
