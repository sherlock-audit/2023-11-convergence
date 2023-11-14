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
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "../interfaces/ICvgControlTower.sol";

/**
 * @title Cvg-Finance - YsDistributor
 * @notice This contract is used to distribute rewards to locking positions (with YsCvg values).
 */
contract YsDistributor is Initializable {
    using SafeERC20 for IERC20;

    /// @dev Struct Info about deposits.
    struct TokenAmount {
        IERC20 token;
        uint256 amount;
    }

    struct Claim {
        uint256 tdeCycle;
        TokenAmount[] tokenAmounts;
    }

    event DepositedTokens(uint256 cycleId, TokenAmount[] tokens);
    /// @dev Event for claimed tokens.
    event TokensClaim(uint256 tokenId, uint256 cycle, uint256 share, TokenAmount[] tokens);

    /// @dev Cvg control tower.
    ICvgControlTower public cvgControlTower;

    ILockingPositionService public lockingPositionService;

    ILockingPositionManager public lockingPositionManager;

    ILockingPositionDelegate public lockingPositionDelegate;

    /// @dev Duration for one TDE => 12 Cycles.
    uint256 public constant TDE_DURATION = 12;

    /// @dev Tracking  claimed  position by TDE
    mapping(uint256 => mapping(uint256 => bool)) public rewardsClaimedForToken;

    /// @dev Returns the amount of an erc20 reward having deposited for the TDE.
    mapping(uint256 => mapping(IERC20 => uint256)) public depositedTokenAmountForTde;

    /// @dev Tracking reward tokens address deposited by TDE
    mapping(uint256 => address[]) internal depositedTokenAddressForTde;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initialize the contract with the CvgControlTower address and the CVG token address.
     * @param _cvgControlTower address of the CvgControlTower contract
     */
    function initialize(ICvgControlTower _cvgControlTower) external initializer {
        cvgControlTower = _cvgControlTower;
        ILockingPositionService _lockingPositionService = _cvgControlTower.lockingPositionService();
        ILockingPositionManager _lockingPositionManager = _cvgControlTower.lockingPositionManager();
        ILockingPositionDelegate _lockingPositionDelegate = _cvgControlTower.lockingPositionDelegate();
        require(address(_lockingPositionService) != address(0), "LOCKING_SERVICE_ZERO");
        require(address(_lockingPositionManager) != address(0), "LOCKING_MANAGER_ZERO");
        require(address(_lockingPositionDelegate) != address(0), "LOCKING_DELEGATE_ZERO");
        lockingPositionService = _lockingPositionService;
        lockingPositionManager = _lockingPositionManager;
        lockingPositionDelegate = _lockingPositionDelegate;
    }

    /* =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=
                            MODIFIERS
    =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-= */
    modifier onlyTreasuryBonds() {
        require(msg.sender == cvgControlTower.treasuryBonds(), "NOT_TREASURY_BONDS");
        _;
    }

    /* -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=
                    EXTERNALS ONLY TREASURY BONDS
    =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-= */

    /**
     *  @notice Deposit tokens in this contracts, these tokens will be be distributed at the next TDE.
     *  @dev Function only callable by TreasuryBonds / update and save tokens amount depending to cycles and TDE events.
     *  @param deposits Struct which contains an array of token(s) and their associated amount(s) to deposit
     */
    function depositMultipleToken(TokenAmount[] calldata deposits) external onlyTreasuryBonds {
        uint256 _actualCycle = cvgControlTower.cvgCycle();
        uint256 _actualTDE = _actualCycle % TDE_DURATION == 0
            ? _actualCycle / TDE_DURATION
            : (_actualCycle / TDE_DURATION) + 1;

        address[] memory _tokens = depositedTokenAddressForTde[_actualTDE];
        uint256 tokensLength = _tokens.length;

        for (uint256 i; i < deposits.length; ) {
            IERC20 _token = deposits[i].token;
            uint256 _amount = deposits[i].amount;

            depositedTokenAmountForTde[_actualTDE][_token] += _amount;

            /// @dev Checks whether the token is present in depositedTokenAddressForTde, otherwise we add it.
            bool found;
            for (uint256 j; j < tokensLength; ) {
                if (address(_token) == _tokens[j]) {
                    found = true;
                    break;
                }
                unchecked {
                    ++j;
                }
            }

            if (!found) {
                depositedTokenAddressForTde[_actualTDE].push(address(_token));
            }

            /// @dev Transfer tokens.
            _token.safeTransferFrom(msg.sender, address(this), _amount);

            unchecked {
                ++i;
            }
        }
        emit DepositedTokens(_actualCycle, deposits);
    }

    /* =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=
                            EXTERNALS
    =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-= */

    /**
     * @notice Claim the associated rewards to the locking position NFT.
     *  @dev  Share = NFT YsBalance / YsTotalSupply ( at the TDE ) |  Ys reward is computed by CvgRewards contract
     *  |   Bond Treasury Yield is computed and sent.
     * @param tokenId is the token ID to claim rewards of
     * @param tdeId is the TDE that will be processed
     * @param receiver is the address that will receive the rewards
     * @param operator is the address owner or delegatee of the tokenId (if used by cvgUtilities) OR address(0) if used directly here
     */
    function claimRewards(uint256 tokenId, uint256 tdeId, address receiver, address operator) external {
        ICvgControlTower _cvgControlTower = cvgControlTower;
        ILockingPositionService _lockingPositionService = lockingPositionService;
        ILockingPositionManager _lockingPositionManager = lockingPositionManager;
        require(_lockingPositionManager.unlockingTimestampPerToken(tokenId) < block.timestamp, "TOKEN_TIMELOCKED");

        if (msg.sender != _cvgControlTower.cvgUtilities()) {
            operator = msg.sender;
        }
        require(
            operator == _lockingPositionManager.ownerOf(tokenId) ||
                operator == lockingPositionDelegate.delegatedYsCvg(tokenId),
            "NOT_OWNED_OR_DELEGATEE"
        );

        uint256 cycleClaimed = tdeId * TDE_DURATION;

        /// @dev Cannot claim on a TDE if lock expires before it.
        require(_lockingPositionService.lockingPositions(tokenId).lastEndCycle >= cycleClaimed, "LOCK_OVER");

        /// @dev Cannot claim a TDE not available yet.
        require(_cvgControlTower.cvgCycle() >= cycleClaimed, "NOT_AVAILABLE");

        /// @dev Cannot claim twice rewards for a TDE.
        require(!rewardsClaimedForToken[tokenId][tdeId], "ALREADY_CLAIMED");

        /// @dev Compute the share ysCvg.
        /** @dev The share if computed by doing the ratio between the ysCvgBalance of the token
         and the totalSupply of ysCvg at the specified TDE. */
        uint256 share = (_lockingPositionService.balanceOfYsCvgAt(tokenId, cycleClaimed) * 10 ** 20) /
            _lockingPositionService.totalSupplyYsCvgHistories(cycleClaimed);

        /// @dev Cannot claim a Ys rewards if Locking position has no ys value at asked cycle.
        require(share != 0, "NO_SHARES");

        /// @dev Claim according token rewards.
        _claimTokenRewards(tokenId, tdeId, share, receiver);

        /// @dev Mark the TDE id for this token as claimed on the Storage.
        rewardsClaimedForToken[tokenId][tdeId] = true;
    }

    /**
     *  @notice Claim multiple tokens rewards for a given TDE.
     *  @dev  Function only callable by owner of tokenId.
     *  @param tokenId  ID of the token
     *  @param tdeId desired tdeId to claim
     *  @param share amount of user share
     *  @param receiver address that will receive token rewards
     */
    function _claimTokenRewards(uint256 tokenId, uint256 tdeId, uint256 share, address receiver) internal {
        address[] memory tokens = depositedTokenAddressForTde[tdeId];
        TokenAmount[] memory tokensClaimable = new TokenAmount[](tokens.length);

        for (uint256 i; i < tokens.length; ) {
            IERC20 _token = IERC20(tokens[i]);
            uint256 _amountUser = _calculateUserRewardAmount(tdeId, _token, share);

            tokensClaimable[i] = TokenAmount({token: _token, amount: _amountUser});

            _token.safeTransfer(receiver, _amountUser);

            unchecked {
                ++i;
            }
        }

        emit TokensClaim(tokenId, tdeId, share, tokensClaimable);
    }

    /**
     * @notice Calculate the reward amount for a token depending the share of the user.
     * @param _tdeId desired tdeId to calculate reward amount for
     * @param _token address of token to calculate reward amount for
     * @param _share amount of user share
     **/
    function _calculateUserRewardAmount(uint256 _tdeId, IERC20 _token, uint256 _share) internal view returns (uint256) {
        return (depositedTokenAmountForTde[_tdeId][_token] * _share) / 10 ** 20;
    }

    /* =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=
                            PUBLIC
    =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-= */

    /**
     * @notice Obtains all ERC20 reward tokens for a list of TDEs.
     * @param _tdeIds TDE Ids to claim
     * @param _tokenId of the locking position
     */
    function getAllTokenRewardsForTde(
        uint256[] calldata _tdeIds,
        uint256 _tokenId
    ) external view returns (Claim[] memory) {
        ICvgControlTower _cvgControlTower = cvgControlTower;
        ILockingPositionService _lockingPositionService = _cvgControlTower.lockingPositionService();
        uint256 actualCycle = _cvgControlTower.cvgCycle();
        if (_lockingPositionService.lockingPositions(_tokenId).ysPercentage == 0) {
            return new Claim[](0);
        }
        uint256[] memory filteredTdes = new uint256[](_tdeIds.length);
        uint256 j;
        for (uint256 i; i < _tdeIds.length; ) {
            uint256 cycleTde = _tdeIds[i] * TDE_DURATION;
            if (
                _lockingPositionService.balanceOfYsCvgAt(_tokenId, cycleTde) == 0 ||
                actualCycle <= cycleTde ||
                rewardsClaimedForToken[_tokenId][_tdeIds[i]]
            ) {
                // solhint-disable-next-line no-inline-assembly
                assembly {
                    /// @dev This reduce the length of the array to not return some useless 0 at the end.
                    mstore(filteredTdes, sub(mload(filteredTdes), 1))
                }
            } else {
                filteredTdes[j] = _tdeIds[i];
                unchecked {
                    ++j;
                }
            }
            unchecked {
                ++i;
            }
        }
        Claim[] memory tokensClaimable = new Claim[](filteredTdes.length);
        for (uint256 i; i < filteredTdes.length; ) {
            tokensClaimable[i] = _tokenRewardsForOneTde(filteredTdes[i], _tokenId, _lockingPositionService);
            unchecked {
                ++i;
            }
        }

        return tokensClaimable;
    }

    /**
     * @notice Gets all reward tokens for a tokenId and a tde.
     * @param _tdeId TDE Id
     * @param _tokenId of the locking position
     * @param _lockingPositionService  address of thr locking position service
     */
    function _tokenRewardsForOneTde(
        uint256 _tdeId,
        uint256 _tokenId,
        ILockingPositionService _lockingPositionService
    ) internal view returns (Claim memory) {
        address[] memory tokens = depositedTokenAddressForTde[_tdeId];
        TokenAmount[] memory tokensClaimable = new TokenAmount[](tokens.length);
        uint256 cycleClaimed = TDE_DURATION * _tdeId;
        uint256 share = (_lockingPositionService.balanceOfYsCvgAt(_tokenId, cycleClaimed) * 10 ** 20) /
            _lockingPositionService.totalSupplyYsCvgHistories(cycleClaimed);
        for (uint256 i; i < tokens.length; ) {
            IERC20 _token = IERC20(tokens[i]);

            tokensClaimable[i] = TokenAmount({
                token: _token,
                amount: _calculateUserRewardAmount(_tdeId, _token, share)
            });
            unchecked {
                ++i;
            }
        }

        return Claim({tdeCycle: _tdeId, tokenAmounts: tokensClaimable});
    }

    /**
     * @notice Gets all ERC20 deposited tokens for one TDE.
     * @param _tdeId TDE Ids to claim
     */
    function getTokensDepositedAtTde(uint256 _tdeId) external view returns (address[] memory) {
        return depositedTokenAddressForTde[_tdeId];
    }

    /**
     * @notice Gets the reward amount of a token for a specific TDE based on share amount.
     * @param _token address on an ERC20 token
     * @param _tdeId ID of a TDE
     * @param _share amount of share
     */
    function getTokenRewardAmountForTde(IERC20 _token, uint256 _tdeId, uint256 _share) external view returns (uint256) {
        return (depositedTokenAmountForTde[_tdeId][_token] * _share) / 10 ** 20;
    }
}
