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

import "../interfaces/ICvgControlTower.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
/**
* @title Cvg-Finance - LockingPositionDelegate
* @notice Manage the lock delegation for 3 types of tokens : VeCvg, YsCvg and MgCvg.
* @dev VeCvg : Vote for the governance of the protocol (DAO vote on snapshot  and Vote for inflation distribution  via the gauge system.
*  | MgCvg : Vote for meta-governance of substrate protocols( DAO vote on snapshot ).
*  | YsCVg : Share of the distribution of treasury rewards.
*/
contract LockingPositionDelegate is Initializable {
    struct MgCvgDelegatee {
        address delegatee;
        uint96 percentage;
    }

    struct OwnedAndDelegated {
        uint256[] owneds;
        uint256[] mgDelegateds;
        uint256[] veDelegateds;
    }

    /** @dev Convergence ControlTower. */
    ICvgControlTower public cvgControlTower;
    /** @notice Maximum number of delegatees for MGcVg of a locking position. */
    uint256 public maxMgDelegatees;
    /** @notice Maximum number of tokenIds delegated for an address. */
    uint256 public maxTokenIdsDelegated;
    /** @notice Returns the delegated address of veCvg for a locking position . This address can, on behalf of the holder : vote on the GaugeController , vote on the Convergence Snapshot. */
    mapping(uint256 => address) public delegatedVeCvg;
    /** @notice Returns the tokenIds delegating their veCVG to an address. */
    mapping(address => uint256[]) public veCvgDelegatees;
    /** @notice Returns the delegated address of ysCvg for a tokenId, this address can claim the rewards from the YsDistributor on behalf of the owner. */
    mapping(uint256 => address) public delegatedYsCvg;
    /** @notice Returns the delegated addresses and the percentage of mgCVG for a tokenId. This address can, on behalf of the holder, vote on the Snapshot meta-governance proposal. */
    mapping(uint256 => MgCvgDelegatee[]) public delegatedMgCvg;
    /** @notice Returns the tokenIds delegating their mgCvg to an address. */
    mapping(address => uint256[]) public mgCvgDelegatees;
    /** @notice Keep track of the token usable by an address. */
    mapping(address => OwnedAndDelegated) internal tokenOwnedAndDelegated;

    event DelegateVeCvg(uint256 indexed tokenId, address to);
    event DelegateShare(uint256 indexed tokenId, address delegatee);
    event DelegateMetagovernance(uint256 indexed tokenId, address indexed to, uint256 percentage);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(ICvgControlTower _cvgControlTower) external initializer {
        cvgControlTower = _cvgControlTower;
        maxMgDelegatees = 5;
        maxTokenIdsDelegated = 25;
    }

    /* =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=
                        MODIFIERS
    =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-= */

    modifier onlyTokenOwner(uint256 tokenId) {
        require(msg.sender == cvgControlTower.lockingPositionManager().ownerOf(tokenId), "TOKEN_NOT_OWNED");
        _;
    }

    /* =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=
                        ONLY LOCKING OWNER
    =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-= */
    /**
    * @notice Set the maximum number of delegation that can be set for a token on the MetaGovernance.
    * @dev this limit is set to avoid oog when calculating or managing the voting power
    * @param _maxMgDelegatees is the maximum number of mg delegatees for a token.
    */
    function setMaxMgDelegatees(uint256 _maxMgDelegatees) external {
        require(cvgControlTower.lockingPositionManager().owner() == msg.sender, "NOT_OWNER");
        maxMgDelegatees = _maxMgDelegatees;
    }

    /**
    * @notice Set the maximum number of tokenIds that can be delegated to an address.
    * @dev this limit is set to avoid oog when calculating or managing the voting power, and spamming user.
    * @param _maxTokenIdsDelegated is the maximum number of tokenIds delegated for an address.
    */
    function setMaxTokenIdsDelegated(uint256 _maxTokenIdsDelegated) external {
        require(cvgControlTower.lockingPositionManager().owner() == msg.sender, "NOT_OWNER");
        maxTokenIdsDelegated = _maxTokenIdsDelegated;
    }

    /* =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=
                            GETTERS
    =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-= */

    /**
    * @notice Obtain the veCvg delegated tokens identifiers for a delegatee.
    * @param account is the address of the delegatee.
    */
    function getVeCvgDelegatees(address account) external view returns (uint256[] memory) {
        return veCvgDelegatees[account];
    }

    /**
    * @notice Obtain the mgCvg delegated token(NFT) for a delegatee.
    * @param account is the address of the delegatee.
    */
    function getMgCvgDelegatees(address account) external view returns (uint256[] memory) {
        return mgCvgDelegatees[account];
    }

    /**
    * @notice  Obtain the delegatee for a token (NFT).
    * @param _tokenId is the ID of the token (NFT) targeted.
    */
    function getDelegatedMgCvg(uint256 _tokenId) external view returns (MgCvgDelegatee[] memory) {
        return delegatedMgCvg[_tokenId];
    }

    /**
    * @notice Obtain all the token containing mgCvg and veCvg (owned and delegated) for an address.
    * @param _addr is the targeted address
    */
    function getTokenOwnedAndDelegated(address _addr) external view returns (OwnedAndDelegated memory) {
        return tokenOwnedAndDelegated[_addr];
    }

    /**
    * @notice Obtain all the token containing mgCvg (owned and delegated) for an address.
    * @param _addr is the targeted address
    */
    function getTokenMgOwnedAndDelegated(address _addr) external view returns (uint256[] memory, uint256[] memory) {
        return (tokenOwnedAndDelegated[_addr].owneds, tokenOwnedAndDelegated[_addr].mgDelegateds);
    }

    /**
    * @notice Obtain all the token containing veCvg (owned and delegated) for an address.
    * @param _addr is the targeted address
    */
    function getTokenVeOwnedAndDelegated(address _addr) external view returns (uint256[] memory, uint256[] memory) {
        return (tokenOwnedAndDelegated[_addr].owneds, tokenOwnedAndDelegated[_addr].veDelegateds);
    }

    /* =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=
                            PUBLICS
    =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-= */
    /**
    * @notice Get the information about a MgCvg delegatee for a token.
    * @param _tokenId is the ID of the token (NFT) targeted.
    * @param _to is the address we want to get information from for the token.
    * @return _toPercentage is the percentage of mgCVG delegated to the address, _totalPercentage is the total percentage of mgCVG delegated for the token, _toIndex is the index of the delegatee in the array of delegatees.
    */
    function getMgDelegateeInfoPerTokenAndAddress(
        uint256 _tokenId,
        address _to
    ) public view returns (uint256, uint256, uint256) {
        MgCvgDelegatee[] memory _delegatees = delegatedMgCvg[_tokenId];
        uint256 _delegateesLength = _delegatees.length;

        uint256 _totalPercentage;
        uint256 _toPercentage;
        uint256 _toIndex = 999;
        /** @dev Loop through all delegatees to find  _to params.*/
        for (uint256 i; i < _delegateesLength;) {
            if (_delegatees[i].delegatee == _to) {
                _toPercentage = _delegatees[i].percentage;
                _toIndex = i;
            }

            _totalPercentage += _delegatees[i].percentage;
            unchecked {
                i++;
            }
        }

        return (_toPercentage, _totalPercentage, _toIndex);
    }
    /**
    * @notice Get the tokenId index in the array of delegated veCVG tokens for an user.
    * @dev   Use to find the old delegatee of a token , in order to remove this delegation
    *       when an update or a clean occurs.
    * @param _delegatee is the address of the delegatee
    * @param _tokenId is the ID of the token (NFT) targeted
    */
    function getIndexForVeDelegatee(address _delegatee, uint256 _tokenId) public view returns (uint256) {
        uint256[] memory _tokenIds = veCvgDelegatees[_delegatee];
        uint256 _length = _tokenIds.length;

        for (uint256 i; i < _length;) {
            if (_tokenIds[i] == _tokenId) return i;
            unchecked {
                ++i;
            }
        }

        return 0;
    }

    /**
    * @notice Get the tokenId index in the array of delegated mgCVG tokens for an user.
    * @dev    Use to find the index of delegatee, when an update or a clean occurs.
    * @param _delegatee is the address of the delegatee.
    * @param _tokenId is the ID of the token (NFT) targeted.
    */
    function getIndexForMgCvgDelegatee(address _delegatee, uint256 _tokenId) public view returns (uint256) {
        uint256[] memory _tokenIds = mgCvgDelegatees[_delegatee];
        uint256 _length = _tokenIds.length;

        for (uint256 i; i < _length;) {
            if (_tokenIds[i] == _tokenId) return i;
            unchecked {
                ++i;
            }
        }

        return 0;
    }

    /* =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=
                            EXTERNALS
    =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-= */
    /**
     *  @notice Delegates ysCVG for a tokenId to another address, this delegatee can claim the TDE rewards on behalf of the owner.
     *  @dev Only the owner of the Locking position can delegate.
     *  @param _tokenId is the ID of the token (NFT) targeted.
     *  @param _to is the address of the delegatee.
    */
    function delegateYsCvg(uint256 _tokenId, address _to) external onlyTokenOwner(_tokenId) {
        delegatedYsCvg[_tokenId] = _to;
        emit DelegateShare(_tokenId, _to);
    }

    /**
    * @notice Delegates veCVG for a tokenId to another address.
    * @dev Address 0x0 can be used to  remove the delegation, the previous delegatee will be removed.
    * @param _tokenId is the ID of the token (NFT) targeted.
    * @param _to is the address of the delegatee.
    */
    function delegateVeCvg(uint256 _tokenId, address _to) external onlyTokenOwner(_tokenId) {
        require(veCvgDelegatees[_to].length < maxTokenIdsDelegated, "TOO_MUCH_VE_TOKEN_ID_DELEGATED");
        /** @dev Find if this tokenId is already delegated to an address. */
        address previousOwner = delegatedVeCvg[_tokenId];
        if (previousOwner != address(0)) {
            /** @dev If it is  we remove the previous delegation.*/
            uint256 _toIndex = getIndexForVeDelegatee(previousOwner, _tokenId);
            uint256 _delegateesLength = veCvgDelegatees[previousOwner].length;
            /** @dev Removing delegation.*/
            veCvgDelegatees[previousOwner][_toIndex] = veCvgDelegatees[previousOwner][_delegateesLength - 1];
            veCvgDelegatees[previousOwner].pop();
        }

        /** @dev Associate tokenId to a new delegated address.*/
        delegatedVeCvg[_tokenId] = _to;

        if (_to != address(0)) {
            /** @dev Add delegation to the new address.*/
            veCvgDelegatees[_to].push(_tokenId);
        }
        emit DelegateVeCvg(_tokenId, _to);
    }

    /**
     * @notice Delegates a percentage of the mgCvG for a tokenId to another address (the mgCvg can be delegated to several addresses).
     * @dev Percentage=0 can be used to remove a delegation.
     * @param _tokenId is the ID of the token (NFT) to delegate voting power.
     * @param _to is the address we want to delegate to.
     * @param _percentage is the percentage we want to delegate to the address.
     */
    function delegateMgCvg(uint256 _tokenId, address _to, uint96 _percentage) external onlyTokenOwner(_tokenId) {
        require(_percentage <= 100, "INVALID_PERCENTAGE");

        uint256 _delegateesLength = delegatedMgCvg[_tokenId].length;
        require(_delegateesLength < maxMgDelegatees, "TOO_MUCH_DELEGATEES");

        uint256 tokenIdsDelegated = mgCvgDelegatees[_to].length;
        require(tokenIdsDelegated < maxTokenIdsDelegated, "TOO_MUCH_MG_TOKEN_ID_DELEGATED");

        (uint256 _toPercentage, uint256 _totalPercentage, uint256 _toIndex) = getMgDelegateeInfoPerTokenAndAddress(
            _tokenId,
            _to
        );
        bool _isUpdate = _toIndex != 999;
        uint256 _newTotalPercentage = _isUpdate
            ? (_totalPercentage + _percentage - _toPercentage)
            : (_totalPercentage + _percentage);
        require(_newTotalPercentage <= 100, "TOO_MUCH_PERCENTAGE");

        require(_isUpdate || _percentage > 0, "CANNOT_REMOVE_NOT_DELEGATEE");

        /** @dev Delegating.*/
        if (_percentage > 0) {
            MgCvgDelegatee memory delegatee = MgCvgDelegatee({delegatee: _to, percentage: _percentage});

            /** @dev Updating delegatee.*/
            if (_isUpdate) {
                delegatedMgCvg[_tokenId][_toIndex] = delegatee;
            } else {
                /** @dev Adding new delegatee.*/
                delegatedMgCvg[_tokenId].push(delegatee);
                mgCvgDelegatees[_to].push(_tokenId);
            }
        } else {
            /** @dev Removing delegation.*/
            delegatedMgCvg[_tokenId][_toIndex] = delegatedMgCvg[_tokenId][_delegateesLength - 1];
            delegatedMgCvg[_tokenId].pop();

            uint256 _tokenIdIndex = getIndexForMgCvgDelegatee(_to, _tokenId);
            mgCvgDelegatees[_to][_tokenIdIndex] = mgCvgDelegatees[_to][tokenIdsDelegated - 1];
            mgCvgDelegatees[_to].pop();
        }

        emit DelegateMetagovernance(_tokenId, _to, _percentage);
    }

    /**
    * @notice Allow a user to manage the tokens id (owned and delegated) used to represent their voting power.
    *   @dev This prevents bad actors who will spam an address by transferring or delegating a lot of VE/MG positions.
    *          | This will prevent the oog when the voting/metagovernance power is calculated.
    *  @param _ownedAndDelegatedTokens array of owned/veDelegated/mgDelegated tokenIds allowed
    */
    function manageOwnedAndDelegated(OwnedAndDelegated calldata _ownedAndDelegatedTokens) external {
        /** @dev Clear the struct owneds and delegateds tokenId allowed for this user.*/
        delete tokenOwnedAndDelegated[msg.sender];

        /** @dev Add new owned tokenIds allowed for this user.*/
        for (uint256 i; i < _ownedAndDelegatedTokens.owneds.length;) {
            /** @dev Check if tokenId is owned by the user.*/
            require(
                msg.sender == cvgControlTower.lockingPositionManager().ownerOf(_ownedAndDelegatedTokens.owneds[i]),
                "TOKEN_NOT_OWNED"
            );
            tokenOwnedAndDelegated[msg.sender].owneds.push(_ownedAndDelegatedTokens.owneds[i]);
            unchecked {
                ++i;
            }
        }
        /** @dev Add new mgCvg delegated tokenIds allowed for this user.*/
        for (uint256 i; i < _ownedAndDelegatedTokens.mgDelegateds.length;) {
            /** @dev Check if the user is a mgCvg delegatee for this tokenId.*/
            (, , uint256 _toIndex) = getMgDelegateeInfoPerTokenAndAddress(
                _ownedAndDelegatedTokens.mgDelegateds[i],
                msg.sender
            );
            require(_toIndex != 999, "NFT_NOT_MG_DELEGATED");
            tokenOwnedAndDelegated[msg.sender].mgDelegateds.push(_ownedAndDelegatedTokens.mgDelegateds[i]);
            unchecked {
                ++i;
            }
        }
        /** @dev Add new veCvg delegated tokenIds allowed for this user.*/
        for (uint256 i; i < _ownedAndDelegatedTokens.veDelegateds.length;) {
            /** @dev Check if the user is the veCvg delegatee for this tokenId.*/
            require(msg.sender == delegatedVeCvg[_ownedAndDelegatedTokens.veDelegateds[i]], "NFT_NOT_VE_DELEGATED");
            tokenOwnedAndDelegated[msg.sender].veDelegateds.push(_ownedAndDelegatedTokens.veDelegateds[i]);
            unchecked {
                ++i;
            }
        }
    }

    /**
    * @notice Method for a delegatee to remove a tokenId delegated at his address.
    * @param _tokenId to remove
    * @param removeVeDelegated boolean if user wants to remove VeCvgDelegation
    * @param removeMgDelegated boolean if user wants to remove MgCvgDelegation
    */
    function removeTokenIdDelegated(uint256 _tokenId, bool removeVeDelegated, bool removeMgDelegated) external {
        if (removeVeDelegated) {
            _cleanVeDelegatee(_tokenId, true);
        }
        if (removeMgDelegated) {
            _removeMgTokenIdDelegated(_tokenId);
        }
    }
    /**
    *   @notice Method for an owner of tokenId to clean all associated delegatees.
    *   @param _tokenId to remove
    *   @param cleanMgDelegatees boolean if user wants to clean all MgCvgDelegatees
    *   @param cleanVeDelegatees boolean if user wants to clean all VeCvgDelegatees
    */

    function cleanDelegatees(
        uint256 _tokenId,
        bool cleanVeDelegatees,
        bool cleanMgDelegatees
    ) external onlyTokenOwner(_tokenId) {
        if (cleanVeDelegatees) {
            _cleanVeDelegatee(_tokenId, false);
        }
        if (cleanMgDelegatees) {
            _cleanMgDelegatees(_tokenId);
        }
    }

    /**
    * @notice when a lock position is minted, this method can  automatically add this token take into account for Snapshot.
    * @dev can only be called by lockingPositionService
    * @param _tokenId to remove
    */
    function addTokenAtMint(uint256 _tokenId, address minter) external {
        require(address(cvgControlTower.lockingPositionService()) == msg.sender, "NOT_LOCKING_SERVICE");
        tokenOwnedAndDelegated[minter].owneds.push(_tokenId);
    }

    /* =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=
                            INTERNALS
    =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-= */
    /*
    * @dev Clean the veCvg delegation  for the tokenId.
    * @param _tokenId is the ID of the token (NFT) targeted
    * @param isRemoveByDelegatee is a boolean to check if the function is called by the delegatee
    */
    function _cleanVeDelegatee(uint256 _tokenId, bool isRemoveByDelegatee) internal {
        address previousOwner = delegatedVeCvg[_tokenId];
        if (isRemoveByDelegatee) {
            require(msg.sender == previousOwner, "NOT_VE_DELEGATEE");
        }
        /** @dev Find index for the previous owner.*/
        uint256 _toIndex = getIndexForVeDelegatee(previousOwner, _tokenId);
        /** @dev Get length of delegatees.*/
        uint256 _delegateesLength = veCvgDelegatees[previousOwner].length;
        /** @dev Removing delegation.*/
        veCvgDelegatees[previousOwner][_toIndex] = veCvgDelegatees[previousOwner][_delegateesLength - 1];
        veCvgDelegatees[previousOwner].pop();

        /** @dev Set zero address for delegatee of this tokenId.*/
        delegatedVeCvg[_tokenId] = address(0);

        emit DelegateVeCvg(_tokenId, address(0));
    }

    /**
    *  @notice Clean the mgCvg delegation for the tokenId call by the delegatee.
    *  @param _tokenId is the ID of the token (NFT) targeted.
    */
    function _cleanMgDelegatees(uint256 _tokenId) internal {
        MgCvgDelegatee[] memory mgCvgDelegatee = delegatedMgCvg[_tokenId];
        for (uint256 i; i < mgCvgDelegatee.length;) {
            address _to = mgCvgDelegatee[i].delegatee;
            uint256 _tokenIdIndex = getIndexForMgCvgDelegatee(_to, _tokenId);
            mgCvgDelegatees[_to][_tokenIdIndex] = mgCvgDelegatees[_to][mgCvgDelegatees[_to].length - 1];
            mgCvgDelegatees[_to].pop();

            emit DelegateMetagovernance(_tokenId, _to, 0);

            unchecked {
                ++i;
            }
        }
        delete delegatedMgCvg[_tokenId];
    }

    /**
    * @dev Clean the mgCvg delegation for the tokenId call by the delegatee.
    * @param _tokenId is the ID of the token (NFT) targeted
    */
    function _removeMgTokenIdDelegated(uint256 _tokenId) internal {
        (, , uint256 _toIndex) = getMgDelegateeInfoPerTokenAndAddress(_tokenId, msg.sender);
        /** @dev Check if msg.sender is the delegatee.*/
        require(_toIndex != 999, "NOT_MG_DELEGATEE");
        uint256 _delegateesLength = delegatedMgCvg[_tokenId].length;

        /** @dev Removing delegation.*/
        delegatedMgCvg[_tokenId][_toIndex] = delegatedMgCvg[_tokenId][_delegateesLength - 1];
        delegatedMgCvg[_tokenId].pop();

        uint256 _tokenIdIndex = getIndexForMgCvgDelegatee(msg.sender, _tokenId);
        mgCvgDelegatees[msg.sender][_tokenIdIndex] = mgCvgDelegatees[msg.sender][
            mgCvgDelegatees[msg.sender].length - 1
            ];
        mgCvgDelegatees[msg.sender].pop();

        emit DelegateMetagovernance(_tokenId, address(0), 0);
    }
}
