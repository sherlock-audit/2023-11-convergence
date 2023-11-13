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

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/IPresaleCvgWl.sol";
import "../interfaces/IPresaleCvgSeed.sol";
import "../interfaces/IboInterface.sol";

contract VestingCvg is Ownable2Step {
    /// @dev Enum about vesting types
    enum VestingType {
        SEED,
        WL,
        IBO,
        TEAM,
        DAO
    }
    /// @dev Enum about the state of the vesting
    enum State {
        NOT_ACTIVE,
        SET,
        OPEN
    }
    /// @dev Struct Info about VestingSchedules
    struct VestingSchedule {
        uint80 daysBeforeCliff;
        uint80 daysAfterCliff;
        uint96 dropCliff;
        uint256 totalAmount;
        uint256 totalReleased;
    }
    /// @dev Max supply TEAM & DAO
    uint256 public constant MAX_SUPPLY_TEAM = 12_750_000 * 10 ** 18;
    uint256 public constant MAX_SUPPLY_DAO = 15_000_000 * 10 ** 18;

    uint256 public constant ONE_DAY = 1 days;
    uint256 public constant ONE_GWEI = 10 ** 9;

    State public state;

    IPresaleCvgWl public presaleWl;
    IPresaleCvgSeed public presaleSeed;
    IboInterface public ibo;
    IERC20 public cvg;

    address public whitelistedTeam;
    address public whitelistedDao;

    /// @dev Timestamp shared between all vestingSchedules to mark the beginning of the vesting
    uint256 public startTimestamp;

    /// @dev VestingType associated to the vesting schedule info
    mapping(VestingType => VestingSchedule) public vestingSchedules;

    mapping(uint256 => uint256) public amountReleasedIdSeed; // tokenId => amountReleased
    mapping(uint256 => uint256) public amountReleasedIdWl; // tokenId => amountReleased
    mapping(uint256 => uint256) public amountReleasedIdIbo; // tokenId => amountReleased

    constructor(IPresaleCvgWl _presaleWl, IPresaleCvgSeed _presaleSeed, IboInterface _ibo) {
        presaleWl = _presaleWl;
        presaleSeed = _presaleSeed;
        ibo = _ibo;
    }

    /* =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=
                            MODIFIERS
    =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-= */

    modifier onlyOwnerOfSeed(uint256 _tokenId) {
        require(presaleSeed.ownerOf(_tokenId) == msg.sender, "NOT_OWNED");
        _;
    }

    modifier onlyOwnerOfWl(uint256 _tokenId) {
        require(presaleWl.ownerOf(_tokenId) == msg.sender, "NOT_OWNED");
        _;
    }

    modifier onlyOwnerOfIbo(uint256 _tokenId) {
        require(ibo.ownerOf(_tokenId) == msg.sender, "NOT_OWNED");
        _;
    }

    /* =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=
                            SETTERS
    =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-= */

    function setWhitelistTeam(address newWhitelistedTeam) external onlyOwner {
        whitelistedTeam = newWhitelistedTeam;
    }

    function setWhitelistDao(address newWhitelistedDao) external onlyOwner {
        whitelistedDao = newWhitelistedDao;
    }

    /* =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=
                            GETTERS
    =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-= */

    function getTotalReleasedScheduleId(VestingType _vestingType) external view returns (uint256) {
        return (vestingSchedules[_vestingType].totalReleased);
    }

    function getInfoVestingTokenId(
        uint256 _tokenId,
        VestingType _vestingType
    ) external view returns (uint256 amountReleasable, uint256 totalCvg, uint256 amountRedeemed) {
        (amountReleasable, totalCvg, amountRedeemed) = _computeReleaseAmount(_tokenId, _vestingType);
    }

    /* =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=
                            EXTERNALS
    =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-= */
    /// @notice Set vesting with current timestamp, creates vestingSchedules for all vesting types (only callable by owner)
    /// @dev Sum of all vesting schedule must be distributed in the contract before intializing it the vesting
    function setVesting(IERC20 _cvg) external onlyOwner {
        require(state == State.NOT_ACTIVE, "VESTING_ALREADY_SET");
        state = State.SET;

        require(
            presaleSeed.saleState() == IPresaleCvgSeed.SaleState.OVER &&
                presaleWl.saleState() == IPresaleCvgWl.SaleState.OVER,
            "PRESALE_ROUND_NOT_FINISHED"
        );

        startTimestamp = block.timestamp;

        /// @dev SEED SCHEDULE
        uint256 seedAmount = presaleSeed.getTotalCvg();
        vestingSchedules[VestingType.SEED] = VestingSchedule({
            totalAmount: seedAmount,
            totalReleased: 0,
            daysBeforeCliff: 4 * 30,
            daysAfterCliff: 15 * 30,
            dropCliff: 50
        });

        /// @dev WL SCHEDULE
        uint256 wlAmount = presaleWl.getTotalCvg();
        vestingSchedules[VestingType.WL] = VestingSchedule({
            totalAmount: wlAmount,
            totalReleased: 0,
            daysBeforeCliff: 0,
            daysAfterCliff: 3 * 30,
            dropCliff: 330
        });

        /// @dev IBO SCHEDULE
        uint256 iboAmount = ibo.getTotalCvgDue();
        vestingSchedules[VestingType.IBO] = VestingSchedule({
            totalAmount: iboAmount,
            totalReleased: 0,
            daysBeforeCliff: 0,
            daysAfterCliff: 2 * 30,
            dropCliff: 0
        });

        /// @dev TEAM SCHEDULE
        uint256 teamAmount = MAX_SUPPLY_TEAM;
        vestingSchedules[VestingType.TEAM] = VestingSchedule({
            totalAmount: teamAmount,
            totalReleased: 0,
            daysBeforeCliff: 180,
            daysAfterCliff: 18 * 30,
            dropCliff: 50
        });

        /// @dev DAO SCHEDULE
        uint256 daoAmount = MAX_SUPPLY_DAO;
        vestingSchedules[VestingType.DAO] = VestingSchedule({
            totalAmount: daoAmount,
            totalReleased: 0,
            daysBeforeCliff: 0,
            daysAfterCliff: 18 * 30,
            dropCliff: 50
        });

        require(address(_cvg) != address(0), "CVG_ZERO");
        cvg = _cvg;
        require(
            _cvg.balanceOf(address(this)) >= seedAmount + wlAmount + iboAmount + teamAmount + daoAmount,
            "NOT_ENOUGH_CVG"
        );
    }

    /// @notice Open vesting for all
    function openVesting() external onlyOwner {
        require(state == State.SET, "VESTING_ALREADY_OPENED");
        state = State.OPEN;
    }

    /**
     * @notice Release CVG token available for SEED nft owner
     * @param _tokenId token Id SEED
     */
    function releaseSeed(uint256 _tokenId) external onlyOwnerOfSeed(_tokenId) {
        require(state == State.OPEN, "VESTING_NOT_OPEN");
        (uint256 amountToRelease, , ) = _computeReleaseAmount(_tokenId, VestingType.SEED);
        require(amountToRelease != 0, "NOT_RELEASABLE");

        //update totalReleased & amountReleasedId
        vestingSchedules[VestingType.SEED].totalReleased += amountToRelease;

        amountReleasedIdSeed[_tokenId] += amountToRelease;

        //transfer Cvg amount to release
        cvg.transfer(msg.sender, amountToRelease);
    }

    /**
     * @notice Release CVG token available for WL nft owner
     * @param _tokenId token Id WL
     */
    function releaseWl(uint256 _tokenId) external onlyOwnerOfWl(_tokenId) {
        require(state == State.OPEN, "VESTING_NOT_OPEN");
        (uint256 amountToRelease, , ) = _computeReleaseAmount(_tokenId, VestingType.WL);
        require(amountToRelease != 0, "NOT_RELEASABLE");

        //update totalReleased & amountReleasedIdSeed
        vestingSchedules[VestingType.WL].totalReleased += amountToRelease;

        amountReleasedIdWl[_tokenId] += amountToRelease;

        //transfer Cvg amount to release
        cvg.transfer(msg.sender, amountToRelease);
    }

    /**
     * @notice Release CVG token available for IBO nft owner
     * @param _tokenId token Id IBO
     */
    function releaseIbo(uint256 _tokenId) external onlyOwnerOfIbo(_tokenId) {
        require(state == State.OPEN, "VESTING_NOT_OPEN");
        (uint256 amountToRelease, , ) = _computeReleaseAmount(_tokenId, VestingType.IBO);
        require(amountToRelease != 0, "NOT_RELEASABLE");

        //update totalReleased & amountReleasedIdSeed
        vestingSchedules[VestingType.IBO].totalReleased += amountToRelease;

        amountReleasedIdIbo[_tokenId] += amountToRelease;

        //transfer Cvg amount to release
        cvg.transfer(msg.sender, amountToRelease);
    }

    /// @notice Release CVG token available for whitelisted address TEAM or DAO
    function releaseTeamOrDao(bool _isTeam) external {
        uint256 amountToRelease;
        VestingType _vestingType;

        if (_isTeam) {
            require(msg.sender == whitelistedTeam, "NOT_TEAM");
            _vestingType = VestingType.TEAM;
        } else {
            require(msg.sender == whitelistedDao, "NOT_DAO");
            _vestingType = VestingType.DAO;
        }

        (amountToRelease, , ) = _computeReleaseAmount(0, _vestingType);
        require(amountToRelease != 0, "NOT_RELEASABLE");

        vestingSchedules[_vestingType].totalReleased += amountToRelease;

        /// @dev transfer Cvg amount to release
        cvg.transfer(msg.sender, amountToRelease);
    }

    /* =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=
                            INTERNALS
    =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-= */

    function _computeReleaseAmount(
        uint256 _tokenId,
        VestingType _vestingType
    ) internal view returns (uint256 amountToRelease, uint256 totalAmount, uint256 totalAmountReleased) {
        if (_vestingType == VestingType.SEED) {
            totalAmountReleased = amountReleasedIdSeed[_tokenId];
            totalAmount = presaleSeed.presaleInfoTokenId(_tokenId).cvgAmount;
        } else if (_vestingType == VestingType.WL) {
            totalAmountReleased = amountReleasedIdWl[_tokenId];
            totalAmount = presaleWl.presaleInfos(_tokenId).cvgAmount;
        } else if (_vestingType == VestingType.IBO) {
            totalAmountReleased = amountReleasedIdIbo[_tokenId];
            totalAmount = ibo.totalCvgPerToken(_tokenId);
        } else if (_vestingType == VestingType.TEAM) {
            totalAmountReleased = vestingSchedules[_vestingType].totalReleased;
            totalAmount = MAX_SUPPLY_TEAM;
        } else {
            totalAmountReleased = vestingSchedules[_vestingType].totalReleased;
            totalAmount = MAX_SUPPLY_DAO;
        }

        amountToRelease = _calculateRelease(_vestingType, totalAmount, totalAmountReleased);
    }

    /**
     * @dev Calculate the releasable amount in function of the vestingSchedule params, the total amount vested for a tokenId
     * and the total amount already released. Calculated linearly between cliff release and the end of the vesting.
     */
    function _calculateRelease(
        VestingType vestingType,
        uint256 totalAmount,
        uint256 totalAmountReleased
    ) private view returns (uint256 amountToRelease) {
        uint256 cliffTimestamp = startTimestamp + vestingSchedules[vestingType].daysBeforeCliff * ONE_DAY;

        uint256 endVestingTimestamp = cliffTimestamp + vestingSchedules[vestingType].daysAfterCliff * ONE_DAY;

        if (block.timestamp > cliffTimestamp) {
            if (block.timestamp > endVestingTimestamp) {
                amountToRelease = totalAmount - totalAmountReleased;
            } else {
                uint256 ratio = ((endVestingTimestamp - block.timestamp) * ONE_GWEI) /
                    (endVestingTimestamp - cliffTimestamp);

                uint256 amountDroppedAtCliff = (totalAmount * vestingSchedules[vestingType].dropCliff) / 1000;

                uint256 totalAmountAfterCliff = totalAmount - amountDroppedAtCliff;

                amountToRelease =
                    amountDroppedAtCliff +
                    (((ONE_GWEI - ratio) * totalAmountAfterCliff) / ONE_GWEI) -
                    totalAmountReleased;
            }
        }
    }
}
