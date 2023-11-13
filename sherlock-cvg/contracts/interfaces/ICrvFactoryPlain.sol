// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ICrvFactoryPlain {
    function deploy_plain_pool(
        string memory _name,
        string memory _symbol,
        address[4] memory _coins,
        uint256 A,
        uint256 fee,
        uint256 asset_type,
        uint256 implementation_idx
    ) external returns (address);

    function find_pool_for_coins(address _from, address _to, uint256 i) external view returns (address);
}
