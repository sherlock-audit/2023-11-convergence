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

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";

import "../../interfaces/ICommonStruct.sol";
import "../../interfaces/ICvgControlTower.sol";
import "../../interfaces/IFeeDistributor.sol";

/// @title Cvg-Finance - CvgSdtBuffer
/// @author CvgFinance
/// @notice Receives and transfers all rewards for the SdtStakingService of CvgSdt

contract CvgSdtBuffer is Ownable2StepUpgradeable {
    /// @dev Control tower of Convergence, used to retrieve common addresses
    ICvgControlTower public cvgControlTower;
    /// @dev Fee distributor of StakeDao, we claim the rewards in sdFrax3CRV on it
    IFeeDistributor public feeDistributor;

    /// @dev Reward tokens
    IERC20 public sdt;
    IERC20 public cvgSdt;
    IERC20 public sdFrax3Crv;

    /// @notice Percentage of rewards to be sent to the user who processed the SDT rewards
    uint256 public processorRewardsPercentage;

    uint256 private constant DENOMINATOR = 100000;

    /* =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=
                  INITIALIZE
    =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-= */
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(ICvgControlTower _cvgControlTower, IFeeDistributor _feeDistributor) external initializer {
        cvgControlTower = _cvgControlTower;
        feeDistributor = _feeDistributor;
        IERC20 _sdt = _cvgControlTower.sdt();
        IERC20 _cvgSdt = _cvgControlTower.cvgSDT();
        IERC20 _sdFrax3Crv = IERC20(_feeDistributor.token());
        require(address(_sdt) != address(0), "SDT_ZERO");
        require(address(_cvgSdt) != address(0), "CVGSDT_ZERO");
        require(address(_sdFrax3Crv) != address(0), "SDFRAX3CRV_ZERO");
        sdt = _sdt;
        cvgSdt = _cvgSdt;
        sdFrax3Crv = _sdFrax3Crv;

        /// @dev corresponds to 1.25%
        processorRewardsPercentage = 1250;
        _transferOwnership(_cvgControlTower.treasuryDao());
    }

    /**
     *  @notice Only callable by the CvgSdtStaking contract during the processSdtRewards, transfers ERC20 tokens to the Staking contract.
                This process is incentivized so that the user who initiated it receives a percentage of each reward token.
     *          - SdFrax3Crv, coming from FeeDistributor.
     *          - SDT, coming from SdtFeeCollector.
     *          - SDT or CvgSdt, directly sent from veSdtMultisig and/or bondMultisig.
     *  @param processor Address of the processor
     *  @return Array of TokenAmount, Values of this array are registered in the Staking contract and linked to the processed cycle
     */
    function pullRewards(address processor) external returns (ICommonStruct.TokenAmount[] memory) {
        ICvgControlTower _cvgControlTower = cvgControlTower;
        ISdtStakingPositionService _cvgSdtStaking = _cvgControlTower.cvgSdtStaking();
        address sdtRewardReceiver = cvgControlTower.sdtRewardReceiver();

        address veSdtMultisig = _cvgControlTower.veSdtMultisig();
        IERC20 _sdt = sdt;
        IERC20 _cvgSdt = cvgSdt;
        IERC20 _sdFrax3Crv = sdFrax3Crv;

        require(msg.sender == address(_cvgSdtStaking), "NOT_CVG_SDT_STAKING");

        /// @dev disperse sdt fees
        _cvgControlTower.sdtFeeCollector().withdrawSdt();

        /// @dev claim sdFrax3CrvReward from feedistributor on behalf of the multisig
        feeDistributor.claim(veSdtMultisig);

        /// @dev Fetches balance of itself in SDT
        uint256 sdtAmount = _sdt.balanceOf(address(this));

        /// @dev Fetches balance of itself in CvgSdt
        uint256 cvgSdtAmount = _cvgSdt.balanceOf(address(this));

        /// @dev Fetches balance of veSdtMultisig in sdFrax3Crv
        uint256 sdFrax3CrvAmount = _sdFrax3Crv.balanceOf(veSdtMultisig);

        /// @dev TokenAmount array struct returned
        ICommonStruct.TokenAmount[] memory sdtRewardAssets = new ICommonStruct.TokenAmount[](3);
        uint256 counter;

        uint256 _processorRewardsPercentage = processorRewardsPercentage;
        address _processor = processor;

        /// @dev distributes if the balance is different from 0
        if (sdtAmount != 0) {
            /// @dev send rewards to claimer
            uint256 processorRewards = sdtAmount * _processorRewardsPercentage / DENOMINATOR;
            if (processorRewards != 0) {
                _sdt.transfer(_processor, processorRewards);
                sdtAmount -= processorRewards;
            }

            sdtRewardAssets[counter++] = ICommonStruct.TokenAmount({token: _sdt, amount: sdtAmount});
            ///@dev transfers all Sdt to the CvgSdtStaking
            _sdt.transfer(sdtRewardReceiver, sdtAmount);
        }
        /// @dev else reduces the length of the array to not return some useless 0 TokenAmount structs
        else {
            // solhint-disable-next-line no-inline-assembly
            assembly {
                mstore(sdtRewardAssets, sub(mload(sdtRewardAssets), 1))
            }
        }

        /// @dev distributes if the balance is different from 0
        if (sdFrax3CrvAmount != 0) {
            /// @dev send rewards to claimer
            uint256 processorRewards = sdFrax3CrvAmount * _processorRewardsPercentage / DENOMINATOR;
            if (processorRewards != 0) {
                _sdFrax3Crv.transferFrom(veSdtMultisig, _processor, processorRewards);
                sdFrax3CrvAmount -= processorRewards;
            }

            sdtRewardAssets[counter++] = ICommonStruct.TokenAmount({token: _sdFrax3Crv, amount: sdFrax3CrvAmount});
            ///@dev transfers from all tokens detained by veSdtMultisig
            _sdFrax3Crv.transferFrom(veSdtMultisig, sdtRewardReceiver, sdFrax3CrvAmount);
        }
        /// @dev else reduces the length of the array to not return some useless 0 TokenAmount structs
        else {
            // solhint-disable-next-line no-inline-assembly
            assembly {
                mstore(sdtRewardAssets, sub(mload(sdtRewardAssets), 1))
            }
        }

        /// @dev distributes if the balance is different from 0
        if (cvgSdtAmount != 0) {
            /// @dev send rewards to claimer
            uint256 processorRewards = cvgSdtAmount * _processorRewardsPercentage / DENOMINATOR;
            if (processorRewards != 0) {
                _cvgSdt.transfer(_processor, processorRewards);
                cvgSdtAmount -= processorRewards;
            }

            sdtRewardAssets[counter++] = ICommonStruct.TokenAmount({token: _cvgSdt, amount: cvgSdtAmount});
            ///@dev transfers all CvgSdt to the CvgSdtStaking
            _cvgSdt.transfer(sdtRewardReceiver, cvgSdtAmount);
        }
        /// @dev else reduces the length of the array to not return some useless 0 TokenAmount structs
        else {
            // solhint-disable-next-line no-inline-assembly
            assembly {
                mstore(sdtRewardAssets, sub(mload(sdtRewardAssets), 1))
            }
        }

        return sdtRewardAssets;
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
