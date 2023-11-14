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

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../interfaces/ICvgControlTower.sol";

/// @title Cvg Finance - CvgSDT
/// @notice Liquid locker of StakeDao (SDT) token.
///         Holding 1 CvgSDT is equivalent to holds 1veSDT.
contract CvgSDT is ERC20 {
    ICvgControlTower public immutable cvgControlTower;
    IERC20 public immutable sdt;

    constructor(ICvgControlTower _cvgControlTower) ERC20("Convergence-SDT", "cvgSDT") {
        cvgControlTower = _cvgControlTower;
        IERC20 _sdt = _cvgControlTower.sdt();
        /// @dev Verifies that SDT has been setup into the CvgControlTower
        require(address(_sdt) != address(0), "SDT_ZERO");
        sdt = _sdt;
    }

    /**
     *   @notice Mint an amount of CvgSdt to the account in exchange of the same amount in SDT.
     *           All SDT are transferred to the veSDTMultisig that will lock for MAXTIME the SDT into veSDT.
     *   @param account receiver of the minted CvgSdt
     *   @param amount to mint to the receiver, is also the amount of SDT that will be taken from the msg.sender
     *
     **/
    function mint(address account, uint256 amount) external {
        sdt.transferFrom(msg.sender, cvgControlTower.veSdtMultisig(), amount);
        _mint(account, amount);
    }

    /**
     *   @notice Burns an amount of CvgSDT to the caller of this function
     *   @param amount to burn to the msg.sender
     *
     **/
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }
}
