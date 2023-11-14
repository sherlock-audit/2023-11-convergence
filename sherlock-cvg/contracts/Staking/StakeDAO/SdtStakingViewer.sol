// SPDX-License-Identifier: MIT
/**
 _____
/  __ \
| /  \/ ___  _ ____   _____ _ __ __ _  ___ _ __   ___ ___
| |    / _ \| '_ \ \ / / _ \ '__/ _` |/ _ \ '_ \ / __/ _ \
| \__/\ (_) | | | \ V /  __/ | | (_| |  __/ | | | (_|  __/
 \____/\___/|_| |_|\_/ \___|_|  \__, |\___|_| |_|\___\___|
                                 __/ |
                                |___/
 */
import "../../interfaces/ISdtStakingPositionService.sol";
import "../../interfaces/ISdtStruct.sol";
import "../../interfaces/ISdAssets.sol";
import "../../interfaces/ILpStakeDaoStrat.sol";

pragma solidity ^0.8.0;

/// @title Cvg-Finance - SdtStakingViewer
/// @notice Computes sdt staking data to get them in an easy-to-handle format
///         This will mainly be used by third-party tools
contract SdtStakingViewer {
    /// @dev convergence ecosystem address
    ICvgControlTower public cvgControlTower;

    constructor(ICvgControlTower _cvgControlTower) {
        cvgControlTower = _cvgControlTower;
    }

    /**
     * @notice Get global information about a sdt staking contract with CvgSdt data.
     * @param _stakingContract address of a sdt staking contract
     * @return struct containing the staking information and CvgSdt data
     */
    function getGlobalViewCvgSdtStaking(
        ISdtStakingPositionService _stakingContract
    ) external view returns (ISdtStruct.CvgSdtGlobalView memory) {
        uint256 _cvgStakingCycle = _stakingContract.stakingCycle();
        ISdAssetGauge _stakingAsset = _stakingContract.stakingAsset();

        return
            ISdtStruct.CvgSdtGlobalView({
                cvgSdt: ISdtStruct.ERC20View({
                    decimals: _stakingAsset.decimals(),
                    token: _stakingAsset.symbol(),
                    tokenAddress: address(_stakingAsset)
                }),
                stakingAddress: address(_stakingContract),
                cvgCycle: _cvgStakingCycle,
                previousTotal: _stakingContract.cycleInfo(_cvgStakingCycle - 1).totalStaked,
                actualTotal: _stakingContract.cycleInfo(_cvgStakingCycle).totalStaked,
                nextTotal: _stakingContract.cycleInfo(_cvgStakingCycle + 1).totalStaked
            });
    }

    /**
     * @notice Get global information about several sdAsset staking contracts.
     * @param _stakingContracts addresses of sdAsset staking contracts
     * @return array containing the information about every sdAsset staking contract (sdAsset, gaugeAsset, etc.)
     */
    function getGlobalViewSdAssetStaking(
        ISdtStakingPositionService[] calldata _stakingContracts
    ) external view returns (ISdtStruct.SdAssetGlobalView[] memory) {
        ISdtStruct.SdAssetGlobalView[] memory _sdAssets = new ISdtStruct.SdAssetGlobalView[](_stakingContracts.length);

        for (uint256 i; i < _stakingContracts.length; ) {
            ISdtStakingPositionService _sdtStaking = _stakingContracts[i];
            uint256 _cvgStakingCycle = _sdtStaking.stakingCycle();
            ISdAssetGauge gaugeAsset = _sdtStaking.stakingAsset();
            ISdAsset sdAsset = ISdAsset(address(gaugeAsset.staking_token()));
            IERC20Metadata asset = sdAsset.operator().token();

            _sdAssets[i] = ISdtStruct.SdAssetGlobalView({
                gaugeAsset: ISdtStruct.ERC20View({
                    decimals: gaugeAsset.decimals(),
                    token: gaugeAsset.symbol(),
                    tokenAddress: address(gaugeAsset)
                }),
                sdAsset: ISdtStruct.ERC20View({
                    decimals: sdAsset.decimals(),
                    token: sdAsset.symbol(),
                    tokenAddress: address(sdAsset)
                }),
                asset: ISdtStruct.ERC20View({
                    decimals: asset.decimals(),
                    token: asset.symbol(),
                    tokenAddress: address(asset)
                }),
                stakingAddress: address(_sdtStaking),
                cvgCycle: _cvgStakingCycle,
                previousTotal: _sdtStaking.cycleInfo(_cvgStakingCycle - 1).totalStaked,
                actualTotal: _sdtStaking.cycleInfo(_cvgStakingCycle).totalStaked,
                nextTotal: _sdtStaking.cycleInfo(_cvgStakingCycle + 1).totalStaked
            });
            unchecked {
                ++i;
            }
        }

        return _sdAssets;
    }

    /**
     * @notice Get global information about several lpAsset staking contracts.
     * @param _stakingContracts addresses of lpAsset staking contracts
     * @return array containing the information about every lpAsset staking contract (lpAsset, gaugeAsset, etc.)
     */
    function getGlobalViewLpAssetStaking(
        ISdtStakingPositionService[] calldata _stakingContracts
    ) external view returns (ISdtStruct.LpAssetGlobalView[] memory) {
        ISdtStruct.LpAssetGlobalView[] memory _lpAssets = new ISdtStruct.LpAssetGlobalView[](_stakingContracts.length);

        for (uint256 i; i < _stakingContracts.length; ) {
            ISdtStakingPositionService _sdtStaking = _stakingContracts[i];
            uint256 _cvgStakingCycle = _sdtStaking.stakingCycle();
            ISdAssetGauge gaugeAsset = _sdtStaking.stakingAsset();
            IERC20Metadata lpAsset = ILpStakeDaoStrat(address(gaugeAsset.staking_token())).token();

            _lpAssets[i] = ISdtStruct.LpAssetGlobalView({
                gaugeAsset: ISdtStruct.ERC20View({
                    decimals: gaugeAsset.decimals(),
                    token: gaugeAsset.symbol(),
                    tokenAddress: address(gaugeAsset)
                }),
                lpAsset: ISdtStruct.ERC20View({
                    decimals: lpAsset.decimals(),
                    token: lpAsset.symbol(),
                    tokenAddress: address(lpAsset)
                }),
                stakingAddress: address(_sdtStaking),
                cvgCycle: _cvgStakingCycle,
                previousTotal: _sdtStaking.cycleInfo(_cvgStakingCycle - 1).totalStaked,
                actualTotal: _sdtStaking.cycleInfo(_cvgStakingCycle).totalStaked,
                nextTotal: _sdtStaking.cycleInfo(_cvgStakingCycle + 1).totalStaked
            });
            unchecked {
                ++i;
            }
        }
        return _lpAssets;
    }

    /**
     * @notice Get information about tokens on their respective sdt staking contract.
     * @param _tokenViewInputs array containing the tokenId and the address of the respective sdt staking contract
     * @return array containing the information about each token
     */
    function getTokenViewSdtStaking(
        ISdtStruct.TokenViewInput[] calldata _tokenViewInputs
    ) external view returns (ISdtStruct.TokenViewOutput[] memory) {
        ISdtStruct.TokenViewOutput[] memory _tokenViewOutputs = new ISdtStruct.TokenViewOutput[](
            _tokenViewInputs.length
        );

        for (uint256 i; i < _tokenViewInputs.length; ) {
            ISdtStruct.TokenViewInput memory tokenViewInput = _tokenViewInputs[i];

            uint256 _cvgStakingCycle = tokenViewInput.stakingContract.stakingCycle();
            uint256 accountTotalStaked = tokenViewInput.stakingContract.tokenTotalStaked(tokenViewInput.tokenId);

            _tokenViewOutputs[i] = ISdtStruct.TokenViewOutput({
                stakingContract: tokenViewInput.stakingContract,
                tokenId: tokenViewInput.tokenId,
                actualToken: accountTotalStaked -
                    tokenViewInput
                        .stakingContract
                        .tokenInfoByCycle(_cvgStakingCycle + 1, tokenViewInput.tokenId)
                        .pendingStaked,
                nextToken: accountTotalStaked,
                previousToken: tokenViewInput.stakingContract.stakedAmountEligibleAtCycle(
                    _cvgStakingCycle - 1,
                    tokenViewInput.tokenId,
                    _cvgStakingCycle
                )
            });
            unchecked {
                ++i;
            }
        }

        return _tokenViewOutputs;
    }

    struct AprDataCvg {
        uint256 cvgCycle;
        ISdtStakingPositionService.CycleInfo[] amounts;
    }

    /**
     * @notice Get APR data about CVG at a given cvg cycle for given sdt staking contracts.
     * @param cvgCycle cycle at which APR data should be fetched from
     * @param stakingContracts array of the sdt staking contracts
     * @return APR data
     */
    function getAprDataCvg(
        uint256 cvgCycle,
        ISdtStakingPositionService[] calldata stakingContracts
    ) external view returns (AprDataCvg memory) {
        ISdtStakingPositionService.CycleInfo[] memory amounts = new ISdtStakingPositionService.CycleInfo[](
            stakingContracts.length
        );

        for (uint256 i; i < stakingContracts.length; ) {
            amounts[i] = stakingContracts[i].cycleInfo(cvgCycle);
            unchecked {
                ++i;
            }
        }

        return AprDataCvg({cvgCycle: cvgCycle, amounts: amounts});
    }

    struct AprDataSdt {
        uint256 cvgCycle;
        ISdtStakingPositionService.CycleInfoMultiple[] amounts;
    }

    /**
     * @notice Get APR data about SDT at a given cvg cycle for given sdt staking contracts.
     * @param cvgCycle cycle at which APR data should be fetched from
     * @param stakingContracts array of the sdt staking contracts
     * @return APR data
     */
    function getAprDataSdt(
        uint256 cvgCycle,
        ISdtStakingPositionService[] calldata stakingContracts
    ) external view returns (AprDataSdt memory) {
        ISdtStakingPositionService.CycleInfoMultiple[]
            memory amounts = new ISdtStakingPositionService.CycleInfoMultiple[](stakingContracts.length);

        for (uint256 i; i < stakingContracts.length; ) {
            amounts[i].totalStaked = stakingContracts[i].cycleInfo(cvgCycle).totalStaked;
            amounts[i].sdtClaimable = stakingContracts[i].getProcessedSdtRewards(cvgCycle);
            unchecked {
                ++i;
            }
        }

        return AprDataSdt({cvgCycle: cvgCycle, amounts: amounts});
    }

    struct ProcessableRewards {
        ISdAssetGauge sdAssetGauge;
        ProcessableData[] processableData;
    }

    struct ProcessableData {
        IERC20 rewardToken;
        uint256 processableAmount;
    }

    /**
     * @notice Get processable rewards amounts for each reward token of each sdAsset-gauge.
     * @param sdtStaking array of sdt staking contracts to get processable rewards from
     * @return array of processable rewards
     */
    function getProcessableRewardsOnSdtStakingContracts(ISdtStakingPositionService[] calldata sdtStaking) external view returns (ProcessableRewards[] memory) {
        /// @dev get sdAsset-gauges from staking contracts
        ISdAssetGauge[] memory sdAssetGauges = new ISdAssetGauge[](sdtStaking.length);
        for (uint256 i; i < sdtStaking.length; i++) {
            sdAssetGauges[i] = sdtStaking[i].stakingAsset();
        }

        address sdtBlackHole = address(cvgControlTower.sdtBlackHole());
        ProcessableRewards[] memory processableRewards = new ProcessableRewards[](sdAssetGauges.length);

        /// @dev iterates on each sdAsset-gauge
        for (uint256 i; i < sdAssetGauges.length;) {
            /// @dev get the number of reward tokens for this token
            uint256 rewardCount = sdAssetGauges[i].reward_count();

            /// @dev iterate on reward tokens to get the processable amount of each instance
            ProcessableData[] memory processableData = new ProcessableData[](rewardCount);
            for (uint256 j; j < rewardCount;) {
                IERC20 rewardToken = sdAssetGauges[i].reward_tokens(j);

                /// @dev get the processable amount for this reward token + the balance of this token on the buffer
                uint256 processableAmount = sdAssetGauges[i].claimable_reward(sdtBlackHole, address(rewardToken)) +
                    rewardToken.balanceOf(address(sdtStaking[i].buffer()));

                processableData[j] = ProcessableData({
                    rewardToken: rewardToken,
                    processableAmount: processableAmount
                });

                unchecked { ++j; }
            }

            processableRewards[i] = ProcessableRewards({
                sdAssetGauge: sdAssetGauges[i],
                processableData: processableData
            });

            unchecked { ++i; }
        }

        return processableRewards;
    }
}
