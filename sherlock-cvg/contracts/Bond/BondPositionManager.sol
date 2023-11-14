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

/// @title Cvg-Finance - BondPositionManager
/// @notice Manages bond positions
contract BondPositionManager is CvgERC721TimeLockingUpgradeable {
    /// @dev convergence ecosystem address
    ICvgControlTower public cvgControlTower;

    /// @dev bong logo contract address
    IBondLogo internal logo;

    /// @dev base URI for the tokens
    string internal baseURI;

    /// @dev The ID of the next token that will be minted. Skips 0
    uint256 public nextId;

    /// @dev BondDepository address per tokenId
    mapping(uint256 => address) public bondPerTokenId;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     *  @notice Initialize function of the bond position manager, can only be called once (by the clone factory).
     *  @param _cvgControlTower address of the control tower
     */
    function initialize(ICvgControlTower _cvgControlTower) external initializer {
        cvgControlTower = _cvgControlTower;
        __ERC721_init("Bond Positions", "BOND-CVG");
        address _treasuryDao = _cvgControlTower.treasuryDao();
        require(_treasuryDao != address(0), "TREASURY_DAO_ZERO");
        _transferOwnership(_treasuryDao);
        nextId = 1;
        maxLockingTime = 10 days;
    }

    modifier onlyBondDepository() {
        require(cvgControlTower.isBond(msg.sender), "NOT_BOND_DEPOSITORY");
        _;
    }

    /**
     * @notice Mint a Bond position to the bond creator.
     * @param account to mint the Bond Position
     */
    function mint(address account) external onlyBondDepository {
        uint256 tokenId = nextId++;
        bondPerTokenId[tokenId] = msg.sender;
        _mint(account, tokenId);
    }

    /**
     *  @notice Burn a token if the position is fully claimed.
     *  @param tokenId to burn
     */
    function burn(uint256 tokenId) external onlyNftOwner(tokenId) {
        require(IBondDepository(bondPerTokenId[tokenId]).bondInfos(tokenId).payout == 0, "POSITION_STILL_OPEN");
        _burn(tokenId);
    }

    /**
     *  @notice Get the bond contracts associated to provided tokens.
     *  @param tokenIds IDs of the tokens
     *  @return array of bond contract
     */
    function getBondDepositoryOfTokens(uint256[] calldata tokenIds) external view returns (address[] memory) {
        uint256 length = tokenIds.length;
        address[] memory tokenAddresses = new address[](length);
        for (uint256 index = 0; index < length; ) {
            tokenAddresses[index] = bondPerTokenId[tokenIds[index]];
            unchecked {
                ++index;
            }
        }
        return tokenAddresses;
    }

    /* =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=
                            URI & LOGO
    =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-= */

    function setBaseURI(string memory baseURI_) external onlyOwner {
        baseURI = baseURI_;
    }

    function _baseURI() internal view virtual override returns (string memory) {
        return baseURI;
    }

    /**
     *  @notice Get the URI of the token.
     *  @param tokenId ID of the token
     *  @return token URI
     */
    function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
        IBondLogo _logo = cvgControlTower.bondLogo();
        if (address(_logo) == address(0)) {
            string memory localBaseURI = _baseURI();
            return
                bytes(localBaseURI).length > 0 ? string(abi.encodePacked(localBaseURI, Strings.toString(tokenId))) : "";
        }

        return _logo._tokenURI(logoInfo(tokenId));
    }

    /**
     *  @notice Get the logo information for the provided token ID.
     *  @param tokenId ID of the token
     *  @return logo information of the token
     */
    function logoInfo(uint256 tokenId) public view returns (IBondLogo.LogoInfos memory) {
        _requireMinted(tokenId);

        IBondStruct.TokenVestingInfo memory infos = IBondDepository(bondPerTokenId[tokenId]).getTokenVestingInfo(
            tokenId
        );
        return
            IBondLogo.LogoInfos({
                tokenId: tokenId,
                termTimestamp: infos.term,
                pending: infos.pending,
                cvgClaimable: infos.claimable,
                unlockingTimestamp: unlockingTimestampPerToken[tokenId]
            });
    }
}
