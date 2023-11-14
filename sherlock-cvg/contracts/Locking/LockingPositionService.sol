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

import "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/ICvgControlTower.sol";

/**
 * @title Cvg-Finance - LockingPositionService
 * @notice Allows to lock CVG, gives yield and governance power.
 * @dev  When a position is minted, the amount can be split  between 2 different type of CVG :
 *       veCVG : used for voting power ( associated  with MgCVG meta-governance voting power )
 *       | ysCVG : used for treasury shares( allow the user to claim a part of the treasury at each TDE ( treasury distribution event ) )
 *       | the amount  of ys/Ve the user will receive for each CVG locked  is proportional with the duration of the lock.
 */
contract LockingPositionService is Ownable2StepUpgradeable {
    struct LockingPosition {
        uint96 startCycle;
        uint96 lastEndCycle;
        /** @dev  Percentage of the NFT dedicated to ysCvg. */
        uint64 ysPercentage;
        /** @dev  Number of CVG Locked. */
        uint256 totalCvgLocked;
        /** @dev  Meta Governance CVG amount. */
        uint256 mgCvgAmount;
    }

    struct TokenView {
        uint256 tokenId;
        uint128 startCycle;
        uint128 endCycle;
        uint256 cvgLocked;
        uint256 ysActual;
        uint256 ysTotal;
        uint256 veCvgActual;
        uint256 mgCvg;
        uint256 ysPercentage;
    }

    struct TrackingBalance {
        uint256 ysToAdd;
        uint256 ysToSub;
    }

    struct LockingExtension {
        uint128 cycleId;
        uint128 endCycle;
        uint256 cvgLocked;
        uint256 mgCvgAdded;
    }

    event MintLockingPosition(uint256 tokenId, LockingPosition lockingPosition, LockingExtension lockingExtension);
    event IncreaseLockAmount(uint256 tokenId, LockingPosition lockingPosition, LockingExtension lockingExtension);
    event IncreaseLockTime(uint256 tokenId, LockingPosition lockingPosition, uint256 oldEndCycle);
    event IncreaseLockTimeAndAmount(
        uint256 tokenId,
        LockingPosition lockingPosition,
        LockingExtension lockingExtension,
        uint256 oldEndCycle
    );
    event UpdateTotalSupplies(uint256 newYsSupply, uint256 veCvgSupply, uint256 cycle);
    event LockingPositionBurn(uint256 tokenId);

    /** @dev Maximum locking time in cycle(weeks)  */
    uint256 public constant MAX_LOCK = 96;
    /** @dev TDE duration in weeks  */
    uint256 public constant TDE_DURATION = 12;
    uint256 public constant MAX_PERCENTAGE = 100;
    /** @dev pourcentage can only used as multiple of this value */
    uint256 public constant RANGE_PERCENTAGE = 10;

    /** @dev Convergence ControlTower. */
    ICvgControlTower public cvgControlTower;
    /** @dev Convergence CVG. */
    ICvg public cvg;

    /** @dev Total supply of ysCvg. */
    uint256 public totalSupplyYsCvg;

    /** @dev  Keeps global data of a LockingPosition. */
    mapping(uint256 => LockingPosition) public lockingPositions;

    /** @dev Keep track of the ySCvg supply changes for each cycle, so we can compute the totalSupply of ysCvg at each cycle. */
    mapping(uint256 => TrackingBalance) public totalSuppliesTracking;

    /** @dev Keep track of the ysCvg supply at each cycle. */
    mapping(uint256 => uint256) public totalSupplyYsCvgHistories;

    /** @dev Keep track of the update of locking positions. */
    mapping(uint256 => LockingExtension[]) public lockExtensions;

    /** @dev Address => contract is whitelisted to perform locks. */
    mapping(address => bool) public isContractLocker;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initialize the contract with the ConvergenceControlTower address, set the cvgToken address, transfer ownership to the initializer.
     * @param _cvgControlTower ConvergenceControlTower address.
     */
    function initialize(ICvgControlTower _cvgControlTower) external initializer {
        cvgControlTower = _cvgControlTower;
        _transferOwnership(msg.sender);
        ICvg _cvg = _cvgControlTower.cvgToken();
        require(address(_cvg) != address(0), "CVG_ZERO");
        cvg = _cvg;
    }

    /**
     * @dev  Some methods that are called by wallet ,
     * can also be called by cvgUtilities meta functionalities
     * this modifier allow to check both case.
     * it also check that the token is not time locked.
     */
    modifier checkCompliance(uint256 tokenId, address operator) {
        _checkCompliance(tokenId, operator);
        _;
    }

    /**
     * @dev Some methods that are called by wallet ,
     * can also be called by cvgUtilities meta functionalities
     * this modifier allow to check both case.
     */
    modifier onlyWalletOrWhiteListedContract() {
        _onlyWalletOrWhiteListedContract();
        _;
    }

    /**
     * @notice Check the owner of the token  taking into consideration the operator and the msg.sender.
     * @dev  For the swap and bond function, the caller is the cvgUtilities contract, in which case the token property is checked with the operator, otherwise the sender msg.sender is used.
     * @param _tokenId ID of the token.
     * @param _operator address of the operator.
     */
    function _checkTokenOwnerShip(uint256 _tokenId, address _operator) internal view {
        address tokenOwner = cvgControlTower.lockingPositionManager().ownerOf(_tokenId);
        if (msg.sender == cvgControlTower.cvgUtilities()) {
            require(_operator == tokenOwner, "TOKEN_NOT_OWNED");
        } else {
            require(msg.sender == tokenOwner, "TOKEN_NOT_OWNED");
        }
    }

    /**
     *  @notice Check if the token is compliant to be manipulated
     *   this function is used on  methods that can be called by the wallet or the cvgUtilities contract
     *   the check of ownership is done in both case , it also check that the token is not time locked
     *   Time lock is a feature that protects a potential buyer of a token from a malicious front run from the seller.
     *  @param tokenId ID of the token.
     *  @param operator address of the operator.
     */
    function _checkCompliance(uint256 tokenId, address operator) internal view {
        (address ownerOf, uint256 unlockTimestamp) = cvgControlTower.lockingPositionManager().getComplianceInfo(
            tokenId
        );
        if (msg.sender == cvgControlTower.cvgUtilities()) {
            require(operator == ownerOf, "TOKEN_NOT_OWNED");
        } else {
            require(msg.sender == ownerOf, "TOKEN_NOT_OWNED");
        }
        require(unlockTimestamp < block.timestamp, "TOKEN_TIMELOCKED");
    }

    /**
     * @notice Check if the caller is a wallet or a whitelisted contract.
     */
    function _onlyWalletOrWhiteListedContract() internal view {
        require(
            // solhint-disable-next-line avoid-tx-origin
            msg.sender == tx.origin || isContractLocker[msg.sender],
            "NOT_CONTRACT_OR_WL"
        );
    }

    /* =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=
                            INFO
    =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-= */
    struct LockingInfo {
        uint256 tokenId;
        uint256 cvgLocked;
        uint256 lockEnd;
        uint256 ysPercentage;
        uint256 mgCvg;
    }

    /**
     *   @notice Get position information for a given tokenId, used by the CVG display of the token.
     *   @param tokenId is the token ID of the position.
     */
    function lockingInfo(uint256 tokenId) external view returns (LockingInfo memory) {
        uint256 _cvgCycle = cvgControlTower.cvgCycle();
        uint256 tokenLastEndCycle = lockingPositions[tokenId].lastEndCycle;

        return
            LockingInfo({
                tokenId: tokenId,
                cvgLocked: lockingPositions[tokenId].totalCvgLocked,
                lockEnd: tokenLastEndCycle,
                ysPercentage: lockingPositions[tokenId].ysPercentage,
                mgCvg: _cvgCycle > tokenLastEndCycle ? 0 : lockingPositions[tokenId].mgCvgAmount
            });
    }

    /* =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=
                        PUBLIC FUNCTIONS
    =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-= */

    /**
     * @notice Mint a locking position (ERC721) for the user.
     * @dev Lock can't be greater than the Maximum locking time / The end of the lock must finish on a TDE event cycle |  The percentage of ys determines the repartition in veCVG,mgCVG/YsCVG.
     * @param lockDuration is the duration in cycle(week) of the lock.
     * @param amount is the amount of cvg to lock in the position.
     * @param ysPercentage percentage of lock dedicated to treasury shares (ysCVG).
     * @param receiver address of the receiver of the locking position.
     * @param isAddToManagedTokens add the created token in managed tokens(voting power)  directly.
     */
    function mintPosition(
        uint96 lockDuration,
        uint256 amount,
        uint64 ysPercentage,
        address receiver,
        bool isAddToManagedTokens
    ) external onlyWalletOrWhiteListedContract {
        require(amount > 0, "LTE");
        /** @dev Percentage cannot be over 100%. */
        require(ysPercentage <= MAX_PERCENTAGE, "YS_%_OVER_100");
        /** @dev Only percentage with multiple of 10 are possible to use. */
        require(ysPercentage % RANGE_PERCENTAGE == 0, "YS_%_10_MULTIPLE");
        /** @dev Lock cannot be longer than MAX_LOCK. */
        require(lockDuration <= MAX_LOCK, "MAX_LOCK_96_CYCLES");

        ICvgControlTower _cvgControlTower = cvgControlTower;

        /** @dev Retrieve actual staking cycle. */
        uint96 actualCycle = uint96(_cvgControlTower.cvgCycle());
        uint96 endLockCycle = actualCycle + lockDuration;
        /** @dev End of lock must finish on TDE. */
        require(endLockCycle % TDE_DURATION == 0, "END_MUST_BE_TDE_MULTIPLE");

        ILockingPositionManager _lockingPositionManager = _cvgControlTower.lockingPositionManager();

        /// @dev get the nextId on the LockingPosition manager
        uint256 tokenId = _lockingPositionManager.nextId();

        uint256 _mgCvgCreated;
        /** @dev Update checkpoints for YsCvg TotalSupply and Supply by NFT. */
        if (ysPercentage != 0) {
            _ysCvgCheckpoint(lockDuration, (amount * ysPercentage) / MAX_PERCENTAGE, actualCycle, endLockCycle);
        }

        /** @dev Create voting power through Curve contract, link voting power to the  token (NFT). */
        if (ysPercentage != MAX_PERCENTAGE) {
            uint256 amountVote = amount * (MAX_PERCENTAGE - ysPercentage);

            /** @dev Timestamp of the end of locking. */
            _cvgControlTower.votingPowerEscrow().create_lock(
                tokenId,
                amountVote / MAX_PERCENTAGE,
                block.timestamp + (lockDuration + 1) * 7 days
            );
            /// @dev compute the amount of mgCvg
            _mgCvgCreated = (amountVote * lockDuration) / (MAX_LOCK * MAX_PERCENTAGE);

            /// @dev Automatically add the veCVG and mgCVG in the balance taken from Snapshot.
            if (isAddToManagedTokens) {
                _cvgControlTower.lockingPositionDelegate().addTokenAtMint(tokenId, receiver);
            }
        }

        LockingPosition memory lockingPosition = LockingPosition({
            startCycle: actualCycle,
            lastEndCycle: endLockCycle,
            totalCvgLocked: amount,
            mgCvgAmount: _mgCvgCreated,
            ysPercentage: ysPercentage
        });

        /** @dev Associate this Locking position on the tokenId. */
        lockingPositions[tokenId] = lockingPosition;

        LockingExtension memory lockingExtension = LockingExtension({
            cycleId: actualCycle,
            endCycle: endLockCycle,
            cvgLocked: amount,
            mgCvgAdded: _mgCvgCreated
        });

        /** @dev Add a lock extension with the initial params of the token minted. */
        lockExtensions[tokenId].push(lockingExtension);

        /** @dev Transfer CVG from user wallet to here. */
        cvg.transferFrom(msg.sender, address(this), amount);

        /** @dev Mint the ERC721 representing the user position. */
        _lockingPositionManager.mint(receiver);

        emit MintLockingPosition(tokenId, lockingPosition, lockingExtension);
    }

    /**
     * @notice Increase the amount of CVG token in the locking position proportionally from the actual cycle to the end of lock.
     * @dev CheckCompliance is not used in this function, as an increase in the amount cannot be detrimental to a potential buyer.
     * @param tokenId is the token ID of the position to extend
     * @param amount  of cvg to add to the position
     * @param operator address of token owner (used when call from cvgUtilities)
     */
    function increaseLockAmount(
        uint256 tokenId,
        uint256 amount,
        address operator
    ) external onlyWalletOrWhiteListedContract {
        require(amount > 0, "LTE");
        _checkTokenOwnerShip(tokenId, operator);

        ICvgControlTower _cvgControlTower = cvgControlTower;
        LockingPosition memory lockingPosition = lockingPositions[tokenId];

        /** @dev Retrieve actual staking cycle. */
        uint128 actualCycle = _cvgControlTower.cvgCycle();

        /** @dev Impossible to increase the lock in amount after the end of the lock. */
        require(lockingPosition.lastEndCycle > actualCycle, "LOCK_OVER");

        /** @dev YsCvg TotalSupply Part, access only if some % has been given to ys on the NFT. */
        if (lockingPosition.ysPercentage != 0) {
            _ysCvgCheckpoint(
                lockingPosition.lastEndCycle - actualCycle,
                (amount * lockingPosition.ysPercentage) / MAX_PERCENTAGE,
                actualCycle,
                lockingPosition.lastEndCycle
            );
        }

        uint256 _newVotingPower;
        /** @dev Update voting power through Curve contract, link voting power to the nft tokenId. */
        if (lockingPosition.ysPercentage != MAX_PERCENTAGE) {
            uint256 amountVote = amount * (MAX_PERCENTAGE - lockingPosition.ysPercentage);
            _cvgControlTower.votingPowerEscrow().increase_amount(tokenId, amountVote / MAX_PERCENTAGE);
            _newVotingPower = (amountVote * (lockingPosition.lastEndCycle - actualCycle)) / (MAX_LOCK * MAX_PERCENTAGE);
            lockingPositions[tokenId].mgCvgAmount += _newVotingPower;
        }

        /** @dev Update cvgLocked balance. */
        lockingPositions[tokenId].totalCvgLocked += amount;

        LockingExtension memory lockingExtension = LockingExtension({
            cycleId: actualCycle,
            endCycle: lockingPosition.lastEndCycle,
            cvgLocked: amount,
            mgCvgAdded: _newVotingPower
        });

        /** @dev Add a lock extension linked to the Amount Extension. */
        lockExtensions[tokenId].push(lockingExtension);

        /** @dev Transfer CVG from user wallet to here. */
        cvg.transferFrom(msg.sender, address(this), amount);

        emit IncreaseLockAmount(tokenId, lockingPosition, lockingExtension);
    }

    /**
     * @notice Increase the time of the lock
     *         Increasing the locking time will not increase the amount of ysCvg & mgCvg
     *         The amounts will be just extended on the new duration.
     * @dev The token must not be time locked  , as an increase in time can be detrimental to a potential buyer.
     * @param tokenId is the token ID of the position
     * @param durationAdd is the number of cycle to add to the position lockingTime
     */
    function increaseLockTime(
        uint256 tokenId,
        uint256 durationAdd
    ) external checkCompliance(tokenId, address(0)) onlyWalletOrWhiteListedContract {
        ICvgControlTower _cvgControlTower = cvgControlTower;
        /** @dev Retrieve actual staking cycle. */
        uint128 actualCycle = _cvgControlTower.cvgCycle();

        LockingPosition storage lockingPosition = lockingPositions[tokenId];
        uint256 oldEndCycle = lockingPosition.lastEndCycle + 1;
        uint256 newEndCycle = oldEndCycle + durationAdd;

        /** @dev Not possible extend a lock in duration after it's expiration. */
        require(oldEndCycle > actualCycle, "LOCK_TIME_OVER");

        /** @dev Not possible to have an active lock longer than the MAX_LOCK. */
        require(newEndCycle - actualCycle - 1 <= MAX_LOCK, "MAX_LOCK_96_CYCLES");

        /** @dev As the oldEnd cycle is a xTDE_DURATION. */
        /** @dev We just need to verify that the time we add is a xTDE_DURATION to ensure new lock is ending on a xTDE_DURATION. */
        require(durationAdd % TDE_DURATION == 0, "NEW_END_MUST_BE_TDE_MULTIPLE");

        /** @dev YsCvg TotalSupply Part, access only if some % has been given to ys on the NFT. */
        if (lockingPosition.ysPercentage != 0) {
            /** @dev Retrieve the balance registered at the cycle where the ysBalance is supposed to drop. */
            uint256 _ysToReport = balanceOfYsCvgAt(tokenId, oldEndCycle - 1);
            /** @dev Add this value to the tracking on the oldEndCycle. */
            totalSuppliesTracking[oldEndCycle].ysToAdd += _ysToReport;
            /** @dev Report this value in the newEndCycle in the Sub part. */
            totalSuppliesTracking[newEndCycle].ysToSub += _ysToReport;
        }

        /** @dev Vote part, access here only if some % has been given to ve/mg on the NFT. */
        if (lockingPosition.ysPercentage != MAX_PERCENTAGE) {
            /** @dev Increase Locking time to a new timestamp, computed with the cycle. */
            _cvgControlTower.votingPowerEscrow().increase_unlock_time(
                tokenId,
                block.timestamp + ((newEndCycle - actualCycle) * 7 days)
            );
        }

        /** @dev Update the new end cycle on the locking position. */
        lockingPosition.lastEndCycle = uint96(newEndCycle - 1);

        emit IncreaseLockTime(tokenId, lockingPosition, oldEndCycle - 1);
    }

    /**
     * @notice Increase first the time THEN the amount in the position proportionally from the actual cycle to the end of lock.
     * @dev The token must not be time locked, as an increase in the time can be detrimental to a potential buyer.
     * @param tokenId is the token ID of the position
     * @param durationAdd is the number of cycle to add to the position lockingTime
     * @param amount  of cvg to add to the position
     * @param operator address of token owner (used when call from cvgUtilities)
     */
    function increaseLockTimeAndAmount(
        uint256 tokenId,
        uint256 durationAdd,
        uint256 amount,
        address operator
    ) external checkCompliance(tokenId, operator) onlyWalletOrWhiteListedContract {
        require(amount > 0, "LTE");
        ICvgControlTower _cvgControlTower = cvgControlTower;
        /** @dev Retrieve actual staking cycle. */
        uint128 actualCycle = _cvgControlTower.cvgCycle();

        LockingPosition storage lockingPosition = lockingPositions[tokenId];
        uint256 oldEndCycle = lockingPosition.lastEndCycle + 1;
        /** @dev Calculating the new end cycle. */
        uint256 newEndCycle = oldEndCycle + durationAdd;
        /** @dev Check  the new end cycle. */
        require(oldEndCycle > actualCycle, "LOCK_OVER");
        require(newEndCycle - actualCycle - 1 <= MAX_LOCK, "MAX_LOCK_96_CYCLES");
        require(durationAdd % TDE_DURATION == 0, "END_MUST_BE_TDE_MULTIPLE");

        if (lockingPosition.ysPercentage != 0) {
            /** @dev Taking in account the change of YsCvg TotalSupply update. */
            uint256 _ysToReport = balanceOfYsCvgAt(tokenId, oldEndCycle - 1);
            totalSuppliesTracking[oldEndCycle].ysToAdd += _ysToReport;
            totalSuppliesTracking[newEndCycle].ysToSub += _ysToReport;

            _ysCvgCheckpoint(
                newEndCycle - actualCycle - 1,
                (amount * lockingPosition.ysPercentage) / MAX_PERCENTAGE,
                actualCycle,
                newEndCycle - 1
            );
        }

        uint256 _newVotingPower;

        if (lockingPosition.ysPercentage != MAX_PERCENTAGE) {
            /** @dev Update voting power through veCVG contract, link voting power to the nft tokenId. */
            uint256 amountVote = amount * (MAX_PERCENTAGE - lockingPosition.ysPercentage);
            _newVotingPower = (amountVote * (newEndCycle - actualCycle - 1)) / (MAX_LOCK * MAX_PERCENTAGE);
            lockingPosition.mgCvgAmount += _newVotingPower;

            _cvgControlTower.votingPowerEscrow().increase_unlock_time_and_amount(
                tokenId,
                block.timestamp + ((newEndCycle - actualCycle) * 7 days),
                amountVote / MAX_PERCENTAGE
            );
        }

        /** @dev Update the new end cycle on the locking position. */
        lockingPosition.lastEndCycle = uint96(newEndCycle - 1);
        lockingPosition.totalCvgLocked += amount;

        LockingExtension memory _lockingExtension = LockingExtension({
            cycleId: actualCycle,
            endCycle: uint128(newEndCycle - 1),
            cvgLocked: amount,
            mgCvgAdded: _newVotingPower
        });
        /** @dev Keep track of the update on the lock , including mgCvg part. */
        lockExtensions[tokenId].push(_lockingExtension);

        /** @dev Transfer CVG */
        cvg.transferFrom(msg.sender, address(this), amount);

        emit IncreaseLockTimeAndAmount(tokenId, lockingPosition, _lockingExtension, oldEndCycle - 1);
    }

    /**
     * @notice Unlock CVG tokens under the NFT Locking Position : Burn the NFT, Transfer back the CVG to the user.  Rewards from YsDistributor must be claimed before or they will be lost.    * @dev The locking time must be over
     * @param tokenId to burn
     */
    function burnPosition(uint256 tokenId) external {
        _checkTokenOwnerShip(tokenId, address(0));
        ICvgControlTower _cvgControlTower = cvgControlTower;
        uint256 lastEndCycle = lockingPositions[tokenId].lastEndCycle;
        uint256 ysPercentage = lockingPositions[tokenId].ysPercentage;
        uint256 totalCvgLocked = lockingPositions[tokenId].totalCvgLocked;

        require(_cvgControlTower.cvgCycle() > lastEndCycle, "LOCKED");

        /** @dev  if the position contains veCvg , we must remove it from the voting escrow */
        if (ysPercentage != MAX_PERCENTAGE) {
            _cvgControlTower.votingPowerEscrow().withdraw(tokenId);
        }

        /** @dev Burn the NFT representing the position. */
        _cvgControlTower.lockingPositionManager().burn(tokenId);

        /** @dev Transfer CVG back to the user. */
        cvg.transfer(msg.sender, totalCvgLocked);

        emit LockingPositionBurn(tokenId);
    }

    /* =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=
                    ONLY CONTROL TOWER
    =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-= */
    /**
     * @notice Compute the new Ys total supply  by adding and subtracting checkpoints formerly created on mint & increaseLock by the _YsCvgCheckpoint().
     * @dev  Only callable by ControlTower ( DAO ).
     */
    function updateYsTotalSupply() external {
        ICvgControlTower _cvgControlTower = cvgControlTower;

        require(msg.sender == address(_cvgControlTower), "NOT_CONTROL_TOWER");
        uint256 actualCycle = _cvgControlTower.cvgCycle();

        uint256 totalSupplyYsCvgBeforeUpdate = totalSupplyYsCvg;

        /** @dev Register the last totalSupply for the past cycle. */
        totalSupplyYsCvgHistories[actualCycle - 1] = totalSupplyYsCvgBeforeUpdate;

        /** @dev Update ysCVG  total supply with checkpoints for the actual cycle */
        totalSupplyYsCvg =
            totalSupplyYsCvgBeforeUpdate +
            totalSuppliesTracking[actualCycle].ysToAdd -
            totalSuppliesTracking[actualCycle].ysToSub;

        emit UpdateTotalSupplies(
            totalSupplyYsCvgBeforeUpdate,
            _cvgControlTower.votingPowerEscrow().total_supply(),
            actualCycle - 1
        );
    }

    /* =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=
                    INTERNAL FUNCTIONS
    =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-= */
    /**
     *  @notice Compute the new Ys by adding and subtracting
     *   checkpoints formerly created on mint & increaseLock by the _YsCvgCheckpoint().
     *  @dev  Only callable by ControlTower ( DAO ).
     *  @param lockDuration is the duration in cycle(week) of the lock
     *  @param cvgLockAmount is the amount of cvg to lock in the position
     *  @param actualCycle is the actual cycle of the cvg
     *  @param endLockCycle is the end cycle of the lock
     */
    function _ysCvgCheckpoint(
        uint256 lockDuration,
        uint256 cvgLockAmount,
        uint256 actualCycle,
        uint256 endLockCycle
    ) internal {
        /** @dev Compute the amount of ysCVG on this Locking Position proportionally with the ratio of lockDuration and MAX LOCK duration. */
        uint256 ysTotalAmount = (lockDuration * cvgLockAmount) / MAX_LOCK;
        uint256 realStartCycle = actualCycle + 1;
        uint256 realEndCycle = endLockCycle + 1;
        /** @dev If the lock is not made on a TDE cycle,   we need to compute the ratio of ysCVG  for the current partial TDE */
        if (actualCycle % TDE_DURATION != 0) {
            /** @dev Get the cycle id of next TDE to be taken into account for this LockingPosition. */
            uint256 nextTdeCycle = (actualCycle / TDE_DURATION + 1) * TDE_DURATION + 1;
            /** @dev Represent the amount of ysCvg to be taken into account on the next TDE of this LockingPosition. */
            uint256 ysNextTdeAmount = ((nextTdeCycle - realStartCycle) * ysTotalAmount) / TDE_DURATION;

            totalSuppliesTracking[realStartCycle].ysToAdd += ysNextTdeAmount;

            /** @dev When a lock is greater than a TDE_DURATION */
            if (lockDuration >= TDE_DURATION) {
                /** @dev we add the calculations for the next full TDE */
                totalSuppliesTracking[nextTdeCycle].ysToAdd += ysTotalAmount - ysNextTdeAmount;
                totalSuppliesTracking[realEndCycle].ysToSub += ysTotalAmount;
            }
            /** @dev If the lock less than TDE_DURATION. */
            else {
                /** @dev We simply remove the amount from the supply calculation at the end of the TDE */
                totalSuppliesTracking[realEndCycle].ysToSub += ysNextTdeAmount;
            }
        }
        /** @dev If the lock is performed on a TDE cycle  */
        else {
            totalSuppliesTracking[realStartCycle].ysToAdd += ysTotalAmount;
            totalSuppliesTracking[realEndCycle].ysToSub += ysTotalAmount;
        }
    }

    /* =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=
                        VIEW FUNCTIONS
    =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-= */

    /**
     *   @notice Returns the information needed to display the lock position display svg.
     *   @param _tokenId id of the token
     */
    function tokenInfos(uint256 _tokenId) external view returns (TokenView memory) {
        LockingPosition memory _lockingPosition = lockingPositions[_tokenId];
        ICvgControlTower _cvgControlTower = cvgControlTower;

        uint256 _cvgCycle = _cvgControlTower.cvgCycle();

        return
            TokenView({
                tokenId: _tokenId,
                cvgLocked: _lockingPosition.totalCvgLocked,
                startCycle: _lockingPosition.startCycle,
                endCycle: _lockingPosition.lastEndCycle,
                veCvgActual: _cvgControlTower.votingPowerEscrow().balanceOf(_tokenId),
                ysTotal: balanceOfYsCvgAt(_tokenId, _lockingPosition.lastEndCycle),
                ysActual: balanceOfYsCvgAt(_tokenId, _cvgCycle),
                mgCvg: _cvgCycle > _lockingPosition.lastEndCycle ? 0 : _lockingPosition.mgCvgAmount,
                ysPercentage: _lockingPosition.ysPercentage
            });
    }

    /**
     * @notice Fetch the balance of veCVG (gauge voting power)  for a specified tokenId.
     * @param _tokenId id of the token
     */
    function balanceOfVeCvg(uint256 _tokenId) public view returns (uint256) {
        return cvgControlTower.votingPowerEscrow().balanceOf(_tokenId);
    }

    /**
     * @notice Fetch the balance of ysCVG (treasury share)  for a specified tokenId and at a specified cycle, can be in the future.
     * @param _tokenId id of the token
     * @param _cycleId id of the cycle
     */
    function balanceOfYsCvgAt(uint256 _tokenId, uint256 _cycleId) public view returns (uint256) {
        require(_cycleId != 0, "NOT_EXISTING_CYCLE");

        LockingPosition memory _lockingPosition = lockingPositions[_tokenId];
        LockingExtension[] memory _extensions = lockExtensions[_tokenId];
        uint256 _ysCvgBalance;

        /** @dev If the requested cycle is before or after the lock , there is no balance. */
        if (_lockingPosition.startCycle >= _cycleId || _cycleId > _lockingPosition.lastEndCycle) {
            return 0;
        }
        /** @dev We go through the extensions to compute the balance of ysCvg at the cycleId */
        for (uint256 i; i < _extensions.length; ) {
            /** @dev Don't take into account the extensions if in the future. */
            if (_extensions[i].cycleId < _cycleId) {
                LockingExtension memory _extension = _extensions[i];
                uint256 _firstTdeCycle = TDE_DURATION * (_extension.cycleId / TDE_DURATION + 1);
                uint256 _ysTotal = (((_extension.endCycle - _extension.cycleId) *
                    _extension.cvgLocked *
                    _lockingPosition.ysPercentage) / MAX_PERCENTAGE) / MAX_LOCK;
                uint256 _ysPartial = ((_firstTdeCycle - _extension.cycleId) * _ysTotal) / TDE_DURATION;
                /** @dev For locks that last less than 1 TDE. */
                if (_extension.endCycle - _extension.cycleId <= TDE_DURATION) {
                    _ysCvgBalance += _ysPartial;
                } else {
                    _ysCvgBalance += _cycleId <= _firstTdeCycle ? _ysPartial : _ysTotal;
                }
            }
            ++i;
        }
        return _ysCvgBalance;
    }

    /**
     * @notice  Fetch the balance of mgCVG (meta-governance voting power ) for a specified tokenId and at a specified cycle, this can be in the future.
     */
    function balanceOfMgCvgAt(uint256 _tokenId, uint256 _cycleId) public view returns (uint256) {
        require(_cycleId != 0, "NOT_EXISTING_CYCLE");

        LockingPosition memory _lockingPosition = lockingPositions[_tokenId];
        LockingExtension[] memory _extensions = lockExtensions[_tokenId];
        uint256 _mgCvgBalance;

        /** @dev If the requested cycle is before or after the lock , there is no balance. */
        if (_lockingPosition.startCycle > _cycleId || _cycleId > _lockingPosition.lastEndCycle) {
            return 0;
        }
        /** @dev We go through the extensions to compute the balance of mgCvg at the cycleId */
        for (uint256 i; i < _extensions.length; ) {
            LockingExtension memory _extension = _extensions[i];
            if (_extension.cycleId <= _cycleId) {
                _mgCvgBalance += _extension.mgCvgAdded;
            }
            ++i;
        }

        return _mgCvgBalance;
    }

    /**
     * @notice Fetch the balance of mgCVG (meta-governance voting power ) for a specified tokenId.
     * @param _tokenId id of the token
     */
    function balanceOfMgCvg(uint256 _tokenId) public view returns (uint256) {
        return balanceOfMgCvgAt(_tokenId, cvgControlTower.cvgCycle());
    }

    /**
     *   @notice Fetch the voting power (in veCvg) for a specified address, used in the Cvg Governance proposal strategy.
     *   @param _user is the address that we want to fetch voting power from
     */
    function veCvgVotingPowerPerAddress(address _user) external view returns (uint256) {
        uint256 _totalVotingPower;

        ILockingPositionDelegate _lockingPositionDelegate = cvgControlTower.lockingPositionDelegate();

        (uint256[] memory tokenIdsOwneds, uint256[] memory tokenIdsDelegateds) = _lockingPositionDelegate
            .getTokenVeOwnedAndDelegated(_user);

        /** @dev Sum voting power from delegated tokenIds to _user. */
        for (uint256 i; i < tokenIdsDelegateds.length; ) {
            uint256 _tokenId = tokenIdsDelegateds[i];
            /** @dev Check if is really delegated, if not ve voting power for this tokenId is 0. */
            if (_user == _lockingPositionDelegate.delegatedVeCvg(_tokenId)) {
                _totalVotingPower += balanceOfVeCvg(_tokenId);
            }

            unchecked {
                ++i;
            }
        }

        ILockingPositionManager _lockingPositionManager = cvgControlTower.lockingPositionManager();

        /** @dev Sum voting power from _user owned tokenIds. */
        for (uint256 i; i < tokenIdsOwneds.length; ) {
            uint256 _tokenId = tokenIdsOwneds[i];
            /** @dev Check if is really owned AND not delegated to another user,if not ve voting power for this tokenId is 0. */
            if (
                _lockingPositionDelegate.delegatedVeCvg(_tokenId) == address(0) &&
                _user == _lockingPositionManager.ownerOf(_tokenId)
            ) {
                _totalVotingPower += balanceOfVeCvg(_tokenId);
            }

            unchecked {
                ++i;
            }
        }

        return _totalVotingPower;
    }

    /**
     * @notice Fetch the voting power (in mgCVG) for a specified address, used in Meta-governance  strategy
     * @param _user is the address that we want to fetch voting power from
     */
    function mgCvgVotingPowerPerAddress(address _user) public view returns (uint256) {
        uint256 _totalMetaGovernance;

        ILockingPositionDelegate _lockingPositionDelegate = cvgControlTower.lockingPositionDelegate();

        (uint256[] memory tokenIdsOwneds, uint256[] memory tokenIdsDelegateds) = _lockingPositionDelegate
            .getTokenMgOwnedAndDelegated(_user);

        /** @dev Sum voting power from delegated (allowed) tokenIds to _user. */
        for (uint256 i; i < tokenIdsDelegateds.length; ) {
            uint256 _tokenId = tokenIdsDelegateds[i];
            (uint256 _toPercentage, , uint256 _toIndex) = _lockingPositionDelegate.getMgDelegateeInfoPerTokenAndAddress(
                _tokenId,
                _user
            );
            /** @dev Check if is really delegated, if not mg voting power for this tokenId is 0. */
            if (_toIndex < 999) {
                uint256 _tokenBalance = balanceOfMgCvg(_tokenId);
                _totalMetaGovernance += (_tokenBalance * _toPercentage) / MAX_PERCENTAGE;
            }

            unchecked {
                ++i;
            }
        }

        ILockingPositionManager _lockingPositionManager = cvgControlTower.lockingPositionManager();

        /** @dev Sum voting power from _user owned (allowed) tokenIds. */
        for (uint256 i; i < tokenIdsOwneds.length; ) {
            uint256 _tokenId = tokenIdsOwneds[i];
            /** @dev Check if is really owned,if not mg voting power for this tokenId is 0. */
            if (_user == _lockingPositionManager.ownerOf(_tokenId)) {
                (, uint256 _totalPercentageDelegated, ) = _lockingPositionDelegate.getMgDelegateeInfoPerTokenAndAddress(
                    _tokenId,
                    _user
                );
                uint256 _tokenBalance = balanceOfMgCvg(_tokenId);

                _totalMetaGovernance += (_tokenBalance * (MAX_PERCENTAGE - _totalPercentageDelegated)) / MAX_PERCENTAGE;
            }

            unchecked {
                ++i;
            }
        }

        return _totalMetaGovernance;
    }

    /**
     * @notice Get the supply of YsCvg at a given cycle, can be in the future.
     * @param _at cycle requested
     */
    function totalSupplyOfYsCvgAt(uint256 _at) external view returns (uint256) {
        require(_at != 0, "NOT_EXISTING_CYCLE");

        uint256 actualCycle = cvgControlTower.cvgCycle();
        uint256 _ysCvgAt;

        if (actualCycle <= _at) {
            /** @dev If the requested cycle is in the future/actual cycle, we compute the future balance with the tracking. */
            /** @dev Start from the last known totalSupply . */
            _ysCvgAt = totalSupplyYsCvgHistories[actualCycle - 1];
            for (uint256 i = actualCycle; i <= _at; ) {
                _ysCvgAt += totalSuppliesTracking[i].ysToAdd;
                _ysCvgAt -= totalSuppliesTracking[i].ysToSub;
                ++i;
            }
        } else {
            /** @dev If the requested cycle is in the past, we can directly return the balance. */
            _ysCvgAt = totalSupplyYsCvgHistories[_at];
        }
        return _ysCvgAt;
    }

    /**
     * @notice Get the reward amount at a given cycle for a given tokenId and a reward token.
     * @param tokenId id of the token
     * @param tdeId id of the TDE
     * @param _token address of the reward token
     */
    function getTokenRewardAmount(uint256 tokenId, uint256 tdeId, IERC20 _token) external view returns (uint256) {
        uint256 cycleClaimed = tdeId * TDE_DURATION;
        /** @dev Processing the share of this token ID */
        uint256 share = (balanceOfYsCvgAt(tokenId, cycleClaimed) * 10 ** 20) / totalSupplyYsCvgHistories[cycleClaimed];

        /** @dev Return the amount of reward for this share. */
        return cvgControlTower.ysDistributor().getTokenRewardAmountForTde(_token, tdeId, share);
    }

    /**
     * @notice  Add/remove a contract address to the whitelist.
     * @param contractWL address of the contract
     */
    function toggleContractLocker(address contractWL) external onlyOwner {
        isContractLocker[contractWL] = !isContractLocker[contractWL];
    }
}
