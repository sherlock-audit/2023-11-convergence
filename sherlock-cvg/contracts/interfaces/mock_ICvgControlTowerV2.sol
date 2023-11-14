// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./ICvgControlTower.sol";

interface ICvgControlTowerV2 is ICvgControlTower {
    function changeTestMapping(address _addr) external;
}
