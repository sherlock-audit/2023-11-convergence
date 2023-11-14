// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract TestDocumentation {
    /**
     *  @notice Claim the rewards associated to the locking position NFT
     *           - Chemical
     *           -Corrosif
     *           <br> - Bond Treasury Yield is computed and sended by the YsDistributor
     *  @dev I'm a dev comment
     */
    uint256 public valueOne;

    /**
     *  @notice Claim the rewards associated to the locking position NFT
     *           - Chemical
     *           -Corrosif
     *           <br> - Bond Treasury Yield is computed and sended by the YsDistributor
     *  @dev I'm a dev comment
     */
    uint256[] public arrayOne;

    /**
     *  @notice Claim the rewards associated to the locking position NFT
     *           - Chemical
     *           -Corrosif
     *           <br> - Bond Treasury Yield is computed and sended by the YsDistributor
     *  @dev I'm a dev comment
     *       - Yop soudzdef
     *       - Iop
     *      -  Xelor
     *  @param _value I'm a value.
     * @return The value returned
     */
    function setValue(uint256 _value) external returns (uint256) {
        valueOne = _value;
        return _value;
    }

    function addArray(uint256 _value) external {
        arrayOne.push(_value);
    }

    /**
     *  @notice Claim the rewards associated to the locking position NFT
     *           - Chemical
     *           -Corrosif
     *           <br> - Bond Treasury Yield is computed and sended by the YsDistributor
     *  @dev I'm a dev comment
     *       - Yop soudzdef
     *       - Iop
     *      -  Xelor
     *  @param account I'm a value.
     * @return The value returned
     */
    function getArray(address account) external view returns (uint256[] memory) {
        return arrayOne;
    }
}
