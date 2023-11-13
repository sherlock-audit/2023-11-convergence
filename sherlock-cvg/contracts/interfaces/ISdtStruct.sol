// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interfaces/ISdtStakingPositionService.sol";

interface ISdtStruct {
    struct CvgSdtGlobalView {
        ERC20View cvgSdt;
        address stakingAddress;
        uint256 cvgCycle;
        uint256 previousTotal;
        uint256 actualTotal;
        uint256 nextTotal;
    }

    struct SdAssetGlobalView {
        ERC20View gaugeAsset;
        ERC20View sdAsset;
        ERC20View asset;
        address stakingAddress;
        uint256 cvgCycle;
        uint256 previousTotal;
        uint256 actualTotal;
        uint256 nextTotal;
    }

    struct LpAssetGlobalView {
        ERC20View gaugeAsset;
        ERC20View lpAsset;
        address stakingAddress;
        uint256 cvgCycle;
        uint256 previousTotal;
        uint256 actualTotal;
        uint256 nextTotal;
    }

    struct ERC20View {
        string token;
        address tokenAddress;
        uint256 decimals;
    }

    struct TokenViewInput {
        ISdtStakingPositionService stakingContract;
        uint256 tokenId;
    }

    struct TokenViewOutput {
        ISdtStakingPositionService stakingContract;
        uint256 tokenId;
        uint256 previousToken;
        uint256 actualToken;
        uint256 nextToken;
    }
}
