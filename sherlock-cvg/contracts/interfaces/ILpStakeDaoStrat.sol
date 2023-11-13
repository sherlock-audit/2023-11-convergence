// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

interface ILpStakeDaoStrat is IERC20Metadata {
    function deposit(address staker, uint256 amount, bool earn) external;

    function token() external view returns (IERC20Metadata);
}
