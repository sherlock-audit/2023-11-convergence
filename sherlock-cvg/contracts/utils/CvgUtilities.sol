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

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "../interfaces/ICvgControlTower.sol";
import "../interfaces/IAggregationRouterV5.sol";
import "../interfaces/ICrvPoolPlain.sol";

/// @title Cvg-Finance - CvgUtilities
/// @notice Improve user experience with utilities function
contract CvgUtilities is Ownable2Step {
    using SafeERC20 for IERC20;

    struct ClaimTokenTde {
        uint256 tokenId;
        uint256[] tdeIds;
    }

    struct ClaimBondContract {
        address bondAddress;
        uint256[] tokenIds;
    }

    /// @dev convergence ecosystem address
    ICvgControlTower public cvgControlTower;

    uint256 public constant MAX_UINT = type(uint256).max;

    /// @dev acts in such a way that users don't use the Bond & Lock feature just to take advantage of the discounted price with a short locking period
    uint256 public constant MINIMUM_LOCK_DURATION = 36;

    /* =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=
                            CONSTRUCTOR
    =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-= */

    constructor(ICvgControlTower _cvgControlTower) {
        cvgControlTower = _cvgControlTower;
        _cvgControlTower.cvgToken().approve(address(_cvgControlTower.lockingPositionService()), MAX_UINT);
    }

    /* =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=
                        EXTERNAL FUNCTIONS
    =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-= */
    /**
     * @notice claim rewards on multiple locking positions on several tdeIds
     * @param claimTdes data related to claim
     */
    function claimMultipleLocking(ClaimTokenTde[] calldata claimTdes) external {
        IYsDistributor ysDistributor = cvgControlTower.ysDistributor();
        for (uint256 i; i < claimTdes.length; ) {
            uint256 tokenId = claimTdes[i].tokenId;
            for (uint256 j; j < claimTdes[i].tdeIds.length; ) {
                ysDistributor.claimRewards(
                    tokenId,
                    claimTdes[i].tdeIds[j],
                    msg.sender,
                    msg.sender
                );
                unchecked {
                    ++j;
                }
            }
            unchecked {
                ++i;
            }
        }
    }

    /**
     * @notice claim rewards on multiple bond contracts with several tokens
     * @param claimContracts data related to claim
     * @param recipient the address to receive rewards on
     */
    function claimMultipleBonds(ClaimBondContract[] calldata claimContracts, address recipient) external {
        for (uint256 i; i < claimContracts.length; ) {
            IBondDepository bondDepository = IBondDepository(claimContracts[i].bondAddress);

            for (uint256 j; j < claimContracts[i].tokenIds.length; ) {
                bondDepository.redeem(claimContracts[i].tokenIds[j], recipient, msg.sender);
                unchecked {
                    ++j;
                }
            }
            unchecked {
                ++i;
            }
        }
    }

    /**
     * @notice Swap allowed source token to bond asset, bond and lock received CVG
     * @param _bondContract address of the bond contract
     * @param _bondTokenId ID of an existing bond token to refill (0 if new position)
     * @param _lockTokenId ID of an existing locking token to refill (0 if new position)
     * @param _bondTokenAmount additional amount of token to bond
     * @param _durationAdd duration to add to the locking position (if any)
     * @param _ysPercentage percentage of ysCVG to attribute to locking position (only on new position)
     * @param _swapTransaction aggregation data used for the swap to occur through 1inch protocol
     */
    function swapTokenBondAndLock(
        IBondDepository _bondContract,
        uint256 _bondTokenId,
        uint256 _lockTokenId,
        uint256 _bondTokenAmount,
        uint96 _lockDuration,
        uint256 _durationAdd,
        uint64 _ysPercentage,
        IAggregationRouterV5.SwapTransaction calldata _swapTransaction
    ) external {
        uint256 totalBondTokenAmount;
        IERC20 bondToken = IERC20(_bondContract.bondParams().token);

        /// @dev swap source tokens through 1inch protocol
        if (address(_swapTransaction.executor) != address(0)) {
            require(_swapTransaction.description.dstToken == bondToken, "INVALID_DESTINATION_TOKEN");
            totalBondTokenAmount += cvgControlTower.swapperFactory().executeSimpleSwap(msg.sender, _swapTransaction);
        }

        /// @dev get additional bond token from user
        if (_bondTokenAmount > 0) {
            bondToken.safeTransferFrom(msg.sender, address(this), _bondTokenAmount);
            totalBondTokenAmount += _bondTokenAmount;
        }

        require(totalBondTokenAmount > 0, "INVALID_AMOUNT");

        /// @dev deposit in bond contract and lock received CVG if it's a lock
        if (_lockTokenId > 0 || _lockDuration > 0) {
            ICvgControlTower _cvgControlTower = cvgControlTower;
            ILockingPositionService _lockingPositionService = _cvgControlTower.lockingPositionService();
            require(msg.sender == tx.origin || _lockingPositionService.isContractLocker(msg.sender), "NOT_ALLOWED");

            uint256 cvgAmount = _bondContract.depositToLock(totalBondTokenAmount, address(this));

            /// @dev update locking position
            if (_lockTokenId > 0) {
                uint96 endCycle = _lockingPositionService.lockingPositions(_lockTokenId).lastEndCycle;
                uint128 actualCycle = _cvgControlTower.cvgCycle();

                /// @dev increase locking position time and amount
                if (_durationAdd > 0) {
                    require(
                        actualCycle + MINIMUM_LOCK_DURATION <= endCycle + _durationAdd,
                        "ADDED_LOCK_DURATION_NOT_ENOUGH"
                    );
                    _lockingPositionService.increaseLockTimeAndAmount(
                        _lockTokenId,
                        _durationAdd,
                        cvgAmount,
                        msg.sender
                    );
                } else {
                    /// @dev increase locking position amount
                    require(actualCycle + MINIMUM_LOCK_DURATION <= endCycle, "REMAINING_LOCK_DURATION_TOO_LOW");
                    _lockingPositionService.increaseLockAmount(_lockTokenId, cvgAmount, msg.sender);
                }
            } else {
                /// @dev mint locking position
                require(_lockDuration >= MINIMUM_LOCK_DURATION, "LOCK_DURATION_NOT_LONG_ENOUGH");
                _lockingPositionService.mintPosition(_lockDuration, cvgAmount, _ysPercentage, msg.sender, true);
            }
        } else {
            /// @dev simply deposit in bond contract
            _bondContract.deposit(_bondTokenId, totalBondTokenAmount, msg.sender);
        }
    }

    /**
     * @notice Approve other contracts (Bond for example) to spend contract's ERC20 specific token
     * @param _token address on an ERC20 token
     * @param _amount amount to be approved
     */
    function approveRouterTokenSpending(IERC20 _token, address spender, uint256 _amount) external onlyOwner {
        _token.forceApprove(spender, _amount);
    }
}
