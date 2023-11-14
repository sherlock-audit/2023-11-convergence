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

/// @title Cvg-Finance - SdtUtilities
/// @notice This contract is an utility contract enhancing user experience for the dapp involving integration of StakeDao.
/// @notice It allows to wraps several transactions in one.
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable2Step.sol";

import "../interfaces/ICvgControlTower.sol";
import "../interfaces/IAggregationRouterV5.sol";
import "../interfaces/ICrvPoolPlain.sol";
import "../interfaces/ISdAssets.sol";
import "../interfaces/ILpStakeDaoStrat.sol";

contract SdtUtilities is Ownable2Step {
    struct TokenSpender {
        address token;
        address spender;
        uint256 amount;
    }

    struct TokenCycles {
        uint256 tokenId;
        uint256[] cycleIds;
    }

    struct ClaimSdtStakingContract {
        address stakingContract;
        TokenCycles[] tokenCycles;
    }

    /// @dev address of the CvgControlTower
    ICvgControlTower public cvgControlTower;

    /// @notice Fetches the associated StablePool from Curve linked to an Asset.
    /// @dev    Is used for sdAssets & CvgSdt
    mapping(address => ICrvPoolPlain) public stablePoolPerAsset;

    IERC20 public immutable sdt;

    IERC20Mintable public immutable cvgSdt;

    /// @dev Corresponds to the 0.5% of depeg from which we need to start swapping the SDT.
    uint256 public constant HUNDER_COMMA_5 = 1_005;
    uint256 public constant HUNDER = 1_000;

    /* =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=
                            CONSTRUCTOR
    =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-= */

    constructor(ICvgControlTower _cvgControlTower, IERC20Mintable _cvgSdt, IERC20 _sdt) {
        cvgControlTower = _cvgControlTower;
        sdt = _sdt;
        cvgSdt = _cvgSdt;
        _transferOwnership(msg.sender);
    }

    /* =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=
                        EXTERNAL FUNCTIONS
    =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-= */

    /**
     * @notice Convert & Stake SDT on the CvgSdtStaking. Mints a new position or increases an already existing one.
     * @dev    Can also send an amount of CvgSdt summed to the converted amount and therefore, staked in the CvgSdtStaking.
     *         Force the Swap in the StablePool if CvgSdt is depeged from 0.5% from the SDT, acts as a peg keeper.
     * @param _tokenId      Token id of the position, if 0, mints an NFT
     * @param _cvgSdtAmount Amount of CvgSdt to sum with the SDT converted
     * @param _sdtAmount    Amount of SDT to convert in CvgSdt
     */
    function convertAndStakeCvgSdt(uint256 _tokenId, uint256 _cvgSdtAmount, uint256 _sdtAmount) external {
        if (_cvgSdtAmount != 0) {
            cvgSdt.transferFrom(msg.sender, address(this), _cvgSdtAmount);
        }

        /// @dev Get CvgSdt
        if (_sdtAmount != 0) {
            /// @dev Send Sdt on the contract
            sdt.transferFrom(msg.sender, address(this), _sdtAmount);
            /// @dev Get the stable pool Sdt/CvgSdt
            ICrvPoolPlain crvPoolPlain = stablePoolPerAsset[address(cvgSdt)];
            /// @dev Acts as a peg keeper and will prefers swap in the liquid pool in case of a depeg of 5% for the amount to swap
            if (crvPoolPlain.get_dy(0, 1, _sdtAmount) > (_sdtAmount * HUNDER_COMMA_5) / HUNDER) {
                /// @dev peg is too low, we swap in the LP with the SDT sent
                crvPoolPlain.exchange(0, 1, _sdtAmount, _sdtAmount, address(this));
            } else {
                /// @dev peg OK, we pass through the mint process 1:1, sending the SDT in the veSDTMultisig
                cvgSdt.mint(address(this), _sdtAmount);
            }
        }

        /// @dev deposit of the CvgAmount, sum of the CvgSdt already posessed & the Sdt converted to CvgSdt
        cvgControlTower.cvgSdtStaking().deposit(_tokenId, cvgSdt.balanceOf(address(this)), msg.sender);
    }

    /**
     * @notice Convert & Stake SDT on a SdAssetStaking. Converts the user asset directly to the sdGaugeAsset of StakeDao and stake it into Convergence.
     *         Mints a new position or increases an already existing one.
     * @dev    Can send a base amount of sdAsset that is summed to the converted amount of asset.
     *         Can send a base amount of sdAssetGauge that is summed to the totalAmount of sdAssetGauge.
     *         For the Asset => SdAsset conversion we choose the best rate between the mint 1:1 on stake or the swap in the linked stable pool.
     * @param _tokenId          Token id of the position, if 0, mints an NFT
     * @param _sdAssetStaking   SdAssetStakingService address
     * @param _gaugeAssetAmount Amount of sdGaugeAsset to add to the converted amounts
     * @param _sdAssetAmount    Amount of sdAsset to convert in sdGaugeAsset
     * @param _assetAmount      Amount of asset to convert in sdAssets
     * @param isLock            Lock and get fees from the corresponding Liquid Locker
     */
    function convertAndStakeSdAsset(
        uint256 _tokenId,
        ISdtStakingPositionService _sdAssetStaking,
        uint256 _gaugeAssetAmount,
        uint256 _sdAssetAmount,
        uint256 _assetAmount,
        bool isLock
    ) external {
        ISdAssetGauge gaugeAsset = _sdAssetStaking.stakingAsset();

        ISdAsset sdAsset = ISdAsset(address(gaugeAsset.staking_token()));

        /// @dev Transfers the base amount of sdGaugeAsset
        if (_gaugeAssetAmount != 0) {
            gaugeAsset.transferFrom(msg.sender, address(this), _gaugeAssetAmount);
        }

        /// @dev Transfers the base amount of sdAsset
        if (_sdAssetAmount != 0) {
            sdAsset.transferFrom(msg.sender, address(this), _sdAssetAmount);
        }

        /// @dev Transfers the amount of assets that'll be converted to sdAssets.
        if (_assetAmount != 0) {
            IOperator operator = sdAsset.operator();

            operator.token().transferFrom(msg.sender, address(this), _assetAmount);
            ICrvPoolPlain crvPoolPlain = stablePoolPerAsset[address(sdAsset)];
            /// @dev if the curvePool is set, we search the best conversion rate
            if (address(crvPoolPlain) != address(0)) {
                /// @dev swap is better, we pass through a swap in the LP
                if (crvPoolPlain.get_dy(0, 1, _assetAmount) > _assetAmount) {
                    crvPoolPlain.exchange(0, 1, _assetAmount, _assetAmount, address(this));
                }
                /// @dev deposit is better, we pass through the operator to deposit
                else {
                    operator.deposit(_assetAmount, isLock, false, address(this));
                }
            }
            /// @dev if no curvePool setted, we always deposit through the operator in 1:1 ( this usecase is for balancer )
            else {
                operator.deposit(_assetAmount, isLock, false, address(this));
            }
        }
        /// @dev Always convert the full amount
        uint256 sdAssetBalance = sdAsset.balanceOf(address(this));
        if (sdAssetBalance > 0) {
            /// @dev get more sdGaugeAssets
            gaugeAsset.deposit(sdAssetBalance, address(this));
        }

        /// @dev stake sdGaugeAsset
        _sdAssetStaking.deposit(_tokenId, gaugeAsset.balanceOf(address(this)), msg.sender);
    }

    /**
     * @notice Convert & Stake SDT on a LpAssetStaking. Converts the user lpAsset directly to the LpGaugeAsset of StakeDao and stake it into Convergence.
     *         Mints a new position or increases an already existing one.
     * @dev    Can send a base amount of lpAssetGauge that is sumed to converted amount.
     * @param _tokenId          Token id of the position, if 0, mints an NFT
     * @param _lpStaking        SdAssetStakingService address
     * @param _gaugeAssetAmount Amount of lpGaugeAsset to add to the converted amounts
     * @param _lpAssetAmount    Amount of lpAsset to convert in lpGaugeAsset
     * @param _isEarn           Streams the rewards of the underlying strategie if true
     */
    function convertAndStakeLpAsset(
        uint256 _tokenId,
        ISdtStakingPositionService _lpStaking,
        uint256 _gaugeAssetAmount,
        uint256 _lpAssetAmount,
        bool _isEarn
    ) external {
        ISdAssetGauge lpGaugeAsset = _lpStaking.stakingAsset();

        if (_gaugeAssetAmount != 0) {
            lpGaugeAsset.transferFrom(msg.sender, address(this), _gaugeAssetAmount);
        }

        if (_lpAssetAmount != 0) {
            ILpStakeDaoStrat lpAsset = ILpStakeDaoStrat(address(lpGaugeAsset.staking_token()));
            lpAsset.token().transferFrom(msg.sender, address(this), _lpAssetAmount);
            lpAsset.deposit(address(this), _lpAssetAmount, _isEarn);
        }

        _lpStaking.deposit(_tokenId, lpGaugeAsset.balanceOf(address(this)), msg.sender);
    }

    /* =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=
                        OWNER FUNCTIONS
    =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-= */
    /**
     * @notice Approve tokens to contracts that will be transferedFrom this contract.
     * @dev    All converter contracts must be approved with the corresponding ERC20.
     * @param _tokenSpenders Array of approval struct.
     */
    function approveTokens(TokenSpender[] calldata _tokenSpenders) external onlyOwner {
        for (uint256 i; i < _tokenSpenders.length; ) {
            IERC20(_tokenSpenders[i].token).approve(_tokenSpenders[i].spender, _tokenSpenders[i].amount);
            unchecked {
                ++i;
            }
        }
    }

    /**
     * @notice Sets the stable pool linked to a liquid locker
     * @param liquidLocker Address of the liquid locker token
     * @param lp           Address of the stable pool from curve linked to the liquid locker
     */
    function setStablePool(address liquidLocker, ICrvPoolPlain lp) external onlyOwner {
        stablePoolPerAsset[liquidLocker] = lp;
    }
}
