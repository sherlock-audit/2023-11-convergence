// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockFeeDistributor {
    IERC20 public sdFrax3Crv;

    constructor(IERC20 _sdFrax3Crv) {
        sdFrax3Crv = _sdFrax3Crv;
    }

    function token() external view returns (address) {
        return address(sdFrax3Crv);
    }

    function claim(address addr) external returns (uint256) {
        uint256 amount = sdFrax3Crv.balanceOf(address(this));
        if (amount != 0) {
            require(sdFrax3Crv.transfer(addr, amount), "transfer failed");
        }

        return amount;
    }
}
