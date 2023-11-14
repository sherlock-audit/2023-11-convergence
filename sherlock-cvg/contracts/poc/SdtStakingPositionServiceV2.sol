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

/// @title Cvg-Finance - SdtStakingPositionService
/// @notice Staking contract of StakeDao integration.
///         Allow to Stake, Unstake and Claim rewards.
///         Cvg Rewards are distributed by CvgCycle, each week.
///         After each Cvg cycle, rewards from SDT can be claimed and distributed to Stakers.
/// @dev    Tracks staking shares per CvgCycle even for a cycle in the past.
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/ICvgControlTower.sol";
import "../interfaces/ICrvPoolPlain.sol";
import "../interfaces/ICommonStruct.sol";
import "../interfaces/ISdAssets.sol";

contract SdtStakingPositionServiceV2 is Ownable2StepUpgradeable {
    using SafeERC20 for IERC20;
    /* =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=
                            STRUCTS
    =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-= */
    /// @dev defines the information about an NFT
    struct TokenInfo {
        uint256 amountStaked;
        uint256 pendingStaked;
    }

    struct LastClaimed {
        uint128 lastClaimedCvg;
        uint128 lastClaimedSdt;
    }

    /// @dev defines the information about a CVG cycle
    struct CycleInfo {
        uint256 cvgRewardsAmount;
        uint256 totalStaked;
        bool isCvgProcessed;
        bool isSdtProcessed;
    }

    struct ClaimableCyclesAndAmounts {
        uint256 cycleClaimable;
        uint256 cvgRewards;
        ICommonStruct.TokenAmount[] sdtRewards;
    }

    struct WithdrawCallInfo {
        address addr;
        bytes signature;
    }

    /* =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=
                            EVENTS
    =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-= */
    event Deposit(uint256 indexed tokenId, address account, uint256 cycleId, uint256 amount);
    event Withdraw(uint256 indexed tokenId, address account, uint256 cycleId, uint256 amount);
    event CvgCycleProcess(uint256 cycleId, uint256 rewardAmount);
    event ClaimCvgMultiple(uint256 indexed tokenId, address account);

    event ClaimCvgSdtMultiple(uint256 indexed tokenId, address account);
    event ProcessSdtRewards(uint256 indexed cycleId, address operator, ICommonStruct.TokenAmount[] tokenAmounts);

    /// @notice Deposits are paused when true
    bool public depositPaused;

    /// @notice Convergence control tower
    ICvgControlTower public cvgControlTower;

    /// @notice Cvg token contract
    ICvg public cvg;

    /// @notice Asset staked through this contract
    ISdAssetGauge public stakingAsset;

    /// @notice Receiver of all Sdt rewards.
    ISdtRewardReceiver public sdtRewardReceiver;

    /// @notice Staking position manager.
    ISdtStakingPositionManager public sdtStakingPositionManager;

    /// @notice Address where stakingAsset is kept during staking.
    ///         Is the SdtBlackhole except for the CvgSdtStaking where it is this contract
    address public vault;

    /// @notice Address of the paired buffer accumulating and sending rewards on processSdtRewards call
    ISdtBuffer public buffer;

    /// @notice Cvg staking cycle for this staking contract
    uint128 public stakingCycle;
    /// @notice Maximum amount of rewards claimable through Sdt,
    ///         is incremented during the processSdtRewards each time a new reward ERC20 is distributed
    uint128 public numberOfSdtRewards;

    /// @notice Token symbol
    string public symbol;

    /// @dev Address and signature of the function to call to withdraw the stakingAsset
    WithdrawCallInfo private withdrawCallInfo;

    mapping(uint256 => CycleInfo) private _cycleInfo; // cycleId => cycleInfos

    /**
     *  @notice Get the global information of a cycle.
     *  Contains the total staked and the distributed amount during the {cycleId}.
     *  Allows to know if rewards have been processed for a cycle or not.
     * @param cycleId Id of the cycle to get the information
     * @return Returns a struct containing the totalStaked on a cycle,
     */
    function cycleInfo(uint256 cycleId) external view returns (CycleInfo memory) {
        return _cycleInfo[cycleId];
    }

    mapping(uint256 => mapping(uint256 => TokenInfo)) private _tokenInfoByCycle; // cycleId => tokenId => tokenInfos

    /**
     * @notice Returns the information of a Staking position at a specified cycle Id.
     * @param cycleId Information of the token will be at this cycle
     * @param tokenId Token Id of the Staking position
     * @return amountStaked : Amount used in the share computation.
     *         pendingStaked : Staked amount not yet eligible for rewards, is removed in priority during a withdraw.
     *         isCvgRewardsClaimed : Allows to know if the position has already claimed the Cvg rewards for this cycle.
     *         isSdtRewardsClaimed : Allows to know if the position has already claimed the StakeDao rewards for this cycle.
     */
    function tokenInfoByCycle(uint256 cycleId, uint256 tokenId) external view returns (TokenInfo memory) {
        return _tokenInfoByCycle[cycleId][tokenId];
    }

    mapping(uint256 => uint256[]) private _stakingHistoryByToken; // tokenId => cycleIds

    /** @notice Array of cycleId where staking/withdraw actions occured in the past.
     * We need this array in order to be able to claim for an old cycle.
     * @param tokenId Reads the actions history of this Token ID
     * @param index   Index of the element to return from the history array
     * @return A Cycle ID
     */
    function stakingHistoryByToken(uint256 tokenId, uint256 index) external view returns (uint256) {
        return _stakingHistoryByToken[tokenId][index];
    }

    mapping(IERC20 => uint256) private _tokenToId; // tokenAddress => sdtRewardId

    /** @notice Get the Id of the ERC20 distributed during the StakeDao distribution
     *  @param erc20Address erc20 address of the reward token from StakeDao
     *  @return Id of the StakeDao reward
     */
    function tokenToId(IERC20 erc20Address) external view returns (uint256) {
        return _tokenToId[erc20Address];
    }

    mapping(uint256 => mapping(uint256 => ICommonStruct.TokenAmount)) private _sdtRewardsByCycle; // cycleId => sdtRewardId => TokenAmount

    /** @notice Pair of token/amount distributed for all stakers per cycleId per Id of ERC20 SDT rewards.
     *  @param cycleId         CycleId where the rewards distribution occurred
     *  @param sdtRewardsIndex Index of the token rewarded
     *  @return The reward token and its amount
     */
    function sdtRewardsByCycle(
        uint256 cycleId,
        uint256 sdtRewardsIndex
    ) external view returns (ICommonStruct.TokenAmount memory) {
        return _sdtRewardsByCycle[cycleId][sdtRewardsIndex];
    }

    mapping(uint256 => LastClaimed) private _lastClaims; // tokenId => lastCycleClaimed

    /** @notice Last cycle claimed on a position for Cvg & StakeDao process.
     *  @param tokenId Id of the position to get the last cycle claimed.
     *  @return The last cycles where a claimed occurred.
     */
    function lastClaims(uint256 tokenId) external view returns (LastClaimed memory) {
        return _lastClaims[tokenId];
    }

    /* =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=
                                V2
   =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-= */
    uint256 public newValue;

    /* =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=
                      CONSTRUCTOR & INIT
  =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-= */
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /** @dev Initialize function of the staking contract, can only be called once
     *  @param _cvgControlTower   Address of the Cvg Control tower
     *  @param _stakingAsset      Staked asset ( gaugeAsset or CvgSdt )
     *  @param _symbol            Symbol to display on the NFT
     *  @param _isGaugeAsset      Allows to define the type of initialization process
     *  @param _withdrawCallInfo  Function signature and contract to call on withdraw
     */
    function initialize(
        ICvgControlTower _cvgControlTower,
        ISdAssetGauge _stakingAsset,
        string memory _symbol,
        bool _isGaugeAsset,
        WithdrawCallInfo calldata _withdrawCallInfo
    ) external initializer {
        cvgControlTower = _cvgControlTower;
        require(address(_stakingAsset) != address(0), "STAKING_ASSET_ZERO");
        stakingAsset = _stakingAsset;
        symbol = _symbol;

        /// @dev If the stakingAsset is a gaugeToken from StakeDao, it means that the creation and the initialization of
        ///      the contract is done from the CloneFactory and the function createSdtStakingAndBuffer
        if (_isGaugeAsset) {
            /// @dev SdtBlackhole receives all staked gaugeAsset for SDT socialization
            address _sdtBlackHole = address(_cvgControlTower.sdtBlackHole());
            require(_sdtBlackHole != address(0), "SDT_BLACKHOLE_ZERO");
            vault = _sdtBlackHole;
        }
        /// @dev Else the stakingAsset is CvgSdt, we don't create the contract from the CloneFactory but in the classic way
        else {
            /// @dev The staking contract itself receives the CvgSdt staked
            vault = address(this);
            /// @dev Setup the buffer of the CvgSdtStaking, we don't need to do it for the contracts created from the CloneFactory
            address _cvgSdtBuffer = address(_cvgControlTower.cvgSdtBuffer());
            require(_cvgSdtBuffer != address(0), "CVGSDT_DISTRIBUTOR_ZERO");
            buffer = ISdtBuffer(_cvgSdtBuffer);
        }

        /// @dev Setup the info of the call made during the withdraw
        withdrawCallInfo = _withdrawCallInfo;

        /// @dev Initialize internal cycle with the cycle from the control tower
        stakingCycle = _cvgControlTower.cvgCycle();

        /// @dev To prevent the claim of Sdt on the first Cycle of deployment.
        ///      Staked asset must be staked during a FULL cycle to be eligible to rewards
        _cycleInfo[stakingCycle].isSdtProcessed = true;

        ICvg _cvg = _cvgControlTower.cvgToken();
        require(address(_cvg) != address(0), "CVG_ZERO");
        cvg = _cvg;

        ISdtRewardReceiver _sdtRewardReceiver = ISdtRewardReceiver(_cvgControlTower.sdtRewardReceiver());
        require(address(_sdtRewardReceiver) != address(0), "SDT_REWARD_RECEIVER_ZERO");
        sdtRewardReceiver = _sdtRewardReceiver;

        ISdtStakingPositionManager _sdtStakingPositionManager = _cvgControlTower.sdtStakingPositionManager();
        require(address(_sdtStakingPositionManager) != address(0), "SDT_STAKING_MANAGER_ZERO");
        sdtStakingPositionManager = _sdtStakingPositionManager;

        address _treasuryDao = _cvgControlTower.treasuryDao();
        require(_treasuryDao != address(0), "TREASURY_DAO_ZERO");
        _transferOwnership(_treasuryDao);
    }

    /* =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=
                    MODIFIERS & PRE CHECKS
    =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-= */
    modifier checkCompliance(uint256 tokenId) {
        cvgControlTower.sdtStakingPositionManager().checkTokenFullCompliance(tokenId, msg.sender);
        _;
    }

    /* =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=
                        USER EXTERNAL
    =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-= */

    /**
     * @notice Deposit an amount of stakingAsset (gaugeAsset or CvgSdt) into the vault contract.
     *         Mints a Staking position (tokenId == 0) or increase one owned.
     *         Staking rewards are claimable after being staked for one full cycle.
     * @dev Staking at cycle N implies that first rewards will be claimable at the beginning of cycle N+2, then every cycle.
     * @param tokenId of the staking position
     * @param amount of stakingAsset to deposit
     */
    function deposit(uint256 tokenId, uint256 amount, address operator) external {
        /// @dev Verify if deposits are paused
        require(!depositPaused, "DEPOSIT_PAUSED");
        /// @dev Verify if the staked amount is > 0
        require(amount != 0, "DEPOSIT_LTE_0");
        /// @dev Memorize storage data
        ICvgControlTower _cvgControlTower = cvgControlTower;
        ISdtStakingPositionManager _sdtStakingPositionManager = _cvgControlTower.sdtStakingPositionManager();
        uint256 _cvgStakingCycle = stakingCycle;
        /// @dev Fetches the receiver, if the caller is the SdtUtilities, we put the initiator of the tx as receiver
        address receiver = msg.sender == _cvgControlTower.sdtUtilities() ? operator : msg.sender;
        uint256 _tokenId;
        /// @dev If tokenId != 0, user deposits for an already existing position, we have so to check ownership
        if (tokenId != 0) {
            /// @dev Fetches, for the tokenId, the owner, the StakingPositionService linked to and the timestamp of unlocking
            _sdtStakingPositionManager.checkIncreaseDepositCompliance(tokenId, receiver);
            _tokenId = tokenId;
        }
        /// @dev Else, we increment the nextId to get the new tokenId
        else {
            _tokenId = _sdtStakingPositionManager.nextId();
        }

        /// @dev Update the CycleInfo & the TokenInfo for the next cycle
        _updateAmountStakedDeposit(_tokenId, amount, _cvgStakingCycle + 1);

        /// @dev transfers stakingAsset tokens from caller to the vault contract ( SdtBlackhole or CvgSdtStaking )
        stakingAsset.transferFrom(msg.sender, vault, amount);
        /// @dev Mints the NFT to the receiver only when tokenId == 0
        if (tokenId == 0) {
            _sdtStakingPositionManager.mint(receiver);
        }

        emit Deposit(_tokenId, receiver, _cvgStakingCycle, amount);
    }

    /**
     * @notice Withdraw stakingAsset (sdAsset-gauge or CvgSdt) from the vault to the Staking Position owner.
     *         Removing rewards before the end of a cycle leads to the loss of all accumulated rewards during this cycle.
     * @dev Withdrawing always removes first from the staked amount not yet eligible to rewards.
     * @param tokenId Staking Position to withdraw token from
     * @param amount Amount of stakingAsset to withdraw
     */
    function withdraw(uint256 tokenId, uint256 amount) external checkCompliance(tokenId) {
        require(amount != 0, "WITHDRAW_LTE_0");

        uint256 _cvgStakingCycle = stakingCycle;

        /// @dev Update the CycleInfo & the TokenInfo for the current & next cycle
        _updateAmountStakedWithdraw(tokenId, amount, _cvgStakingCycle);

        /// @dev Calls in low level the function withdrawing funds from the vault to the user
        _callWithSignature(amount);

        emit Withdraw(tokenId, msg.sender, _cvgStakingCycle, amount);
    }

    /**
     * @notice Claim CVG rewards for a Staking Position on one OR several already passed AND not claimed cycles.
     * @dev    CVG are minted on the fly to the owner of the Staking Position
     * @param tokenId   Staking Position id to claim the rewards of.
     */
    function claimCvgRewards(uint256 tokenId) external checkCompliance(tokenId) {
        uint128 actualCycle = stakingCycle;

        uint128 lastClaimedCvg = _lastClaims[tokenId].lastClaimedCvg;
        uint128 lastClaimedSdt = _lastClaims[tokenId].lastClaimedSdt;
        /// @dev As claim claimCvgSdtRewards claims also Cvg, if the last claim is an sdt claim, we consider it as the lastClaimed cycle for Cvg.
        ///      Else we take de lastClaimed on Cvg.
        uint128 lastClaimedCycle = lastClaimedCvg < lastClaimedSdt ? lastClaimedSdt : lastClaimedCvg;
        uint256 lengthHistory = _stakingHistoryByToken[tokenId].length;

        /// @dev If never claimed on this token
        if (lastClaimedCycle == 0) {
            /// @dev Get the length of the history
            lastClaimedCycle = uint128(_stakingHistoryByToken[tokenId][0]);
        }

        require(actualCycle > lastClaimedCycle, "ALL_CVG_CLAIMED_FOR_NOW");

        uint256 _totalAmount;
        for (; lastClaimedCycle < actualCycle; ) {
            /// @dev Retrieve the staked amount at the iterated cycle for this Staking position
            uint256 tokenStaked = _stakedAmountEligibleAtCycle(lastClaimedCycle, tokenId, lengthHistory);
            uint256 claimableAmount;
            /// @dev If no staked amount are eligible to rewards on the iterated cycle.
            if (tokenStaked != 0) {
                /// @dev Computes the staking share of the Staking Position compare to the total Staked.
                ///      By multiplying this share by the total CVG distributed for the cycle, we get the claimable amount.
                claimableAmount =
                    (tokenStaked * _cycleInfo[lastClaimedCycle].cvgRewardsAmount) /
                    _cycleInfo[lastClaimedCycle].totalStaked;
                /// @dev increments the total amount in CVG to mint to the user
                _totalAmount += claimableAmount;
            }

            unchecked {
                ++lastClaimedCycle;
            }
        }
        require(_totalAmount > 0, "NO_CVG_TO_CLAIM");

        /// @dev set the cycle as claimed for the NFT
        _lastClaims[tokenId].lastClaimedCvg = actualCycle;

        /// @dev mint CVG to user
        cvg.mintStaking(msg.sender, _totalAmount);

        emit ClaimCvgMultiple(tokenId, msg.sender);
    }

    /**
     * @notice Claim CVG and SDT rewards for a Staking Position on one OR several already passed AND not claimed cycles.
     *         Also allows to claim SDT rewards only if CVG rewards
     * @dev    CVG are minted on the fly to the owner of the Staking Position
     * @param _tokenId    of the Position to claim the rewards on
     * @param _isConvert  convert SDT to CvgSdt
     * @param _isMint     mint 1:1 through CvgSdt if true, swap through stable pool if false
     */
    function claimCvgSdtRewards(uint256 _tokenId, bool _isConvert, bool _isMint) external checkCompliance(_tokenId) {
        (uint256 cvgClaimable, ICommonStruct.TokenAmount[] memory tokenAmounts) = _claimCvgSdtRewards(_tokenId);

        ISdtRewardReceiver(cvgControlTower.sdtRewardReceiver()).claimCvgSdtSimple(
            msg.sender,
            cvgClaimable,
            tokenAmounts,
            _isConvert,
            _isMint
        );

        emit ClaimCvgSdtMultiple(_tokenId, msg.sender);
    }

    /**
     * @notice Claim CVG and SDT rewards for a Staking Position on one OR several already passed AND not claimed cycles.
     *         Also allows to claim SDT rewards only if CVG rewards
     * @dev    CVG are minted on the fly to the owner of the Staking Position
     * @param tokenId    of the Position to claim the rewards on
     * @param operator   used if called by the SdtUtilities, allows to claim of several tokenId at the same time
     */
    function claimCvgSdtMultiple(
        uint256 tokenId,
        address operator
    ) external returns (uint256, ICommonStruct.TokenAmount[] memory) {
        /// @dev Only the SdtRewardReceiver can claim this function.
        require(msg.sender == address(sdtRewardReceiver), "NOT_SDT_REWARD_RECEIVER");
        (uint256 cvgClaimable, ICommonStruct.TokenAmount[] memory sdtRewards) = _claimCvgSdtRewards(tokenId);

        emit ClaimCvgSdtMultiple(tokenId, operator);
        return (cvgClaimable, sdtRewards);
    }

    /**
     * @notice Claim CVG and SDT rewards for a Staking Position on one OR several already passed AND not claimed cycles.
     *         Also allows to claim SDT rewards only if CVG rewards
     * @dev    CVG are minted on the fly to the owner of the Staking Position
     * @param tokenId    of the Position to claim the rewards of.
     */
    function _claimCvgSdtRewards(
        uint256 tokenId
    ) internal returns (uint256, ICommonStruct.TokenAmount[] memory tokenAmounts) {
        uint128 lastClaimedCvg = _lastClaims[tokenId].lastClaimedCvg;
        uint128 lastClaimedSdt = _lastClaims[tokenId].lastClaimedSdt;
        uint128 actualCycle = stakingCycle;
        uint256 lengthHistory = _stakingHistoryByToken[tokenId].length;

        /// @dev If never claimed on this token
        if (lastClaimedSdt == 0) {
            /// @dev Set the lastClaimed as the first action.
            lastClaimedSdt = uint128(_stakingHistoryByToken[tokenId][0]);
        }
        require(actualCycle > lastClaimedSdt, "ALL_SDT_CLAIMED_FOR_NOW");

        /// @dev Total amount of CVG, accumulated through all cycles and minted at the end of the function
        uint256 _cvgClaimable;

        uint256 maxLengthRewards = numberOfSdtRewards;
        /// @dev Array of all rewards from StakeDao, all cycles are accumulated in this array and transfer at the end of the function
        ICommonStruct.TokenAmount[] memory _totalRewardsClaimable = new ICommonStruct.TokenAmount[](maxLengthRewards);

        uint256 newLastClaimSdt;
        bool isSdtRewards;
        for (; lastClaimedSdt < actualCycle; ) {
            /// @dev Retrieve the amount staked at the iterated cycle for this Staking position.
            uint256 tokenStaked = _stakedAmountEligibleAtCycle(lastClaimedSdt, tokenId, lengthHistory);
            /// @dev Retrieve the total amount staked on the iterated cycle.
            uint256 totalStaked = _cycleInfo[lastClaimedSdt].totalStaked;
            /// @dev Nothing to claim on this cycle.
            if (tokenStaked != 0) {
                /// @dev CVG PART
                ///      If the CVG rewards haven't been claimed on the iterated cycle
                if (lastClaimedCvg <= lastClaimedSdt) {
                    /// @dev Computes the staking share of the Staking Position compared to the total Staked.
                    ///      By multiplying this share by the total CVG distributed for the cycle, we get the claimable amount.
                    /// @dev Increments the total amount in CVG to mint to the user
                    _cvgClaimable += ((tokenStaked * _cycleInfo[lastClaimedSdt].cvgRewardsAmount) / totalStaked);
                }

                /// @dev StakeDao PART
                /// @dev We only do the SDT computation when SDT has been processed for the iterated cycle.
                if (_cycleInfo[lastClaimedSdt].isSdtProcessed) {
                    for (uint256 erc20Id; erc20Id < maxLengthRewards; ) {
                        /// @dev Get the ERC20 and the amount distributed during on the iterated cycle
                        ICommonStruct.TokenAmount memory rewardAsset = _sdtRewardsByCycle[lastClaimedSdt][erc20Id + 1];

                        /// @dev If there is no amount of this rewardAsset distributed on this cycle
                        if (rewardAsset.amount != 0) {
                            isSdtRewards = true;
                            /// @dev if the token is set for the first time
                            if (address(_totalRewardsClaimable[erc20Id].token) == address(0)) {
                                /// @dev Get the ERC20 and the amount distributed on the iterated cycle.
                                _totalRewardsClaimable[erc20Id].token = rewardAsset.token;
                            }
                            /// @dev Computes the staking share of the Staking Position compared to the total Staked.
                            ///      By multiplying this share by the total of the StakeDao reward distributed for the cycle, we get the claimable amount.
                            ///      Increment the total rewarded amount for the iterated ERC20.
                            _totalRewardsClaimable[erc20Id].amount += ((tokenStaked * rewardAsset.amount) /
                                totalStaked);
                        }
                        unchecked {
                            ++erc20Id;
                        }
                    }
                    newLastClaimSdt = lastClaimedSdt;
                }
            }

            unchecked {
                ++lastClaimedSdt;
            }
        }

        require(isSdtRewards, "NO_SDT_REWARDS_CLAIMABLE");

        /// @dev Set the last claim for Sdt reward process
        /// @dev In case a position claims CvgSdt just after a processStakerRewards, before the processSdtRewards.
        ///      The position has to flag Cvg as claimed until the actual cycle.
        if (newLastClaimSdt < actualCycle) {
            _lastClaims[tokenId].lastClaimedCvg = actualCycle;
        }
        _lastClaims[tokenId].lastClaimedSdt = uint128(newLastClaimSdt) + 1;

        return (_cvgClaimable, _totalRewardsClaimable);
    }

    /* =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=
                    CYCLE PROCESSING EXTERNAL
    =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-= */

    /**
     * @notice launches the CVG reward process.
     * @dev    Updates the internal stakingCycle, writes the amount of CVG distributed for the finished cycle and reports the totalStaked on the next cycle.
     * @param amount Amount of Cvg to distribute as rewards for the current cycle, computed by the CvgRewards
     */
    function processStakersRewards(uint256 amount) external {
        require(msg.sender == address(cvgControlTower.cvgRewards()), "NOT_CVG_REWARDS");

        /// @dev Increments the cvg cycle
        uint256 _cvgStakingCycle = stakingCycle++;

        /// @dev Sets the amount computed by the CvgRewards ( related to Gauge weights ) in the triggered cycle.
        _cycleInfo[_cvgStakingCycle].cvgRewardsAmount = amount;
        /// @dev Reports the old totalStaked on the new cycle
        _cycleInfo[_cvgStakingCycle + 2].totalStaked = _cycleInfo[_cvgStakingCycle + 1].totalStaked;
        /// @dev Flags this cycle as processed for CVG rewards
        _cycleInfo[_cvgStakingCycle].isCvgProcessed = true;

        emit CvgCycleProcess(_cvgStakingCycle, amount);
    }

    /**
     * @notice Pull Rewards from the paired buffer.
     *         Associate these rewards to the last cycle.
     *         Is callable only one time per cycle, after Cvg rewards have been processed.
     * @dev    We need to wait that processCvgRewards writes the final totalStaked amount on a cycle before processing SDT rewards.
     *         As we are merging all rewards in the claimCvgSdt & that rewards from buffer may differ, rewards from StakeDao must always be written at the same index.
     *         We are so incrementing the numberOfSdtRewards for each new token distributed in the StakeDao rewards.
     */
    function processSdtRewards() external {
        /// @dev Retrieve last staking cycle
        uint256 _cvgStakingCycle = stakingCycle - 1;
        require(_cycleInfo[_cvgStakingCycle].isCvgProcessed, "CVG_CYCLE_NOT_PROCESSED");
        require(!_cycleInfo[_cvgStakingCycle].isSdtProcessed, "SDT_REWARDS_ALREADY_PROCESSED");

        /// @dev call and returns tokens and amounts returned in rewards by the gauge
        ICommonStruct.TokenAmount[] memory _rewardAssets = buffer.pullRewards(msg.sender);

        for (uint256 i; i < _rewardAssets.length; ) {
            IERC20 _token = _rewardAssets[i].token;
            uint256 erc20Id = _tokenToId[_token];
            if (erc20Id == 0) {
                uint256 _numberOfSdtRewards = ++numberOfSdtRewards;
                _tokenToId[_token] = _numberOfSdtRewards;
                erc20Id = _numberOfSdtRewards;
            }

            _sdtRewardsByCycle[_cvgStakingCycle][erc20Id] = ICommonStruct.TokenAmount({
                token: _token,
                amount: _rewardAssets[i].amount
            });
            unchecked {
                ++i;
            }
        }

        _cycleInfo[_cvgStakingCycle].isSdtProcessed = true;

        emit ProcessSdtRewards(_cvgStakingCycle, msg.sender, _rewardAssets);
    }

    /* =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=
                            PUBLIC
    =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-= */

    /**
     *  @notice Finds NFT staked amount eligible for rewards for a specified _cycleId.
     *          Finds the latest deposit or withdraw (last action) before the given _cycleId to retrieve the staked amount of the NFT at this period
     *  @param _tokenId  ID of the token to find the staked amount eligible to rewards
     *  @param _cycleId  Cycle ID  where to find the staked amount eligible to rewards
     *  @return The staked amount eligible to rewards
     */
    function stakedAmountEligibleAtCycle(
        uint256 _cycleId,
        uint256 _tokenId,
        uint256 _actualCycle
    ) external view returns (uint256) {
        /// @dev _cycleId be greater or equal than the cycle of the contract
        if (_cycleId >= _actualCycle) return 0;

        /// @dev if no action has been performed on this position, it means it's not created so returns 0
        uint256 length = _stakingHistoryByToken[_tokenId].length;
        if (length == 0) return 0;

        /// @dev If the cycleId is smaller than the first time a staking action occured on
        if (_cycleId < _stakingHistoryByToken[_tokenId][0]) return 0;

        uint256 historyCycle;
        /// @dev Finds the cycle of the last first action performed before the {_cycleId}
        for (uint256 i = length - 1; ; ) {
            historyCycle = _stakingHistoryByToken[_tokenId][i];
            if (historyCycle > _cycleId) {
                unchecked {
                    --i;
                }
            } else {
                break;
            }
        }

        /// @dev Return the amount staked on this cycle
        return _tokenInfoByCycle[historyCycle][_tokenId].amountStaked;
    }

    /**
     *  @notice Finds NFT staked amount eligible for rewards for a specified _cycleId.
     *          Finds the latest deposit or withdraw (last action) before the given _cycleId to retrieve the staked amount of the NFT at this period
     *  @param cycleId  ID of the token to find the staked amount eligible to rewards
     *  @param tokenId  Cycle ID  where to find the staked amount eligible to rewards
     *  @param lengthHistory  Cycle ID  where to find the staked amount eligible to rewards
     *  @return The staked amount eligible to rewards
     */
    function _stakedAmountEligibleAtCycle(
        uint256 cycleId,
        uint256 tokenId,
        uint256 lengthHistory
    ) internal view returns (uint256) {
        uint256 i = lengthHistory - 1;
        uint256 historyCycle = _stakingHistoryByToken[tokenId][i];
        /// @dev Finds the cycle of the last first action performed before the {_cycleId}
        for (;;) {
            if (historyCycle > cycleId) {
                historyCycle = _stakingHistoryByToken[tokenId][i];
                unchecked {
                    --i;
                }
            } else {
                break;
            }
        }

        return _tokenInfoByCycle[historyCycle][tokenId].amountStaked;
    }

    /**
     *  @notice Retrieves the total amount staked for a Staking Position.
     *  @dev    Uses the array of all Staking/Withdraw history to retrieve the last staking value updated in case a user doesn't stake/withdraw at each cycle.
     *  @param _tokenId  Id of the Staking position.
     *  @return The total amount staked on this position.
     */
    function tokenTotalStaked(uint256 _tokenId) public view returns (uint256) {
        /// @dev Retrieve the amount of cycle with action on it
        uint256 _cycleLength = _stakingHistoryByToken[_tokenId].length;
        /// @dev If 0, means that no action has ever been made on this tokenId
        if (_cycleLength == 0) return 0;

        /// @dev Retrieves the last cycle where an action occured
        /// @dev Fetches the amount staked on this cycle in tokenInfoByCycle
        return _tokenInfoByCycle[_stakingHistoryByToken[_tokenId][_cycleLength - 1]][_tokenId].amountStaked;
    }

    /* =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=
                        INTERNALS/PRIVATES
    =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-= */
    /**
     *  @dev Updates NFT staking information on deposit.
     *       When a user stakes, it's always linking this staked amount for the next cycle.
     *       Increase also the total staked amount for the next cycle.
     *       Tracks also for cycle in the past the amount staked for each positions.
     *  @param tokenId    Id of the Staking position
     *  @param amount     Amount of staked asset to deposit
     *  @param nextCycle  Id of the next cvg cycle
     */
    function _updateAmountStakedDeposit(uint256 tokenId, uint256 amount, uint256 nextCycle) internal {
        /// @dev Get the amount already staked on this position and adds it the new deposited amount
        uint256 _newTokenStakedAmount = tokenTotalStaked(tokenId) + amount;

        /// @dev updates the amount staked for this tokenId for the next cvgCycle
        _tokenInfoByCycle[nextCycle][tokenId].amountStaked = _newTokenStakedAmount;

        /**
         * @dev Increments the pending amount with the deposited amount.
         *      The pending amount is the staked amount still in accumulation mode.
         *      Is always removed from the witdhraw before the amountStaked.
         */
        _tokenInfoByCycle[nextCycle][tokenId].pendingStaked += amount;

        /// @dev increments the total amount staked on the Staking Contract for the nextCycle
        _cycleInfo[nextCycle].totalStaked += amount;

        uint256 cycleLength = _stakingHistoryByToken[tokenId].length;

        /// @dev If it's the mint of the position
        if (cycleLength == 0) {
            _stakingHistoryByToken[tokenId].push(nextCycle);
        }
        /// @dev Else it's not the mint of the position
        else {
            /// @dev fetches the _lastActionCycle where an action has been performed
            uint256 _lastActionCycle = _stakingHistoryByToken[tokenId][cycleLength - 1];

            /// @dev if this _lastActionCycle is less than the next cycle => it's the first deposit done on this cycle
            if (_lastActionCycle < nextCycle) {
                uint256 currentCycle = nextCycle - 1;
                /// @dev if this _lastActionCycle is less than the current cycle =>
                ///      No deposits occurred on the last cycle & no withdraw on this cycle
                if (_lastActionCycle < currentCycle) {
                    /// @dev we have so to checkpoint the current cycle
                    _stakingHistoryByToken[tokenId].push(currentCycle);
                    /// @dev and to report the amountStaked of the lastActionCycle to the currentCycle
                    _tokenInfoByCycle[currentCycle][tokenId].amountStaked = _tokenInfoByCycle[_lastActionCycle][tokenId]
                        .amountStaked;
                }
                /// @dev checkpoint the next cycle
                _stakingHistoryByToken[tokenId].push(nextCycle);
            }
        }
    }

    /**
     *  @dev Updates NFT and total amount staked for a tokenId when a withdraw action occurs.
     *       It will first remove amount in pending on the next cycle to remove first the amount not eligible to rewards for the current cycle.
     *       If the withdrawn amount is greater than the pending, we start to withdraw staked token from the next cycle then the leftover from the staking eligible to rewards.
     *  @param tokenId      tokenId to withdraw on
     *  @param amount       of stakedAsset to withdraw
     *  @param currentCycle id of the Cvg cycle
     */
    function _updateAmountStakedWithdraw(uint256 tokenId, uint256 amount, uint256 currentCycle) internal {
        uint256 nextCycle = currentCycle + 1;
        /// @dev get pending staked amount not already eligible for rewards
        uint256 nextCyclePending = _tokenInfoByCycle[nextCycle][tokenId].pendingStaked;
        /// @dev Get amount already staked on the token when the last operation occurred
        uint256 _tokenTotalStaked = tokenTotalStaked(tokenId);

        /// @dev Verify that the withdrawn amount is lower than the total staked amount
        require(amount <= _tokenTotalStaked, "WITHDRAW_EXCEEDS_STAKED_AMOUNT");
        uint256 _newTokenStakedAmount = _tokenTotalStaked - amount;

        /// @dev update last amountStaked for current cycle
        uint256 _lastActionCycle = _stakingHistoryByToken[tokenId][_stakingHistoryByToken[tokenId].length - 1];

        /// @dev if this _lastActionCycle is less than the current cycle =>
        ///      No deposits occurred on the last cycle & no withdraw on this cycle
        if (_lastActionCycle < currentCycle) {
            /// @dev we have so to checkpoint the current cycle
            _stakingHistoryByToken[tokenId].push(currentCycle);
            /// @dev and to report the amountStaked of the lastActionCycle to the currentCycle
            _tokenInfoByCycle[currentCycle][tokenId].amountStaked = _tokenInfoByCycle[_lastActionCycle][tokenId]
                .amountStaked;
        }

        /// @dev updates the amount staked for this position for the next cycle
        _tokenInfoByCycle[nextCycle][tokenId].amountStaked = _newTokenStakedAmount;

        /// @dev Fully removes the amount from the totalStaked of next cycle.
        ///      This withdrawn amount is not anymore eligible to the distribution of the next cycle.
        _cycleInfo[nextCycle].totalStaked -= amount;

        /// @dev If there is some token deposited on this cycle ( pending token )
        ///      We first must to remove them before the tokens that are already accumulating rewards
        if (nextCyclePending != 0) {
            /// @dev If the amount to withdraw is lower or equal to the pending amount
            if (nextCyclePending >= amount) {
                /// @dev we decrement this pending amount
                _tokenInfoByCycle[nextCycle][tokenId].pendingStaked -= amount;
            }
            /// @dev Else, the amount to withdraw is greater than the pending
            else {
                /// @dev Computes the amount to remove from the staked amount eligible to rewards
                uint256 _amount = amount - nextCyclePending;

                /// @dev Fully removes the pending amount for next cycle
                delete _tokenInfoByCycle[nextCycle][tokenId].pendingStaked;

                /// @dev Removes the adjusted amount to the staked total amount eligible to rewards
                _cycleInfo[currentCycle].totalStaked -= _amount;

                /// @dev Removes the adjusted amount to the staked position amount eligible to rewards
                _tokenInfoByCycle[currentCycle][tokenId].amountStaked -= _amount;
            }
        }
        /// @dev If nothing has been desposited on this cycle
        else {
            /// @dev removes the withdrawn amount to the staked total amount eligible to rewards
            _cycleInfo[currentCycle].totalStaked -= amount;
            /// @dev removes the withdrawn amount to the staked token amount eligible to rewards
            _tokenInfoByCycle[currentCycle][tokenId].amountStaked -= amount;
        }
    }

    /**
     *  @dev Calls the encoded withdraw function. Allows us to not create 2 differents contracts as :
     *          - All gaugeAssets are withdrawn from SdtBlackHole.
     *          - All CvgSdt are withdrawn from the StakingPositionService directly.
     *  @param _amount of stakedAsset to withdraw
     */
    function _callWithSignature(uint256 _amount) internal {
        /// @dev Call the vault contract with the function described in the signature
        ///      The receiver is always the msg.sender of the tx
        // solhint-disable-next-line avoid-low-level-calls
        (bool success, ) = withdrawCallInfo.addr.call(
            abi.encodePacked(withdrawCallInfo.signature, abi.encode(msg.sender), abi.encode(_amount))
        );
        require(success, "Failed to withdraw");
    }

    /* =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=
                            INFO
    =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-= */

    /**
     *  @notice Fetches all data needed for the NFT logo being displayed
     *  @param tokenId of the position to get informations
     */
    function stakingInfo(uint256 tokenId) public view returns (ISdtStakingPositionService.StakingInfo memory) {
        uint256 pending = _tokenInfoByCycle[stakingCycle + 1][tokenId].pendingStaked;

        (uint256 _cvgClaimable, ICommonStruct.TokenAmount[] memory _sdtRewardsClaimable) = getAllClaimableAmounts(
            tokenId
        );

        return (
            ISdtStakingPositionService.StakingInfo({
                tokenId: tokenId,
                symbol: symbol,
                pending: pending,
                totalStaked: tokenTotalStaked(tokenId) - pending,
                cvgClaimable: _cvgClaimable,
                sdtClaimable: _sdtRewardsClaimable
            })
        );
    }

    /* =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=
                            GETTERS
    =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-= */

    /**
     *  @notice Fetches and computes, for a _tokenId.
     *  @param tokenId  Id of the token to fetch the amount of rewards from
     *  @return An array of amount claimable per cycle for CVG
     */
    function getAllClaimableCvgAmount(uint256 tokenId) public view returns (uint256) {
        uint256 actualCycle = stakingCycle;
        uint128 lastClaimedCvg = _lastClaims[tokenId].lastClaimedCvg;
        uint128 lastClaimedSdt = _lastClaims[tokenId].lastClaimedSdt;
        /// @dev As claim claimCvgSdtRewards claims also Cvg, if the last claim is an sdt claim, we consider it as the lastClaimed cycle for Cvg.
        ///      Else we take de lastClaimed on Cvg.
        uint248 lastClaimedCycle = lastClaimedCvg < lastClaimedSdt ? lastClaimedSdt : lastClaimedCvg;
        uint256 lengthHistory = _stakingHistoryByToken[tokenId].length;

        /// @dev If never claimed on this token
        if (lastClaimedCycle == 0) {
            /// @dev Get the length of the history
            lastClaimedCycle = uint128(_stakingHistoryByToken[tokenId][0]);
        }

        if (actualCycle <= lastClaimedCycle) {
            return 0;
        }

        uint256 _totalAmount;
        for (; lastClaimedCycle < actualCycle; ) {
            /// @dev Retrieve the staked amount at the iterated cycle for this Staking position
            uint256 tokenStaked = _stakedAmountEligibleAtCycle(lastClaimedCycle, tokenId, lengthHistory);
            uint256 claimableAmount;
            /// @dev If no staked amount are eligible to rewards on the iterated cycle.
            if (tokenStaked > 0) {
                /// @dev Computes the staking share of the Staking Position compare to the total Staked.
                ///      By multiplying this share by the total CVG distributed for the cycle, we get the claimable amount.
                claimableAmount =
                    (tokenStaked * _cycleInfo[lastClaimedCycle].cvgRewardsAmount) /
                    _cycleInfo[lastClaimedCycle].totalStaked;
                /// @dev increments the total amount in CVG to mint to the user
                _totalAmount += claimableAmount;
            }

            unchecked {
                ++lastClaimedCycle;
            }
        }

        return _totalAmount;
    }

    /**
     *  @notice Computes, for a {_tokenId}, the total rewards claimable in CVG and from SDT for a range of cycle bewteen {fromCycle} and {toCycle}.
     *          For SDT rewards, it aggregates amounts of same token from different cycles in the returned array.
     *  @param tokenId  Staking position ID able ton claim the rewards
     *  @return total amount of Cvg claimable by the {_tokenId} in the cycle range
     *  @return array of total token / amount pair claimable by the {_tokenId} in the cycle range
     */
    function getAllClaimableAmounts(uint256 tokenId) public view returns (uint256, ICommonStruct.TokenAmount[] memory) {
        uint128 lastClaimedCvg = _lastClaims[tokenId].lastClaimedCvg;
        uint128 lastClaimedSdt = _lastClaims[tokenId].lastClaimedSdt;
        uint128 actualCycle = stakingCycle;
        uint256 lengthHistory = _stakingHistoryByToken[tokenId].length;

        /// @dev If never claimed on this token
        if (lastClaimedSdt == 0) {
            /// @dev Get the length of the history
            lastClaimedSdt = uint128(_stakingHistoryByToken[tokenId][0]);
        }

        uint256 maxLengthRewards = numberOfSdtRewards;
        uint256 realLengthRewards;
        ICommonStruct.TokenAmount[] memory _totalSdtRewardsClaimable = new ICommonStruct.TokenAmount[](
            maxLengthRewards
        );

        bool isSdtRewards;
        uint256 _cvgClaimable;

        for (; lastClaimedSdt < actualCycle; ) {
            /// @dev Retrieve the amount staked at the iterated cycle for this Staking position.
            uint256 tokenStaked = _stakedAmountEligibleAtCycle(lastClaimedSdt, tokenId, lengthHistory);
            /// @dev Retrieve the total amount staked on the iterated cycle.
            uint256 totalStaked = _cycleInfo[lastClaimedSdt].totalStaked;
            /// @dev Nothing to claim on this cycle.
            if (tokenStaked > 0) {
                /// @dev CVG PART
                ///      If the CVG rewards haven't been claimed on the iterated cycle
                if (lastClaimedCvg <= lastClaimedSdt) {
                    /// @dev Computes the staking share of the Staking Position compare to the total Staked.
                    ///      By multiplying this share by the total CVG distributed for the cycle, we get the claimable amount.
                    uint256 cvgClaimableAmount = (tokenStaked * _cycleInfo[lastClaimedSdt].cvgRewardsAmount) /
                        totalStaked;
                    /// @dev increments the total amount in CVG to mint to the user
                    _cvgClaimable += cvgClaimableAmount;
                }

                /// @dev StakeDao PART
                /// @dev We only do the SDT computation when SDT has been processed for the iterated cycle.
                if (_cycleInfo[lastClaimedSdt].isSdtProcessed) {
                    for (uint256 erc20Id; erc20Id < maxLengthRewards; ) {
                        /// @dev Get the ERC20 and the amount distributed during on the iterated cycle
                        ICommonStruct.TokenAmount memory rewardAsset = _sdtRewardsByCycle[lastClaimedSdt][erc20Id + 1];

                        /// @dev If there is no amount of this rewardAsset distributed on this cycle
                        if (rewardAsset.amount != 0) {
                            isSdtRewards = true;
                            /// @dev if the token is set for the first time
                            if (address(_totalSdtRewardsClaimable[erc20Id].token) == address(0)) {
                                _totalSdtRewardsClaimable[erc20Id].token = rewardAsset.token;
                                ++realLengthRewards;
                            }
                            /// @dev Computes the staking share of the Staking Position compare to the total Staked.
                            ///      By multiplying this share by the total of the StakeDao reward distributed for the cycle, we get the claimable amount.
                            uint256 rewardAmount = (tokenStaked * rewardAsset.amount) / totalStaked;

                            /// @dev increment the total rewarded amount for the iterated ERC20
                            _totalSdtRewardsClaimable[erc20Id].amount += rewardAmount;
                        }
                        unchecked {
                            ++erc20Id;
                        }
                    }
                }
            }

            unchecked {
                ++lastClaimedSdt;
            }
        }

        /// @dev this array should have the right length
        ICommonStruct.TokenAmount[] memory _sdtRewardsClaimable = new ICommonStruct.TokenAmount[](realLengthRewards);

        delete realLengthRewards;
        for (uint256 i; i < _totalSdtRewardsClaimable.length; ) {
            if (_totalSdtRewardsClaimable[i].amount != 0) {
                _sdtRewardsClaimable[realLengthRewards++] = ICommonStruct.TokenAmount({
                    token: _totalSdtRewardsClaimable[i].token,
                    amount: _totalSdtRewardsClaimable[i].amount
                });
            }
            unchecked {
                ++i;
            }
        }

        return (_cvgClaimable, _sdtRewardsClaimable);
    }

    /// @notice return cycles & associated rewards claimable for a tokenId from a past cycle to actual cycle
    function getClaimableCyclesAndAmounts(uint256 tokenId) external view returns (ClaimableCyclesAndAmounts[] memory) {
        uint256 actualCycle = stakingCycle;
        uint256 lastClaimedCvg = _lastClaims[tokenId].lastClaimedCvg;
        uint256 lastClaimedSdt = _lastClaims[tokenId].lastClaimedSdt;
        uint256 lengthHistory = _stakingHistoryByToken[tokenId].length;

        /// @dev If never claimed on this token
        if (lastClaimedSdt == 0) {
            /// @dev Get the length of the history
            lastClaimedSdt = _stakingHistoryByToken[tokenId][0];
        }

        /// @dev potential max length
        ClaimableCyclesAndAmounts[] memory claimableCyclesAndAmounts = new ClaimableCyclesAndAmounts[](
            actualCycle - lastClaimedSdt
        );
        uint256 counter;
        uint256 maxLengthRewards = numberOfSdtRewards;
        for (; lastClaimedSdt < actualCycle; ) {
            uint256 amountStaked = _stakedAmountEligibleAtCycle(lastClaimedSdt, tokenId, lengthHistory);
            uint256 totalStaked = _cycleInfo[lastClaimedSdt].totalStaked;
            /// @dev If the position is eligible to claim rewards for the iterated cycle.
            if (amountStaked != 0) {
                uint256 cvgAmount;

                /// @dev CVG PART
                ///      If the CVG rewards haven't been claimed on the iterated cycle
                if (lastClaimedCvg <= lastClaimedSdt) {
                    /// @dev Computes the staking share of the Staking Position compare to the total Staked.
                    ///      By multiplying this share by the total CVG distributed for the cycle, we get the claimable amount.
                    cvgAmount = (amountStaked * _cycleInfo[lastClaimedSdt].cvgRewardsAmount) / totalStaked;
                }

                /// @dev StakeDao PART
                /// @dev We only do the SDT computation when SDT has been processed for the iterated cycle.
                ICommonStruct.TokenAmount[] memory _sdtRewardsClaimable;
                if (_cycleInfo[lastClaimedSdt].isSdtProcessed) {
                    _sdtRewardsClaimable = new ICommonStruct.TokenAmount[](maxLengthRewards);
                    for (uint256 x; x < maxLengthRewards; ) {
                        ICommonStruct.TokenAmount memory rewardAsset = _sdtRewardsByCycle[lastClaimedSdt][x + 1];
                        if (rewardAsset.amount != 0) {
                            _sdtRewardsClaimable[x] = ICommonStruct.TokenAmount({
                                token: rewardAsset.token,
                                amount: (amountStaked * rewardAsset.amount) / totalStaked
                            });
                        } else {
                            // solhint-disable-next-line no-inline-assembly
                            assembly {
                                /// @dev this reduce the length of the array to not return some useless 0 at the end
                                mstore(_sdtRewardsClaimable, sub(mload(_sdtRewardsClaimable), 1))
                            }
                        }
                        unchecked {
                            ++x;
                        }
                    }
                }
                claimableCyclesAndAmounts[counter++] = ClaimableCyclesAndAmounts({
                    cycleClaimable: lastClaimedSdt,
                    cvgRewards: cvgAmount,
                    sdtRewards: _sdtRewardsClaimable
                });
            } else {
                // solhint-disable-next-line no-inline-assembly
                assembly {
                    /// @dev this reduce the length of the array to not return some useless 0 at the end
                    mstore(claimableCyclesAndAmounts, sub(mload(claimableCyclesAndAmounts), 1))
                }
            }

            unchecked {
                ++lastClaimedSdt;
            }
        }

        return claimableCyclesAndAmounts;
    }

    /**
     *  @notice finds NFT staked amount for specified CVG cycle
     *          Finds the latest deposit(last action) before the given cycleId
     *          to retrieve the staked amount of the NFT at this period
     *  @param cycleId  of stakedAsset to withdraw
     *  @return the amount staked for the {_tokenId} on the cycle {_cycleId}
     */
    function getProcessedSdtRewards(uint256 cycleId) external view returns (ICommonStruct.TokenAmount[] memory) {
        uint256 maxLengthRewards = numberOfSdtRewards;
        ICommonStruct.TokenAmount[] memory _rewards = new ICommonStruct.TokenAmount[](maxLengthRewards);
        uint256 index;
        for (uint256 x; x < maxLengthRewards; ) {
            if (_sdtRewardsByCycle[cycleId][x + 1].amount != 0) {
                _rewards[index] = _sdtRewardsByCycle[cycleId][x + 1];
                unchecked {
                    ++index;
                }
            } else {
                // solhint-disable-next-line no-inline-assembly
                assembly {
                    /// @dev this reduces the length of the _rewardsClaimable array not to return some useless 0 at the end
                    mstore(_rewards, sub(mload(_rewards), 1))
                }
            }
            unchecked {
                ++x;
            }
        }
        return _rewards;
    }

    /* =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=
                            SETTERS
    =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-= */
    /// @notice method for the owner to update the deposit status of the contract
    function toggleDepositPaused() external onlyOwner {
        depositPaused = !depositPaused;
    }

    /**
     *  @notice Set the {_buffer} linked to the contract for gaugeAssets only
     *          Called on the creation of the contract by the CloneFactory
     *  @param _buffer to pair with this contract
     */
    function setBuffer(address _buffer) external {
        require(msg.sender == cvgControlTower.cloneFactory(), "NOT_CLONE_FACTORY");
        buffer = ISdtBuffer(_buffer);
    }
}
