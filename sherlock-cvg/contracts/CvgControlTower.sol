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

import "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import "./interfaces/ICvgControlTower.sol";

/// @title Cvg-Finance - CvgControlTower
/// @notice Heart of Convergence
/// @dev Acts as a dictionary of addresses for other contracts
contract CvgControlTower is Ownable2StepUpgradeable {
    /* =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=
                  GLOBAL PARAMETERS
    =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-= */

    uint128 public cvgCycle;
    ICvgOracle public cvgOracle;
    ICvg public cvgToken;
    ICvgRewards public cvgRewards;
    address public cloneFactory;
    address public cvgUtilities;
    ISwapperFactory public swapperFactory;

    /* =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=
                  BONDS GLOBAL PARAMETERS
    =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-= */

    IBondCalculator public bondCalculator;
    IBondPositionManager public bondPositionManager;

    /// @dev Stores all the base template for our bond contracts.
    /// @dev Acts as a versioning system, a new entry to this array is considered the new version from which future bond contracts will be cloned.
    address[] public allBaseBonds; /// All Base bond contracts

    mapping(address => address[]) public bondClones; /// Base bond => Clones linked to this version

    /// @dev Determines if an address is a bond contract and therefore is able to mint CVG with `mintBond` function.
    mapping(address => bool) public isBond; /// contractAddress => bool

    /* =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=
                  STAKING GLOBAL PARAMETERS
    =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-= */
    ISdtStakingPositionManager public sdtStakingPositionManager;
    ISdtStakingPositionService public cvgSdtStaking;
    ISdtBlackHole public sdtBlackHole;
    ISdtBuffer public cvgSdtBuffer;
    IERC20Mintable public cvgSDT;
    IERC20 public sdt;
    address public poolCvgSdt;
    address public sdtFeeCollector;
    address public sdtStakingViewer;
    ISdtStakingPositionService[] public sdAndLpAssetStaking;
    address public sdtRewardReceiver;

    /// @dev Determines if an address is a sdt staking contract and therefore can trigger withdrawals from the SdtBlackHole.
    mapping(address => bool) public isSdtStaking; /// contractAddress => bool

    /**
     * @dev Determines if an address is a staking contract and therefore is able to mint CVG with `mintStaking` function.
     *      Only these addresses can be set up as gauge.
     */
    mapping(address => bool) public isStakingContract; /// contractAddress => bool
    address public sdtUtilities;

    /* =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=
                 LOCKING PARAMETERS
    =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-= */
    ILockingPositionManager public lockingPositionManager;
    ILockingPositionService public lockingPositionService;
    ILockingPositionDelegate public lockingPositionDelegate;
    IVotingPowerEscrow public votingPowerEscrow;
    IGaugeController public gaugeController;
    IYsDistributor public ysDistributor;

    /* =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=
                 WALLETS
    =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-= */
    address public treasuryBonds;
    address public treasuryDao;
    address public treasuryAirdrop;
    address public treasuryCore;
    address public veSdtMultisig;

    /* =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=
                 LOGO CONTRACT
    =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-= */
    ISdtStakingLogo public sdtStakingLogo;
    IBondLogo public bondLogo;
    ILockingLogo public lockingLogo;

    /* =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=
                 VESTING
    =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-= */

    IVestingCvg public vestingCvg;
    address public ibo;

    event NewCycle(uint256 cvgCycleId);

    /* =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=
                        INITIALIZE
    =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-= */
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _treasuryBonds,
        address _veSdtMultisig,
        address _treasuryDao,
        address _treasuryAirdrop,
        address _treasuryCore
    ) external initializer {
        require(_treasuryBonds != address(0), "TREASURY_BOND_ZERO");
        require(_veSdtMultisig != address(0), "VESDT_MULTISIG_ZERO");
        require(_treasuryDao != address(0), "TREASURY_DAO_ZERO");
        require(_treasuryAirdrop != address(0), "TREASURY_AIRDROP_ZERO");
        require(_treasuryCore != address(0), "TREASURY_CORE_ZERO");
        treasuryBonds = _treasuryBonds;
        veSdtMultisig = _veSdtMultisig;
        treasuryDao = _treasuryDao;
        treasuryAirdrop = _treasuryAirdrop;
        treasuryCore = _treasuryCore;
        cvgCycle = 1;
        _transferOwnership(msg.sender);
    }

    /* =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=
                      CLONE FACTORY FUNCTIONS
    =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-= */
    /**
     * @notice Insert a new bond contract, can only be called by the clone factory.
     * @param _newClone address of the new bond
     * @param _version version of the new bond
     */
    function insertNewBond(address _newClone, uint256 _version) external {
        require(msg.sender == cloneFactory, "CLONE_FACTORY");
        bondClones[allBaseBonds[_version - 1]].push(_newClone);
        isBond[_newClone] = true;
    }

    /**
     * @notice Toggle a staking contract, can only be called by the owner.
     * @param contractAddress address of the staking contract to toggle
     */
    function toggleStakingContract(address contractAddress) external onlyOwner {
        isStakingContract[contractAddress] = !isStakingContract[contractAddress];
    }

    /**
     * @notice Insert a new sd/LP-asset staking contract, can only be called by the clone factory.
     * @param _sdtStakingClone address of the new staking contract
     */
    function insertNewSdtStaking(ISdtStakingPositionService _sdtStakingClone) external {
        require(msg.sender == cloneFactory, "CLONE_FACTORY");
        sdAndLpAssetStaking.push(_sdtStakingClone);
        isSdtStaking[address(_sdtStakingClone)] = true;
        isStakingContract[address(_sdtStakingClone)] = true;
    }

    /* =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=
                      INTERNAL FUNCTIONS
    =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-= */

    /**
     * @notice Pagination pattern to avoid running out of gaz if an array is too big. Chunk the original array.
     * @param _fullArray - full array address to be split
     * @param _cursorStart - index of the array to be the first item of the returned array
     * @param _desiredLength - max length of the returned array
     * @return array of addresses
     */
    function _paginate(
        address[] memory _fullArray,
        uint256 _cursorStart,
        uint256 _desiredLength
    ) internal pure returns (address[] memory) {
        uint256 _totalArrayLength = _fullArray.length;

        if (_cursorStart + _desiredLength > _totalArrayLength) {
            _desiredLength = _totalArrayLength - _cursorStart;
        }
        /// @dev Prevent to reach an index that doesn't exist in the array
        address[] memory array = new address[](_desiredLength);
        for (uint256 i = _cursorStart; i < _cursorStart + _desiredLength; ) {
            array[i - _cursorStart] = _fullArray[i];
            unchecked {
                ++i;
            }
        }

        return array;
    }

    /* =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=
                      BONDS GETTERS
    =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-= */
    /// @notice Get all base template of bond contracts.
    function getAllBaseBonds() public view returns (address[] memory) {
        return allBaseBonds;
    }

    /**
     * @notice Get the number of bond contracts for a specific version.
     * @param _baseBondVersion bond version
     */
    function getBondLengthPerVersion(uint256 _baseBondVersion) public view returns (uint256) {
        return bondClones[allBaseBonds[_baseBondVersion - 1]].length;
    }

    /**
     * @notice Get a list of bond contracts paginated by version.
     * @param _baseBondVersion bond version
     * @param _cursor starting position of the cursor
     * @param _lengthDesired desired length of array
     * @return array of bond contracts
     */
    function getBondContractsPerVersion(
        uint256 _baseBondVersion,
        uint256 _cursor,
        uint256 _lengthDesired
    ) external view returns (IBondStruct.BondView[] memory) {
        address[] memory bondAddresses = _paginate(
            bondClones[allBaseBonds[_baseBondVersion - 1]],
            _cursor,
            _lengthDesired
        );
        IBondStruct.BondView[] memory bondStructs = new IBondStruct.BondView[](bondAddresses.length);

        for (uint256 i = 0; i < bondAddresses.length; ) {
            bondStructs[i] = IBondDepository(bondAddresses[i]).getBondView();
            unchecked {
                ++i;
            }
        }

        return bondStructs;
    }

    struct SdtStaking {
        address stakingContract;
        string stakingName;
    }

    /**
     * @notice Get sdt staking contracts with pagination.
     * @param _cursorStart cursor position (starting position)
     * @param _lengthDesired desired length of array
     * @return array of sdt staking contracts with related global data
     */
    function getSdtStakings(uint256 _cursorStart, uint256 _lengthDesired) external view returns (SdtStaking[] memory) {
        uint256 _totalArrayLength = sdAndLpAssetStaking.length;

        if (_cursorStart + _lengthDesired > _totalArrayLength) {
            _lengthDesired = _totalArrayLength - _cursorStart;
        }
        /// @dev Prevent to reach an index that doesn't exist in the array
        SdtStaking[] memory array = new SdtStaking[](_lengthDesired);
        for (uint256 i = _cursorStart; i < _cursorStart + _lengthDesired; ) {
            ISdtStakingPositionService sdtStakingService = sdAndLpAssetStaking[i];
            array[i - _cursorStart] = SdtStaking({
                stakingContract: address(sdtStakingService),
                stakingName: sdtStakingService.stakingAsset().name()
            });
            unchecked {
                ++i;
            }
        }

        return array;
    }

    /* =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=
                          SETTERS
    =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-= */
    function setOracle(ICvgOracle newCvgOracle) external onlyOwner {
        cvgOracle = newCvgOracle;
    }

    function setTreasuryBonds(address newTreasuryBondsMultisig) external onlyOwner {
        treasuryBonds = newTreasuryBondsMultisig;
    }

    function setTreasuryDao(address newTreasuryDao) external onlyOwner {
        treasuryDao = newTreasuryDao;
    }

    function setTreasuryAirdrop(address newTreasuryAirdrop) external onlyOwner {
        treasuryAirdrop = newTreasuryAirdrop;
    }

    function setTreasuryCore(address newtreasuryCore) external onlyOwner {
        treasuryCore = newtreasuryCore;
    }

    function setBondCalculator(IBondCalculator newBondCalculator) external onlyOwner {
        bondCalculator = newBondCalculator;
    }

    function setCvgRewards(ICvgRewards newCvgRewards) external onlyOwner {
        cvgRewards = newCvgRewards;
    }

    function setVeCVG(IVotingPowerEscrow newVotingPowerEscrow) external onlyOwner {
        votingPowerEscrow = newVotingPowerEscrow;
    }

    function setGaugeController(IGaugeController newGaugeController) external onlyOwner {
        gaugeController = newGaugeController;
    }

    function setCloneFactory(address newCloneFactory) external onlyOwner {
        cloneFactory = newCloneFactory;
    }

    function setNewVersionBaseBond(address _newBaseBond) external onlyOwner {
        allBaseBonds.push(_newBaseBond);
    }

    function setLockingPositionManager(ILockingPositionManager newLockingPositionManager) external onlyOwner {
        lockingPositionManager = newLockingPositionManager;
    }

    function setLockingPositionService(ILockingPositionService newLockingPositionService) external onlyOwner {
        lockingPositionService = newLockingPositionService;
    }

    function setLockingPositionDelegate(ILockingPositionDelegate newLockingPositionDelegate) external onlyOwner {
        lockingPositionDelegate = newLockingPositionDelegate;
    }

    function setYsDistributor(IYsDistributor _ysDistributor) external onlyOwner {
        ysDistributor = _ysDistributor;
    }

    function setCvg(ICvg _cvgToken) external onlyOwner {
        cvgToken = _cvgToken;
    }

    function setBondPositionManager(IBondPositionManager _bondPositionManager) external onlyOwner {
        bondPositionManager = _bondPositionManager;
    }

    function setSdtStakingPositionManager(ISdtStakingPositionManager _sdtStakingPositionManager) external onlyOwner {
        sdtStakingPositionManager = _sdtStakingPositionManager;
    }

    function setSdtStakingViewer(address _sdtStakingViewer) external onlyOwner {
        sdtStakingViewer = _sdtStakingViewer;
    }

    function setSdtStakingLogo(ISdtStakingLogo _sdtStakingLogo) external onlyOwner {
        sdtStakingLogo = _sdtStakingLogo;
    }

    function setBondLogo(IBondLogo _bondLogo) external onlyOwner {
        bondLogo = _bondLogo;
    }

    function setLockingLogo(ILockingLogo _lockingLogo) external onlyOwner {
        lockingLogo = _lockingLogo;
    }

    function setSdt(IERC20 _sdt) external onlyOwner {
        sdt = _sdt;
    }

    function setCvgSdt(IERC20Mintable _cvgSDT) external onlyOwner {
        cvgSDT = _cvgSDT;
    }

    function setCvgSdtStaking(ISdtStakingPositionService _cvgSdtStaking) external onlyOwner {
        cvgSdtStaking = _cvgSdtStaking;
    }

    function setVeSdtMultisig(address _veSdtMultisig) external onlyOwner {
        veSdtMultisig = _veSdtMultisig;
    }

    function setCvgSdtBuffer(ISdtBuffer _cvgSdtBuffer) external onlyOwner {
        cvgSdtBuffer = _cvgSdtBuffer;
    }

    function setPoolCvgSdt(address _poolCvgSDT) external onlyOwner {
        poolCvgSdt = _poolCvgSDT;
    }

    function setSdtBlackHole(ISdtBlackHole _sdtBlackHole) external onlyOwner {
        sdtBlackHole = _sdtBlackHole;
    }

    function setSdtFeeCollector(address _sdtFeeCollector) external onlyOwner {
        sdtFeeCollector = _sdtFeeCollector;
    }

    function setCvgUtilities(address _cvgUtilities) external onlyOwner {
        cvgUtilities = _cvgUtilities;
    }

    function setSwapperFactory(ISwapperFactory _swapperFactory) external onlyOwner {
        swapperFactory = _swapperFactory;
    }

    function setVestingCvg(IVestingCvg _vestingCvg) external onlyOwner {
        vestingCvg = _vestingCvg;
    }

    function setSdtUtilities(address _sdtUtilities) external onlyOwner {
        sdtUtilities = _sdtUtilities;
    }

    function setIbo(address _ibo) external onlyOwner {
        ibo = _ibo;
    }

    function setSdtRewardReceiver(address _rewardReceiver) external onlyOwner {
        sdtRewardReceiver = _rewardReceiver;
    }

    /* =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=
                      CYCLE MANAGEMENT
    =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-= */

    /**
     * @notice Update Cvg cycle.
     * @dev Updates ysCvg total supply too, can only be called by CvgRewards.
     */
    function updateCvgCycle() external {
        require(msg.sender == address(cvgRewards), "NOT_CVG_REWARDS");
        uint256 _newCycle = ++cvgCycle;

        lockingPositionService.updateYsTotalSupply();
        emit NewCycle(_newCycle);
    }
}
