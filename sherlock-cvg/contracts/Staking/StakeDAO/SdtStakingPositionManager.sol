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

/// @title Cvg-Finance - SdtStakingPositionManager
/// @notice This contract is an ERC721 contract tokenizing the Staking Positions.
/// @dev    When an user stakes in an SdtStakingPositionService contract, it mints an NFT through this contract.
pragma solidity ^0.8.0;

import "../../Token/CvgERC721TimeLockingUpgradeable.sol";
import "../../interfaces/ICvgControlTower.sol";

contract SdtStakingPositionManager is CvgERC721TimeLockingUpgradeable {
    struct TokenStaking {
        address stakingContract;
        uint256 tokenId;
    }

    /// @dev Convergence control tower
    ICvgControlTower public cvgControlTower;

    /// @dev Staking, allows to reconstruct a dynamic image from a template registered onchain
    ISdtStakingLogo internal logo;

    /// @dev Base URI of the NFT
    string internal baseURI;

    /// @notice Id of the next Staking Position to be minted
    uint256 public nextId;

    /// @dev Staking address per tokenId
    mapping(uint256 => address) public stakingPerTokenId;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /** @dev Initialize function of the Staking position manager
     *  @param _cvgControlTower   Address of the Cvg Control tower
     */
    function initialize(ICvgControlTower _cvgControlTower) external initializer {
        cvgControlTower = _cvgControlTower;
        /// @dev Initialize the NFT contract
        __ERC721_init("Staking Positions Convergence", "STK-CVG");
        address _treasuryDao = _cvgControlTower.treasuryDao();
        require(_treasuryDao != address(0), "TREASURY_DAO_ZERO");
        /// @dev Transfers the ownership of the contract to the DAO
        _transferOwnership(_treasuryDao);
        /// @dev Initialize first token ID as 1
        nextId = 1;
        /// @dev Timelocking maximum is initialized at 10 days.
        maxLockingTime = 10 days;
    }

    function getComplianceInfo(uint256 tokenId) external view returns (address, address, uint256) {
        return (ownerOf(tokenId), stakingPerTokenId[tokenId], unlockingTimestampPerToken[tokenId]);
    }

    /**
     * @dev Verifies the full compliance of a token. Checked during withdraw & claim.
     *      Checks that the transaction is done from the staking contract linked to the token ID.
     *      Checks that the position is owned by the account.
     *      Checks that the token is not timelocked.
     *  @param tokenId of the staking position
     * @param receiver Receiver address of the operation
     */
    function checkTokenFullCompliance(uint256 tokenId, address receiver) external view {
        /// @dev Verify that receiver is always the NFT owner
        require(receiver == ownerOf(tokenId), "TOKEN_NOT_OWNED");
        /// @dev As the StakingPositionManager is the NFT contract, we verify that this ID has been created from this StakingPositionService
        require(msg.sender == stakingPerTokenId[tokenId], "WRONG_STAKING");
        /// @dev We verify that the tokenId is not timelocked
        require(unlockingTimestampPerToken[tokenId] < block.timestamp, "TOKEN_TIMELOCKED");
    }

    /**
     * @dev Verifies the compliance of a position to increase the deposit amount on it.
     *      Checks that the transaction is done from the staking contract linked to the token ID.
     *      Checks that the position is owned by the account.
     * @param tokenId of the staking position
     * @param receiver Receiver address of the Staking Position NFT
     */
    function checkIncreaseDepositCompliance(uint256 tokenId, address receiver) external view {
        /// @dev Verify that receiver is always the NFT owner
        require(receiver == ownerOf(tokenId), "TOKEN_NOT_OWNED");
        /// @dev As the StakingPositionManager is the NFT contract, we verify that this ID has been created from this StakingPositionService
        require(msg.sender == stakingPerTokenId[tokenId], "WRONG_STAKING");
    }

    /**
     * @notice Verifies that the input of the claimMultiple on the SdtRewardReceiver is correct.
     * @dev    Checks if a group of staking position, sorted by contract are compliant with the account.
     *         Checks that each Staking position is owned by the account.
     *         Checks that each Staking position is linked to the staking contract.
     *         Checks that each Staking position is not Timelocked.
     * @param claimInput Array of staking position sorted by staking service to check compliance on.
     * @param receiver Receiver address of the ERC20 rewards from staking
     */
    function checkMultipleClaimCompliance(
        ISdtStakingPositionManager.ClaimSdtStakingContract[] calldata claimInput,
        address receiver
    ) external view {
        /// @dev Loop over Staking Contracts
        for (uint256 i; i < claimInput.length; ) {
            /// @dev Loop over Token Ids
            for (uint256 j; j < claimInput[i].tokenIds.length; ) {
                uint256 tokenId = claimInput[i].tokenIds[j];
                /// @dev Verify that receiver is always the NFT owner
                require(receiver == ownerOf(tokenId), "TOKEN_NOT_OWNED");
                /// @dev As the StakingPositionManager is the NFT contract, we verify that this ID has been created from this StakingPositionService
                require(address(claimInput[i].stakingContract) == stakingPerTokenId[tokenId], "WRONG_STAKING");
                /// @dev We verify that the tokenId is not timelocked
                require(unlockingTimestampPerToken[tokenId] < block.timestamp, "TOKEN_TIMELOCKED");
                unchecked {
                    ++j;
                }
            }
            unchecked {
                ++i;
            }
        }
    }

    /** @dev This function is only callable by a StakingContract.
     *       Mints an NFT to the user and link the tokenId with the corresponding StakingPositionService.
     *  @param account Receiver of the minted NFT
     */
    function mint(address account) external {
        /// @dev Verify that caller is a StakingContract
        require(cvgControlTower.isStakingContract(msg.sender), "NOT_STAKING");
        /// @dev Increments the nextId
        uint256 tokenId = nextId++;
        /// @dev Link the minted token with the StakingService
        stakingPerTokenId[tokenId] = msg.sender;
        /// @dev Mints the token
        _mint(account, tokenId);
    }

    /** @notice Burns an NFT linked to a Staking position.
     *          An NFT cannot be burnt if the position still have asset staked.
     *  @param _tokenId Token ID of the NFT to burn.
     */
    function burn(uint256 _tokenId) external onlyNftOwner(_tokenId) {
        require(
            ISdtStakingPositionService(stakingPerTokenId[_tokenId]).tokenTotalStaked(_tokenId) == 0,
            "TOTAL_STAKED_NOT_EMPTY"
        );
        _burn(_tokenId);
    }

    /* =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=
                            URI & LOGO
    =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-= */

    function setBaseURI(string memory newBaseURI) external onlyOwner {
        baseURI = newBaseURI;
    }

    function _baseURI() internal view virtual override returns (string memory) {
        return baseURI;
    }

    /** @notice Returns basic URI or SVG encoded in Base64 if logo contract is set.
     *  @param tokenId TokenId of the SVG encoded SVG to return.
     */
    function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
        ISdtStakingLogo _logo = cvgControlTower.sdtStakingLogo();

        if (address(_logo) == address(0)) {
            string memory uri = _baseURI();
            return bytes(uri).length != 0 ? string(abi.encodePacked(uri, Strings.toString(tokenId))) : "";
        }

        return _logo._tokenURI(logoInfo(tokenId));
    }

    /** @notice Return the information displayed in the dynamic on chain image.
     *  @param tokenId ID of the token to fetch information from
     */
    function logoInfo(uint256 tokenId) public view returns (ISdtStakingLogo.LogoInfos memory) {
        _requireMinted(tokenId);

        ISdtStakingPositionService.StakingInfo memory stakingInfo = ISdtStakingPositionService(
            stakingPerTokenId[tokenId]
        ).stakingInfo(tokenId);

        return
            ISdtStakingLogo.LogoInfos({
                tokenId: stakingInfo.tokenId,
                symbol: stakingInfo.symbol,
                pending: stakingInfo.pending,
                totalStaked: stakingInfo.totalStaked,
                cvgClaimable: stakingInfo.cvgClaimable,
                sdtClaimable: stakingInfo.sdtClaimable,
                unlockingTimestamp: unlockingTimestampPerToken[tokenId]
            });
    }

    /** @notice Return an array of all NFT owned by an account and the StakingPositionService linked to each.
     *  @param account Account owning the returned tokenIds.
     */
    function getTokenIdsAndStakingContracts(address account) external view returns (TokenStaking[] memory) {
        uint256[] memory tokenIds = getTokenIdsForWallet(account);
        uint256 length = tokenIds.length;
        TokenStaking[] memory tokenAddresses = new TokenStaking[](length);
        for (uint256 index = 0; index < length; ) {
            tokenAddresses[index] = TokenStaking({
                stakingContract: stakingPerTokenId[tokenIds[index]],
                tokenId: tokenIds[index]
            });

            unchecked {
                ++index;
            }
        }

        return tokenAddresses;
    }
}
