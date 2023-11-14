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

/// @title Cvg-Finance - SdtFeeCollector
/// @notice Receives SDT fees deducted from StakeDao gauge harvesting
///         Dispatches these fees to different receivers following a setup repartition
pragma solidity ^0.8.0;

import "../../interfaces/ICvgControlTower.sol";

import "@openzeppelin/contracts/access/Ownable2Step.sol";

contract SdtFeeCollector is Ownable2Step {
    struct Fees {
        address receiver;
        uint96 feePercentage;
    }

    /// @notice event emitted when the setUpRootFees function is called
    /// @param rootFees total fees taken from StakeDao harvesting
    event SetUpRootFees(uint256 rootFees);

    /// @notice event emitted when the setUpFeesRepartition function is called
    /// @param feesRepartition  percentage repartition between fees receivers
    event SetUpRootRepartition(Fees[] feesRepartition);

    /// @dev represents 100% of fees
    uint256 constant TOTAL_FEES = 100_000;

    IERC20 public immutable sdt;

    /// @dev Is the initial fee taken in SDT on StakeDao gauges
    uint256 public rootFees = 17_500;

    /// @dev Array of all pairs feePercentage / receiver, sum of all feePercentage are always equal to 100%
    Fees[] public feesRepartition;

    constructor(ICvgControlTower _cvgControlTower) {
        /// @dev Verifies that everything has been properly setup in CvgControlTower
        IERC20 _sdt = _cvgControlTower.sdt();
        address _cvgSdtBuffer = address(_cvgControlTower.cvgSdtBuffer());
        address _treasuryBonds = _cvgControlTower.treasuryBonds();
        address _treasuryDao = _cvgControlTower.treasuryDao();
        require(address(_sdt) != address(0), "SDT_ZERO");
        require(_cvgSdtBuffer != address(0), "CVGSDT_DISTRIBUTOR_ZERO");
        require(_treasuryBonds != address(0), "TRESO_BONDS_ZERO");
        require(_treasuryDao != address(0), "TRESO_DAO_ZERO");
        sdt = _sdt;

        /// @dev setup initial repartition of fees
        feesRepartition.push(Fees({receiver: _cvgSdtBuffer, feePercentage: 71_500}));
        feesRepartition.push(Fees({receiver: _treasuryBonds, feePercentage: 28_500}));
        _transferOwnership(_treasuryDao);
    }

    /** @notice Updates the fees taken on pullRewards on SdtBuffers in SDT
     *  @param _newRootFees New % of SDT fees, 100_000 = 100%
     */
    function setUpRootFees(uint256 _newRootFees) external onlyOwner {
        /// @dev fee can't be greater than 20%
        require(_newRootFees <= 20_000, "FEES_TOO_BIG");
        /// @dev setup the fee
        rootFees = _newRootFees;
        emit SetUpRootFees(_newRootFees);
    }

    /** @notice Update the pairs feePercentage / receiver, only callable by the contract Owner.
     *          The sum of all feePercentage must be equal to 100%.
     *  @param _newFeesRepartition New receiver/percentage array to set
     */
    function setUpFeesRepartition(Fees[] calldata _newFeesRepartition) external onlyOwner {
        /// @dev sum all percentage fees must be equal to 100_000 (100%)
        uint256 total;
        /// @dev Clean the storage array
        delete feesRepartition;
        /// @dev Iterates through the array passed in parameter
        for (uint256 i; i < _newFeesRepartition.length; ) {
            /// @dev increment the total fees
            total += _newFeesRepartition[i].feePercentage;
            /// @dev Verify that a receiver is not zero address
            require(_newFeesRepartition[i].receiver != address(0), "ZERO_RECEIVER");
            /// @dev Push the struct in the array
            feesRepartition.push(_newFeesRepartition[i]);
            unchecked {
                ++i;
            }
        }
        /// @dev Verify sum of all percentages is equal to 100%
        require(total == TOTAL_FEES, "TOTAL_NOT_100");

        emit SetUpRootRepartition(_newFeesRepartition);
    }

    /// @notice Withdraw and disperse all SDT fees following feesRepartition setup
    function withdrawSdt() external {
        IERC20 _sdt = sdt;
        /// @dev Fetches the balance in SDT on the contract
        uint256 balance = _sdt.balanceOf(address(this));
        /// @dev Iterates through the feeRepartitions array
        for (uint256 j; j < feesRepartition.length; ) {
            /// @dev Computes and transfers SDT fees to the iterated receiver
            _sdt.transfer(feesRepartition[j].receiver, (balance * feesRepartition[j].feePercentage) / TOTAL_FEES);
            unchecked {
                ++j;
            }
        }
    }
}
