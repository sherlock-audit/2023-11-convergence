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

import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/// @notice ERC721Enumerable implementing a timelock per token
///         This value is checked on several usecase in the protocol
///         Allows to protect a token buyer in order to dont be frontrun buy a malicious seller
abstract contract CvgERC721TimeLockingUpgradeable is ERC721EnumerableUpgradeable, Ownable2StepUpgradeable {
    /// @dev maximum time from actual timestamp of locking
    uint256 public maxLockingTime;

    /// @dev buffer for minimum time lock
    uint256 public constant BUFFER = 15 minutes;

    /// @dev timelockEnd per tokenId
    mapping(uint256 => uint256) public unlockingTimestampPerToken;

    uint256[49] private __gap;

    modifier onlyNftOwner(uint256 tokenId) {
        _isOwnerOf(msg.sender, tokenId);
        _;
    }

    function getTokenIdsForWallet(address _wallet) public view returns (uint256[] memory) {
        uint256 range = balanceOf(_wallet);
        uint256[] memory tokenIds = new uint256[](range);
        for (uint256 i; i < range; i++) {
            tokenIds[i] = tokenOfOwnerByIndex(_wallet, i);
        }
        return tokenIds;
    }

    function _isOwnerOf(address addr, uint256 _tokenId) internal view {
        require(addr == ownerOf(_tokenId), "TOKEN_NOT_OWNED");
    }

    /// @notice As the Contract Owner, change the maximum lock time
    /// @param newMaxLockingTime new maximum locking time, in seconds
    function setMaxLockingTime(uint256 newMaxLockingTime) external onlyOwner {
        maxLockingTime = newMaxLockingTime;
    }

    /// @notice As the Token Owner, set a timelock until a timestamp
    /// @param tokenId token to timelock
    /// @param timestamp timestamp where the timelock ends
    function setLock(uint256 tokenId, uint256 timestamp) external onlyNftOwner(tokenId) {
        require(timestamp >= block.timestamp + BUFFER, "TIME_BUFFER");
        require(timestamp - block.timestamp < maxLockingTime, "MAX_TIME_LOCK");
        if (unlockingTimestampPerToken[tokenId] != 0) {
            require(timestamp > unlockingTimestampPerToken[tokenId], "ALREADY_LOCKED");
        }
        unlockingTimestampPerToken[tokenId] = timestamp;
    }
}
