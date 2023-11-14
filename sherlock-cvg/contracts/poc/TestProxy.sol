// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract TestProxy {
    uint256 public valueOne;
    uint256[] public arrayOne;

    function setValue(uint256 _value) external {
        valueOne = _value;
    }

    function addArray(uint256 _value) external {
        arrayOne.push(_value);
    }

    function getArray() external view returns (uint256[] memory) {
        return arrayOne;
    }

    function changeValue() external {
        uint256[] memory values = arrayOne;
        for (uint256 i; i < 200; i++) {
            valueOne++;
        }
    }
}
