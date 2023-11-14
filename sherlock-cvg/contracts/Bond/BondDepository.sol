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
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "../interfaces/ICvgControlTower.sol";

/// @title Cvg-Finance - BondDepository
/// @notice Bond depository contract
contract BondDepository is Initializable, Pausable, Ownable2Step {
    using SafeERC20 for IERC20Metadata;
    /* =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=
                            PACKAGING
    =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-= */
    /// @dev parameters of the bond
    IBondStruct.BondParams public bondParams;

    /// @dev convergence ecosystem address
    ICvgControlTower public cvgControlTower;

    /// @dev CVG token
    ICvg public cvg;

    /// @dev amount of CVG minted with this bond
    uint256 public cvgMinted;

    /// @dev timestamp representing the beginning of the bond
    uint256 public startBondTimestamp;

    /* =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=
                            INFOS
    =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-= */

    /// @dev bond information for tokens
    mapping(uint256 => IBondStruct.BondPending) public bondInfos; // tokenId => bond information

    /* =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=
                            EVENTS
    =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-= */
    event BondRedeemed(uint256 indexed tokenId, uint256 payout, uint256 remaining, address recipient);

    event BondDeposit(
        uint256 indexed tokenId,
        uint256 amountDeposited,
        uint256 cvgMinted,
        uint256 vestingEnd,
        uint256 amountDepositedUsd,
        address token,
        uint256 cycle
    );

    event BondDepositToLock(
        uint256 amountDeposited,
        uint256 cvgMinted,
        uint256 amountDepositedUsd,
        address token,
        uint256 cycle
    );

    /* =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=
                            INITIALIZE
    =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-= */
    constructor() {
        _disableInitializers();
    }

    /**
     *  @notice Initialize function of the bond contract, can only be called once (by the clone factory).
     *  @param _cvgControlTower address of the control tower
     *  @param _bondParams parameters of the bond
     */
    function initialize(
        ICvgControlTower _cvgControlTower,
        IBondStruct.BondParams calldata _bondParams
    ) external initializer {
        cvgControlTower = _cvgControlTower;
        ICvg _cvg = _cvgControlTower.cvgToken();
        require(address(_cvg) != address(0), "CVG_ZERO");
        cvg = _cvg;
        bondParams = _bondParams;
        startBondTimestamp = block.timestamp;
        address _treasuryDao = _cvgControlTower.treasuryDao();
        require(_treasuryDao != address(0), "TREASURY_DAO_ZERO");
        _transferOwnership(_treasuryDao);
    }

    /* =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=
                            SETTERS
    =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-= */

    /**
     *  @notice Set the id of the curve related to the bond, 0 for square root, 1 for the logarithm, 2 for square and 3 for linear.
     *  @param newComposedFunction uint8
     */
    function setComposedFunction(uint8 newComposedFunction) external onlyOwner {
        require(newComposedFunction < 4, "INVALID_COMPOSED_FUNCTION");
        bondParams.composedFunction = newComposedFunction;
    }

    /**
     *  @notice Set percentage of the maximum of the bond mintable in one tx.
     *  @param newPercentageMaxToMint uint8
     */
    function setPercentageMaxCvgToMint(uint8 newPercentageMaxToMint) external onlyOwner {
        require(newPercentageMaxToMint < 100, "INVALID_PERCENTAGE_MAX");
        bondParams.percentageMaxCvgToMint = newPercentageMaxToMint;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /* =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=
                        EXTERNAL FUNCTIONS
    =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-= */

    /**
     *  @notice Deposit into bond.
     *  @param tokenId ID of the token in case of a refill
     *  @param amount amount of tokens to bond
     *  @param receiver address of the receiver
     */
    function deposit(uint256 tokenId, uint256 amount, address receiver) external whenNotPaused {
        ICvgControlTower _cvgControlTower = cvgControlTower;
        IBondPositionManager bondPositionManager = _cvgControlTower.bondPositionManager();
        require(amount > 0, "LTE");
        ICvg _cvg = cvg;

        IBondStruct.BondParams memory _bondParams = bondParams;

        uint256 _tokenId;
        if (tokenId == 0) {
            _tokenId = bondPositionManager.nextId();
        } else {
            address tokenOwner = msg.sender == _cvgControlTower.cvgUtilities() ? receiver : msg.sender;
            require(bondPositionManager.ownerOf(tokenId) == tokenOwner, "TOKEN_NOT_OWNED");
            require(bondPositionManager.bondPerTokenId(tokenId) == address(this), "WRONG_BOND_DEPOSITORY");
            require(bondPositionManager.unlockingTimestampPerToken(tokenId) < block.timestamp, "TOKEN_TIMELOCKED");
            _tokenId = tokenId;
        }
        /// @dev Bond expired after 1/2 days x numberOfPeriods from the creation
        require(block.timestamp <= startBondTimestamp + _bondParams.bondDuration, "BOND_INACTIVE");

        (uint256 cvgPrice, uint256 assetPrice) = _cvgControlTower.cvgOracle().getAndVerifyTwoPrices(
            address(_cvg),
            _bondParams.token
        );

        /// @dev Compute the number of CVG to mint
        uint256 depositedUsdValue = amount * assetPrice * 10 ** (18 - IERC20Metadata(_bondParams.token).decimals());

        /// @dev Compute the number of CVG to mint
        uint256 cvgToMint = depositedUsdValue / computeCvgBondUsdPrice(cvgPrice);

        require(
            cvgToMint <= (_bondParams.percentageMaxCvgToMint * _bondParams.maxCvgToMint) / 10 ** 3,
            "MAX_CVG_PER_BOND"
        );

        require(cvgToMint + cvgMinted <= _bondParams.maxCvgToMint, "MAX_CVG_ALREADY_MINTED");

        cvgMinted += cvgToMint;

        bondInfos[_tokenId] = IBondStruct.BondPending({
            payout: bondInfos[_tokenId].payout + cvgToMint,
            vesting: _bondParams.vestingTerm,
            lastBlock: uint128(block.timestamp)
        });

        /// @dev deposit asset in the bondContract
        IERC20Metadata(_bondParams.token).safeTransferFrom(msg.sender, _cvgControlTower.treasuryBonds(), amount);

        /// @dev mint the asset on the contract that the user will claim
        _cvg.mintBond(address(this), cvgToMint);

        if (tokenId == 0) {
            bondPositionManager.mint(receiver);
        }

        emit BondDeposit(
            _tokenId,
            amount,
            cvgToMint,
            block.timestamp + _bondParams.vestingTerm,
            depositedUsdValue / 10 ** 18,
            _bondParams.token,
            _cvgControlTower.cvgCycle()
        );
    }

    /**
     *  @notice Deposit into bond with the goal to lock CVG tokens after, only callable by CvgUtilities.
     *  @param amount amount of tokens to bond
     *  @param receiver address of the receiver
     *  @return cvgToMint received amount of CVG
     */
    function depositToLock(uint256 amount, address receiver) external whenNotPaused returns (uint256 cvgToMint) {
        ICvgControlTower _cvgControlTower = cvgControlTower;
        require(msg.sender == _cvgControlTower.cvgUtilities(), "NOT_CVG_UTILITIES");
        require(amount > 0, "LTE");
        ICvg _cvg = cvg;

        IBondStruct.BondParams memory _bondParams = bondParams;

        /// @dev Bond expired after 1/2 days x numberOfPeriods from the creation
        require(block.timestamp <= startBondTimestamp + _bondParams.bondDuration, "BOND_INACTIVE");

        (uint256 cvgPrice, uint256 assetPrice) = _cvgControlTower.cvgOracle().getAndVerifyTwoPrices(
            address(_cvg),
            _bondParams.token
        );

        /// @dev calculate the deposited USD value
        uint256 depositedUsdValue = amount * assetPrice * 10 ** (18 - IERC20Metadata(_bondParams.token).decimals());

        /// @dev Compute the number of CVG to mint
        cvgToMint = depositedUsdValue / computeCvgBondUsdPrice(cvgPrice);
        require(
            cvgToMint <= (_bondParams.percentageMaxCvgToMint * _bondParams.maxCvgToMint) / 10 ** 3,
            "MAX_CVG_PER_BOND"
        );

        require(cvgToMint + cvgMinted <= _bondParams.maxCvgToMint, "MAX_CVG_ALREADY_MINTED");
        cvgMinted += cvgToMint;

        /// @dev deposit asset in the bondContract
        IERC20Metadata(_bondParams.token).safeTransferFrom(msg.sender, _cvgControlTower.treasuryBonds(), amount);

        /// @dev mint the asset on Cvg Utilities
        _cvg.mintBond(receiver, cvgToMint);

        emit BondDepositToLock(
            amount,
            cvgToMint,
            depositedUsdValue / 10 ** 18,
            _bondParams.token,
            _cvgControlTower.cvgCycle()
        );
    }

    /**
     *  @notice Redeem bond for user.
     *  @param tokenId ID of the token to redeem of
     *  @param recipient address
     *  @param operator address of the operator
     *  @return payout uint256
     */
    function redeem(uint256 tokenId, address recipient, address operator) external returns (uint256) {
        IBondPositionManager bondPositionManager = cvgControlTower.bondPositionManager();
        _checkTokenOwnership(bondPositionManager, tokenId, operator);
        require(bondPositionManager.bondPerTokenId(tokenId) == address(this), "WRONG_BOND_DEPOSITORY");
        require(bondPositionManager.unlockingTimestampPerToken(tokenId) < block.timestamp, "TOKEN_TIMELOCKED");

        uint256 percentVested = percentVestedFor(tokenId); // (blocks since last interaction / vesting term remaining)
        uint256 payout;
        if (percentVested >= 10_000) {
            // if fully vested
            payout = bondInfos[tokenId].payout;

            delete bondInfos[tokenId]; // delete user info

            emit BondRedeemed(tokenId, payout, 0, recipient); // emit bond data
        } else {
            // if unfinished
            IBondStruct.BondPending memory bondPending = bondInfos[tokenId];

            // calculate payout vested
            payout = (bondPending.payout * percentVested) / 10_000;

            // store updated deposit info
            bondInfos[tokenId] = IBondStruct.BondPending({
                payout: bondPending.payout - payout,
                vesting: uint128(bondPending.vesting + bondPending.lastBlock - block.timestamp),
                lastBlock: uint128(block.timestamp)
            });

            emit BondRedeemed(tokenId, payout, bondPending.payout, recipient);
        }

        cvg.transfer(recipient, payout);

        return payout;
    }

    /* =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=
                        INTERNAL FUNCTIONS
    =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-= */
    function _checkTokenOwnership(
        IBondPositionManager _bondPositionManager,
        uint256 _tokenId,
        address _operator
    ) internal view {
        address tokenOwner = _bondPositionManager.ownerOf(_tokenId);
        if (msg.sender == cvgControlTower.cvgUtilities()) {
            require(_operator == tokenOwner, "TOKEN_NOT_OWNED");
        } else {
            require(msg.sender == tokenOwner, "TOKEN_NOT_OWNED");
        }
    }

    /* =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=
                        VIEW FUNCTIONS
    =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-= */

    /**
     *  @notice Compute bond price in USD with 18 decimals.
     *  @return cvgPriceDiscounted uint256
     */
    function depositRoi() public view returns (uint256) {
        IBondCalculator bondCalculator = cvgControlTower.bondCalculator();
        IBondStruct.BondParams memory _bondParams = bondParams;

        return
            bondCalculator.computeRoi(
                block.timestamp - startBondTimestamp,
                _bondParams.vestingTerm,
                _bondParams.composedFunction,
                _bondParams.maxCvgToMint,
                cvgMinted,
                _bondParams.gamma,
                _bondParams.scale,
                _bondParams.minRoi,
                _bondParams.maxRoi
            );
    }

    /**
     *  @notice Calculate available amount of CVG to claim by depositor.
     *  @param tokenId ID of a token
     *  @return pendingPayout uint
     */
    function pendingPayoutFor(uint256 tokenId) public view returns (uint256 pendingPayout) {
        uint256 percentVested = percentVestedFor(tokenId);
        uint256 payout = bondInfos[tokenId].payout;
        if (percentVested >= 10_000) {
            pendingPayout = payout;
        } else {
            pendingPayout = (payout * percentVested) / 10_000;
        }
    }

    /**
     *  @notice Calculate how far into vesting a depositor is.
     *  @param tokenId ID of a token
     *  @return percentVested uint
     */
    function percentVestedFor(uint256 tokenId) public view returns (uint256 percentVested) {
        uint256 blocksSinceLast = block.timestamp - bondInfos[tokenId].lastBlock;
        uint256 vesting = bondInfos[tokenId].vesting;
        if (vesting > 0) {
            percentVested = (blocksSinceLast * 10_000) / vesting;
            return percentVested > 10_000 ? 10_000 : percentVested; //max 100%
        }
    }

    /**
     *  @notice Compute bond price in USD with 18 decimals.
     *  @param realCvgPrice current price of CVG token
     *  @return CVG discounted price
     */
    function computeCvgBondUsdPrice(uint256 realCvgPrice) public view returns (uint256) {
        return (realCvgPrice * (1_000_000 - depositRoi())) / 10 ** 6;
    }

    /**
     *  @notice Get bond information.
     *  @return bondView bond information
     */
    function getBondView() external view returns (IBondStruct.BondView memory bondView) {
        IBondStruct.BondParams memory _bondParams = bondParams;
        ICvgControlTower _cvgControlTower = cvgControlTower;
        ICvgOracle _cvgOracle = _cvgControlTower.cvgOracle();
        bool isValid;
        uint256 _assetUsdPrice;
        uint256 _assetAggregatorPrice;
        uint256 _cvgUsdPrice;
        IERC20Metadata token = IERC20Metadata(_bondParams.token);

        {
            {
                (
                    uint256 assetUsdPrice,
                    uint256 assetAggregatorPrice,
                    bool isAssetTooHigh,
                    bool isAssetTooLow,
                    bool isEthVerified,
                    bool isAssetStale,
                    bool areStablesVerified,
                    bool areLimitsVerified
                ) = _cvgOracle.getDataForVerification(address(token));
                _assetUsdPrice = assetUsdPrice;
                _assetAggregatorPrice = assetAggregatorPrice;

                isValid =
                    isAssetTooHigh &&
                    isAssetTooLow &&
                    isEthVerified &&
                    isAssetStale &&
                    areStablesVerified &&
                    areLimitsVerified;
            }
            {
                (
                    uint256 cvgUsdPrice,
                    ,
                    bool isCvgTooHigh,
                    bool isCvgTooLow,
                    ,
                    bool isCvgStale,
                    bool areStablesVerified,
                    bool areLimitsVerified
                ) = _cvgOracle.getDataForVerification(address(cvg));

                _cvgUsdPrice = cvgUsdPrice;

                isValid =
                    isValid &&
                    isCvgTooHigh &&
                    isCvgTooLow &&
                    isCvgStale &&
                    areStablesVerified &&
                    areLimitsVerified;
            }
        }

        uint256 bondPriceUsd = computeCvgBondUsdPrice(_cvgUsdPrice);
        bondView = IBondStruct.BondView({
            bondAddress: address(this),
            bondRoi: uint40(depositRoi()),
            vestingTerm: uint40(_bondParams.vestingTerm),
            maxCvgToMint: _bondParams.maxCvgToMint,
            totalCvgMinted: cvgMinted,
            token: IBondStruct.ERC20View({
                decimals: token.decimals(),
                token: token.symbol(),
                tokenAddress: address(token)
            }),
            isFlexible: false,
            assetPriceUsdCvgOracle: _assetUsdPrice,
            assetPriceUsdAggregator: _assetAggregatorPrice,
            bondPriceUsd: bondPriceUsd,
            percentageMaxCvgToMint: _bondParams.percentageMaxCvgToMint,
            bondPriceAsset: (bondPriceUsd * 10 ** 18) / _assetUsdPrice,
            isValid: isValid
        });
    }

    /**
     *  @notice Get bond information of tokens.
     *  @param tokenIds IDs of the tokens
     *  @return array of bond information
     */
    function getBondInfosPerTokenIds(
        uint256[] calldata tokenIds
    ) external view returns (IBondStruct.BondTokenView[] memory) {
        uint256 length = tokenIds.length;
        IBondStruct.BondTokenView[] memory bondTokens = new IBondStruct.BondTokenView[](length);
        for (uint256 index = 0; index < length; ) {
            uint256 tokenId = tokenIds[index];
            IBondStruct.BondPending memory bondPending = bondInfos[tokenId];
            IBondStruct.BondTokenView memory bondToken = IBondStruct.BondTokenView({
                claimableCvg: pendingPayoutFor(tokenId),
                vestedCvg: bondPending.payout,
                lastBlock: bondPending.lastBlock,
                term: bondPending.lastBlock + bondPending.vesting
            });
            bondTokens[index] = bondToken;
            unchecked {
                ++index;
            }
        }
        return bondTokens;
    }

    /**
     *  @notice Get vesting information about a specific bond token.
     *  @param tokenId ID of the token
     *  @return vestingInfos vesting information
     */
    function getTokenVestingInfo(
        uint256 tokenId
    ) external view returns (IBondStruct.TokenVestingInfo memory vestingInfos) {
        IBondStruct.BondPending memory infos = bondInfos[tokenId];

        uint256 claimable = (infos.payout * percentVestedFor(tokenId)) / 10_000;

        vestingInfos = IBondStruct.TokenVestingInfo({
            term: infos.lastBlock + infos.vesting,
            claimable: claimable,
            pending: infos.payout - claimable
        });
    }
}
