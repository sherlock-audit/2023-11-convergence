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

import "../Token/CvgERC721TimeLockingUpgradeable.sol";
import "../interfaces/ICvgControlTower.sol";

/*
 * @title Cvg-Finance - LockingPositionManager
 * @notice This is  an NFT contract  representing a locking position.
 * @dev This contract inherits the time lock functionality from CvgERC721TimeLockingUpgradeable
 * this contract is not callable directly, only through the LockingPositionService for Mint & Burn.
 */
contract LockingPositionManager is CvgERC721TimeLockingUpgradeable {
    /** @dev ConvergenceControlTower ControlTower. */
    ICvgControlTower public cvgControlTower;

    ILockingLogo internal logo;

    /** @dev The ID of the next token that will be minted. Skips 0. */
    uint256 public nextId;

    string internal baseURI;

    /** @custom:oz-upgrades-unsafe-allow constructor */
    constructor() {
        _disableInitializers();
    }

    function initialize(ICvgControlTower _cvgControlTower) external initializer {
        cvgControlTower = _cvgControlTower;
        __ERC721_init("Locking Convergence", "LCK-CVG");
        address _treasuryDao = _cvgControlTower.treasuryDao();
        require(_treasuryDao != address(0), "TREASURY_DAO_ZERO");
        _transferOwnership(_treasuryDao);
        nextId = 1;
        maxLockingTime = 10 days;
    }

    modifier onlyLockingPositionService() {
        require(msg.sender == address(cvgControlTower.lockingPositionService()), "NOT_LOCKING_SERVICE");
        _;
    }

    /**
     * @notice Mint a Locking position to the lock creator.
     * @dev Only callable through the mintPosition on the LockingPositionService.
     * @param account to mint the Lock Position
     */
    function mint(address account) external onlyLockingPositionService {
        _mint(account, nextId++);
    }

    /**
     * @notice Burn a Locking position.
     * @dev Only callable through the burn on the LockingPositionService.
     * @param tokenId to burn
     */
    function burn(uint256 tokenId) external onlyLockingPositionService {
        _burn(tokenId);
    }

    /* =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=
                            URI & LOGO
    =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-= */

    /**
     * @notice Set the base URI for all token IDs.
     * @param _newBaseURI the new base url of all tokens
     */
    function setBaseURI(string memory _newBaseURI) external onlyOwner {
        baseURI = _newBaseURI;
    }

    /**
     * @notice Get the url for a specific token.
     * @param tokenId id of the token
     */
    function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
        _requireMinted(tokenId);

        ILockingLogo _logo = cvgControlTower.lockingLogo();
        if (address(_logo) == address(0)) {
            string memory localBaseURI = _baseURI();
            return
                bytes(localBaseURI).length > 0 ? string(abi.encodePacked(localBaseURI, Strings.toString(tokenId))) : "";
        }

        return _logo._tokenURI(logoInfo(tokenId));
    }

    /**
     * @notice Retrieve the logo details for a particular token for svg display.
     * @param tokenId id of the token
     */
    function logoInfo(uint256 tokenId) public view returns (ILockingLogo.LogoInfos memory) {
        ILockingPositionService.LockingInfo memory _lockingInfo = cvgControlTower.lockingPositionService().lockingInfo(
            tokenId
        );
        return
            ILockingLogo.LogoInfos({
                tokenId: _lockingInfo.tokenId,
                cvgLocked: _lockingInfo.cvgLocked,
                lockEnd: _lockingInfo.lockEnd,
                ysPercentage: _lockingInfo.ysPercentage,
                mgCvg: _lockingInfo.mgCvg,
                unlockingTimestamp: unlockingTimestampPerToken[tokenId]
            });
    }

    /**
     * @notice Returns information on token use by other methods to determine compliance.
     * @param tokenId id of the token
     * @return owner ot the token
     * @return unlockingTimestamp for the token
     */
    function getComplianceInfo(uint256 tokenId) external view returns (address, uint256) {
        return (ownerOf(tokenId), unlockingTimestampPerToken[tokenId]);
    }

    function _baseURI() internal view virtual override returns (string memory) {
        return baseURI;
    }
}
