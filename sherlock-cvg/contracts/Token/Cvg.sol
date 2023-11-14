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

/// @title Cvg-Finance - CVG
/// @notice Convergence ERC20 token ($CVG)
contract Cvg is ERC20 {
    uint256 public constant MAX_AIRDROP = 1_500_000 * 10 ** 18;
    uint256 public constant MAX_VESTING = 40_500_000 * 10 ** 18;
    uint256 public constant MAX_BOND = 48_000_000 * 10 ** 18;
    uint256 public constant MAX_STAKING = 60_000_000 * 10 ** 18;

    /// @dev convergence ecosystem address
    ICvgControlTower public immutable cvgControlTower;

    /// @dev amount of tokens minted through bond contracts
    uint256 public mintedBond;

    /// @dev amount of tokens minted through staking contracts
    uint256 public mintedStaking;

    constructor(ICvgControlTower _cvgControlTower, address _vestingCvg, address _airdrop) ERC20("Convergence", "CVG") {
        _mint(_vestingCvg, MAX_VESTING);
        _mint(_airdrop, MAX_AIRDROP);
        cvgControlTower = _cvgControlTower;
    }

    /**
     * @notice mint function for bond contracts
     * @param account address receiving the tokens
     * @param amount amount of tokens to mint
     */
    function mintBond(address account, uint256 amount) external {
        require(cvgControlTower.isBond(msg.sender), "NOT_BOND");
        uint256 newMintedBond = mintedBond + amount;
        require(newMintedBond <= MAX_BOND, "MAX_SUPPLY_BOND");

        mintedBond = newMintedBond;
        _mint(account, amount);
    }

    /**
     * @notice mint function for staking contracts
     * @param account address receiving the tokens
     * @param amount amount of tokens to mint
     */
    function mintStaking(address account, uint256 amount) external {
        require(cvgControlTower.isStakingContract(msg.sender), "NOT_STAKING");
        uint256 newMintedStaking = mintedStaking + amount;
        require(newMintedStaking <= MAX_STAKING, "MAX_SUPPLY_STAKING");

        mintedStaking = newMintedStaking;

        _mint(account, amount);
    }

    /**
     * @notice burn tokens
     * @param amount amount of tokens to burn
     */
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }
}
