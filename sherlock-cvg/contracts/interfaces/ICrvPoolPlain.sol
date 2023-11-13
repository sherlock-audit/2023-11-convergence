// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ICrvPoolPlain {
    function calc_token_amount(uint256[2] memory amounts) external view returns (uint256);

    function get_virtual_price() external view returns (uint256);

    function add_liquidity(uint256[2] memory amounts, uint256 min_mint_amount) external;
    function add_liquidity(uint256[2] memory amounts, uint256 min_mint_amount, address receiver) external;

    function exchange(
        int128 i, //index tokenIn
        int128 j, //index tokenOut
        uint256 dx, //amountIn
        uint256 min_dy, //amountOut
        address receiver
    ) external;

    function get_dy(
        int128 i, //index tokenIn
        int128 j, //index tokenOut
        uint256 dx //amountIn
    ) external view returns (uint256);

    function coins(uint256 i) external view returns (address);

    function balanceOf(address arg0) external view returns (uint256);
}
