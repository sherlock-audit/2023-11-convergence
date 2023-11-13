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

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";

import "../interfaces/ICvgControlTower.sol";
import "../interfaces/IAggregationRouterV5.sol";

contract SwapperFactory is Ownable2Step {
    using SafeERC20 for IERC20;

    /// @dev cvg control tower
    ICvgControlTower public immutable cvgControlTower;

    /// @dev 1inch aggregation router
    IAggregationRouterV5 public immutable aggregationRouter;

    uint256 public constant MAX_UINT = type(uint256).max;

    /// @dev ERC20 token => is allowed to be swapped from in cvgToke
    mapping(IERC20 => bool) public srcTokenAllowed;

    /**
     * @notice deploys Swapper Factory
     * @param _cvgControlTower address of the CVG control tower
     * @param _aggregationRouter address of the 1inch aggregation router
     */
    constructor(ICvgControlTower _cvgControlTower, IAggregationRouterV5 _aggregationRouter) {
        cvgControlTower = _cvgControlTower;
        aggregationRouter = _aggregationRouter;
    }

    /**
     * @notice Swap source tokens to another token through 1inch protocol
     * @param _user address of the user initiating the swap
     * @param _swapTransaction aggregation data used for the swap to occur through 1inch protocol
     */
    function executeSimpleSwap(
        address _user,
        IAggregationRouterV5.SwapTransaction calldata _swapTransaction
    ) external returns (uint256 amount) {
        address cvgUtilities = cvgControlTower.cvgUtilities();

        require(msg.sender == cvgUtilities, "NOT_CVG_UTILITIES");
        require(_swapTransaction.description.amount > 0, "INVALID_AMOUNT");
        require(srcTokenAllowed[_swapTransaction.description.srcToken], "SRC_TOKEN_NOT_ALLOWED");
        require(_swapTransaction.description.dstReceiver == cvgUtilities, "INVALID_RECEIVER");

        /// @dev transfer user's tokens to this contract before swapping
        _swapTransaction.description.srcToken.safeTransferFrom(
            _user,
            address(this),
            _swapTransaction.description.amount
        );

        /// @dev swap source token to underlyer asset
        (amount, ) = aggregationRouter.swap(
            _swapTransaction.executor,
            _swapTransaction.description,
            _swapTransaction.permit,
            _swapTransaction.data
        );
    }

    /**
     * @notice Approve 1inch aggregation router to spend contract's ERC20 specific token
     * @param _token address on an ERC20 token
     * @param _amount amount to be approved to 1inch aggregation router
     */
    function approveRouterTokenSpending(IERC20 _token, uint256 _amount) external onlyOwner {
        _token.forceApprove(address(aggregationRouter), _amount);
    }

    /**
     * @notice Toggle source token to be swapped to TOKE through 1inch protocol
     * @param _token address on an ERC20 token
     */
    function toggleSourceToken(IERC20 _token) external onlyOwner {
        srcTokenAllowed[_token] = !srcTokenAllowed[_token];
        if (srcTokenAllowed[_token]) {
            _token.forceApprove(address(aggregationRouter), MAX_UINT);
        } else {
            _token.forceApprove(address(aggregationRouter), 0);
        }
    }
}
