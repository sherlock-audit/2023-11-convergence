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
pragma solidity ^0.8.0;

import "../../interfaces/ISdtStakingPositionService.sol";
import "../../interfaces/ISdAssets.sol";
import "../../interfaces/ICommonStruct.sol";
import "../../interfaces/ISdtFeeCollector.sol";
import "../../interfaces/ISdtBlackHole.sol";
import "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";

/// @title Cvg-Finance - SdtBuffer
/// @notice Is permanently linked to a single SdtStakingService
///         Receives and send Stake Dao gauge rewards & bribes rewards
contract SdtBuffer is Ownable2StepUpgradeable {
    /// @notice Convergence ecosystem address
    ICvgControlTower public cvgControlTower;

    /// @notice Address of the associated sdtStaking contract
    address public sdtStaking;

    /// @notice Address of the gauge contract staked through the linked sdtStaking
    ISdAssetGauge public gaugeAsset;

    /// @notice StakeDao token
    IERC20 public sdt;

    /// @notice Percentage of rewards to be sent to the user who processed the SDT rewards
    uint256 public processorRewardsPercentage;

    uint256 private constant DENOMINATOR = 100_000;

    /* =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=
                        CONSTRUCTOR & INIT
    =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-= */
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice initialize function of the buffer contract, can only be called once (by the clone factory)
    function initialize(
        ICvgControlTower _cvgControlTower,
        address _sdtStaking,
        ISdAssetGauge _gaugeAsset,
        IERC20 _sdt
    ) external initializer {
        cvgControlTower = _cvgControlTower;
        sdtStaking = _sdtStaking;
        gaugeAsset = _gaugeAsset;
        sdt = _sdt;

        /// @dev corresponds to 1.25%
        processorRewardsPercentage = 1250;
        _transferOwnership(_cvgControlTower.treasuryDao());
    }

    /** @notice Only callable by the linked Staking contract during the processSdtRewards, transfers ERC20 tokens to the Staking contract.
     *          This process is incentivized so that the user who initiated it receives a percentage of each reward token.
     *          - Gauge Rewards, associated to StakeDao Gauges.
     *          - Bribes assets, coming from SdAsset bribes.
     *  @param processor address of the processor
     *  @return Array of TokenAmount, Values of this array are registered in the Staking contract and linked to the processed cycle
     */
    function pullRewards(address processor) external returns (ICommonStruct.TokenAmount[] memory) {
        /// @dev Prepare data from storage
        ISdtBlackHole _sdtBlackHole = cvgControlTower.sdtBlackHole();
        address sdtRewardsReceiver = cvgControlTower.sdtRewardReceiver();

        ISdAssetGauge _gaugeAsset = gaugeAsset;
        IERC20 _sdt = sdt;
        uint256 _processorRewardsPercentage = processorRewardsPercentage;

        /// @dev callable only by the linked staking contract
        require(msg.sender == sdtStaking, "ONLY_STAKING");

        /// @dev claim & receives rewards from the gauge
        _gaugeAsset.claim_rewards(address(_sdtBlackHole));

        /// @dev receives bribes rewards from the SdtBlackHole and fetches the array of all bribe assets linked to this buffer in the SdtBlackHole
        ICommonStruct.TokenAmount[] memory bribeTokens = _sdtBlackHole.pullSdStakingBribes(
            processor,
            _processorRewardsPercentage
        );

        /// @dev Fetches the amount of rewards contained in the StakeDao gauge
        uint256 rewardAmount = _gaugeAsset.reward_count();

        /// @dev Instantiate the returned array with the maximum potential length
        ICommonStruct.TokenAmount[] memory tokenAmounts = new ICommonStruct.TokenAmount[](
            rewardAmount + bribeTokens.length
        );

        /// @dev counter used for the actual index of the array, we need it as we remove 0 amounts from our returned array
        uint256 counter;
        address _processor = processor;
        for (uint256 j; j < rewardAmount; ) {
            /// @dev Retrieve the reward asset on the gauge contract
            IERC20 token = _gaugeAsset.reward_tokens(j);
            /// @dev Fetches the balance in this reward asset
            uint256 balance = token.balanceOf(address(this));
            /// @dev distributes if the balance is different from 0
            if (balance != 0) {
                uint256 fullBalance = balance;
                /// @dev Some fees are taken in SDT
                if (token == _sdt) {
                    ISdtFeeCollector _feeCollector = cvgControlTower.sdtFeeCollector();
                    /// @dev Fetches the % of fees to take & compute the amount compare to the actual balance
                    uint256 sdtFees = (_feeCollector.rootFees() * balance) / 100_000;
                    balance -= sdtFees;
                    /// @dev Transfers SDT fees to the FeeCollector
                    token.transfer(address(_feeCollector), sdtFees);
                }

                /// @dev send rewards to claimer
                uint256 claimerRewards = (fullBalance * _processorRewardsPercentage) / DENOMINATOR;
                if (claimerRewards > 0) {
                    token.transfer(_processor, claimerRewards);
                    balance -= claimerRewards;
                }

                /// @dev transfers the balance (or the balance - fees for SDT) minus claimer rewards (if any) to the staking contract
                token.transfer(sdtRewardsReceiver, balance);
                /// @dev Pushes in the TokenAmount array
                tokenAmounts[counter++] = ICommonStruct.TokenAmount({token: token, amount: balance});
            }
            /// @dev else reduces the length of the array to not return some useless 0 TokenAmount structs
            else {
                // solhint-disable-next-line no-inline-assembly
                assembly {
                    mstore(tokenAmounts, sub(mload(tokenAmounts), 1))
                }
            }

            unchecked {
                ++j;
            }
        }

        /// @dev Iterates through bribes assets, transfers them to the staking and push in the TokenReward amount
        for (uint256 j; j < bribeTokens.length; ) {
            IERC20 token = bribeTokens[j].token;
            uint256 amount = bribeTokens[j].amount;
            /// @dev Fetches the bribe token balance
            if (amount != 0) {
                /// @dev Pushes in the TokenAmount array
                tokenAmounts[counter++] = ICommonStruct.TokenAmount({token: token, amount: amount});
            }
            /// @dev else reduces the length of the array to not return some useless 0 TokenAmount structs
            else {
                // solhint-disable-next-line no-inline-assembly
                assembly {
                    mstore(tokenAmounts, sub(mload(tokenAmounts), 1))
                }
            }
            unchecked {
                ++j;
            }
        }

        return tokenAmounts;
    }

    /**
     * @notice Set the percentage of rewards to be sent to the user processing the SDT rewards.
     * @param _percentage rewards percentage value
     */
    function setProcessorRewardsPercentage(uint256 _percentage) external onlyOwner {
        /// @dev it must never exceed 3%
        require(_percentage <= 3000, "PERCENTAGE_TOO_HIGH");
        processorRewardsPercentage = _percentage;
    }
}
