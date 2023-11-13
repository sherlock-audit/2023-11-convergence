// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IMultiMerkleStash {
    struct claimParam {
        address token;
        uint256 index;
        uint256 amount;
        bytes32[] merkleProof;
    }

    function isClaimed(address token, uint256 index) external view returns (bool);

    function claim(
        address token,
        uint256 index,
        address account,
        uint256 amount,
        bytes32[] calldata merkleProof
    ) external;

    function claimMulti(address account, claimParam[] calldata claims) external;

    function updateMerkleRoot(address token, bytes32 _merkleRoot) external;

    function merkleRoot(address) external view returns (bytes32);

    function update(address) external view returns (uint256);

    function owner() external view returns (address);
}
