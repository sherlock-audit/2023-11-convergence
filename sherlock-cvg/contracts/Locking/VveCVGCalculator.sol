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

import "../interfaces/ICvgControlTower.sol";

/**
 * @title Cvg-Finance - VveCvgCalculator
 * @notice Allow to get voting power inluding vested tokens .
 * @dev  will be deprecated at the end of the vesting  period.
 */
contract VveCvgCalculator {
    /** @dev Convergence control tower */
    ILockingPositionService public immutable lockingPositionService;
    /** @dev Vesting contract */
    IVestingCvg public immutable vestingCvg;
    /** @dev Cvg token */
    ICvg public immutable cvg;
    /** @dev Treasury airdrop */
    address public immutable treasuryAirdrop;

    //TODO will change if we don't raise everything
    uint256 public constant TOTAL_VESTING_SUPPLY_SEED_TEAM = 22_050_000 * 10 ** 18;
    //TODO will change if we don't raise everything
    uint256 public constant SHARE_VVECVG = 1470; //22 050 000*10**4/150 000 000 => 14.7%

    constructor(ICvgControlTower _cvgControlTower) {
        lockingPositionService = _cvgControlTower.lockingPositionService();
        cvg = _cvgControlTower.cvgToken();
        vestingCvg = _cvgControlTower.vestingCvg();
        treasuryAirdrop = _cvgControlTower.treasuryAirdrop();
        require(address(lockingPositionService) != address(0), "LOCKING_ZERO");
        require(address(cvg) != address(0), "CVG_ZERO");
        require(address(vestingCvg) != address(0), "VESTING_ZERO");
        require(treasuryAirdrop != address(0), "TREASURY_AIRDROP_ZERO");
    }

    /**
     *  @notice Calculate vveCvg Power (vesting veCvg) for a given address.
     *  @param account is the account targeted
     */
    function calculateVveCvg(address account) public view returns (uint256) {
        IVestingCvg _vestingCvg = vestingCvg;
        uint256 totalCvgUser;
        uint256 start = _vestingCvg.startTimestamp();
        uint256 end;

        if (account == _vestingCvg.whitelistedTeam()) {
            IVestingCvg.VestingSchedule memory _vestingSchedule = _vestingCvg.vestingSchedules(
                IVestingCvg.VestingType.TEAM
            );
            end = start + _vestingSchedule.daysBeforeCliff * 1 days;
            totalCvgUser = _vestingCvg.MAX_SUPPLY_TEAM();
        } else {
            IVestingCvg.VestingSchedule memory _vestingSchedule = _vestingCvg.vestingSchedules(
                IVestingCvg.VestingType.SEED
            );
            end = start + _vestingSchedule.daysBeforeCliff * 1 days;
            IPresaleCvgSeed _presaleSeed = _vestingCvg.presaleSeed();
            /// @dev get all tokenId for the account
            uint256[] memory tokenIds = _presaleSeed.getTokenIdsForWallet(account);
            uint256 length = tokenIds.length;
            /// @dev return 0 if no tokenIds
            if (length == 0) {
                return 0;
            }
            /// @dev calculate totalCvg for the account
            for (uint256 i; i < length; ) {
                totalCvgUser += _presaleSeed.presaleInfoTokenId(tokenIds[i]).cvgAmount;
                unchecked {
                    ++i;
                }
            }
        }
        ICvg _cvg = cvg;

        /// @dev compute total Cvg emission
        uint256 totalCvgEmission = _cvg.totalSupply() -
            _cvg.balanceOf(address(_vestingCvg)) -
            _cvg.balanceOf(treasuryAirdrop);

        /// @dev vveCvg amount for the user at the beginning
        return
            block.timestamp > start && block.timestamp < end
                ? (SHARE_VVECVG * totalCvgEmission * totalCvgUser) / (TOTAL_VESTING_SUPPLY_SEED_TEAM * 10 ** 4)
                : 0;
    }

    /**
     *  @notice Get Sum of Voting Power for vveCvg (vesting veCvg) and veCvg.
     *          This function is used for Snapshot IP and will be deprecated at the
     *          end of the vesting cliffs period.
     *  @param _account is the account targeted
     */
    function vestingVotingPowerPerAddress(address _account) external view returns (uint256) {
        return lockingPositionService.veCvgVotingPowerPerAddress(_account) + calculateVveCvg(_account);
    }
}
