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
import "../interfaces/ILockingPositionService.sol";
import "../interfaces/IGaugeController.sol";
import "../interfaces/ICvgControlTower.sol";
import "../interfaces/IBondDepository.sol";
import "../interfaces/IAggregationRouterV5.sol";
import "../interfaces/ICvgUtilities.sol";

contract PositionLocker {
    ILockingPositionService public lockingPositionService;
    IGaugeController public gaugeController;
    IERC20 public cvgToken;
    ICvgControlTower public cvgControlTower;

    constructor(ICvgControlTower _cvgControlTower) {
        lockingPositionService = _cvgControlTower.lockingPositionService();
        cvgToken = _cvgControlTower.cvgToken();
        gaugeController = _cvgControlTower.gaugeController();
        cvgControlTower = _cvgControlTower;
    }

    function mintPosition(
        uint96 lockDuration,
        uint256 amount,
        uint64 ysPercentage,
        address receiver,
        bool isAddToManagedTokens
    ) external {
        lockingPositionService.mintPosition(lockDuration, amount, ysPercentage, receiver, isAddToManagedTokens);
    }

    function increaseLockAmount(uint256 tokenId, uint256 amount, address operator) external {
        lockingPositionService.increaseLockAmount(tokenId, amount, operator);
    }

    function increaseLockTime(uint256 tokenId, uint256 durationAdd) external {
        lockingPositionService.increaseLockTime(tokenId, durationAdd);
    }

    function increaseLockTimeAndAmount(
        uint256 tokenId,
        uint256 durationAdd,
        uint256 amount,
        address operator
    ) external {
        lockingPositionService.increaseLockTimeAndAmount(tokenId, durationAdd, amount, operator);
    }

    function voteGauge(uint256 tokenId, address gaugeAddress, uint256 weight) external {
        gaugeController.simple_vote(tokenId, gaugeAddress, weight);
    }

    function approveCvg(address spender, uint256 amount) external {
        cvgToken.approve(spender, amount);
    }

    function swapTokenBondAndLock(
        IERC20 _tokenIn,
        IBondDepository _bondContract,
        uint256 _bondTokenId,
        uint256 _lockTokenId,
        uint256 _bondTokenAmount,
        uint96 _lockDuration,
        uint256 _durationAdd,
        uint64 _ysPercentage,
        IAggregationRouterV5.SwapTransaction calldata _swapTransaction
    ) external {
        ICvgUtilities _cvgUtilities = ICvgUtilities(cvgControlTower.cvgUtilities());
        _tokenIn.approve(address(_cvgUtilities), type(uint256).max);
        _tokenIn.approve(address(cvgControlTower.swapperFactory()), type(uint256).max);
        _cvgUtilities.swapTokenBondAndLock(
            _bondContract,
            _bondTokenId,
            _lockTokenId,
            _bondTokenAmount,
            _lockDuration,
            _durationAdd,
            _ysPercentage,
            _swapTransaction
        );
    }
}
