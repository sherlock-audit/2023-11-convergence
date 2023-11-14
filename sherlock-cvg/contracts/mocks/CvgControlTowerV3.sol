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
import "../interfaces/ICvgControlTower.sol";

contract mock_CvgControlTowerV3 is Ownable2StepUpgradeable {
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
    address[] public allBaseBonds; /// All Base bond contracts
    mapping(address => address[]) public bondClones; /// Base bond => Clones linked to this version
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
                        NEW V2 STORAGE
    =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-= */
    uint256 public testStorageV2;
    mapping(address => bool) public testMapping;

    function testProxy() external view returns (uint256) {
        return 256;
    }

    function changeTestStorageV2(uint256 _amount) external {
        testStorageV2 = _amount;
    }

    function changeTestMapping(address _addr) external {
        testMapping[_addr] = true;
    }

    /* =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=
                        NEW V3 STORAGE
    =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-= */
    uint256 public testStorageV3;

    function incrementTestStorageV3() external {
        testStorageV3++;
    }

    /* =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=
                      CLONE FACTORY FUNCTIONS
  =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-= */

    function insertNewBond(address _newClone, uint256 _version) external {
        require(msg.sender == cloneFactory, "CLONE_FACTORY");
        bondClones[allBaseBonds[_version - 1]].push(_newClone);
        isBond[_newClone] = true;
    }

    function toggleStakingContract(address contractAddress) external onlyOwner {
        isStakingContract[contractAddress] = !isStakingContract[contractAddress];
    }

    /** @notice Insert a new sd/LP-asset staking contract, can only be called by the clone factory.
     *  @param _sdtStakingClone address of the new staking contract
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

    /// Pagination pattern in order to don't run out of gaz if an array is to big
    /// Chunk the original array
    /// @param _fullArray - full array address to be splitted
    /// @param _cursorStart    - index of the array to be the first item of the returned array
    /// @param _lengthDesired - max length of the returned array
    function _paginate(
        address[] memory _fullArray,
        uint256 _cursorStart,
        uint256 _lengthDesired
    ) internal pure returns (address[] memory) {
        /// @dev Prevent massive array retrieval
        require(_lengthDesired <= 20, "MAX_SIZE");

        uint256 _totalArrayLength = _fullArray.length;

        if (_cursorStart + _lengthDesired > _totalArrayLength) {
            _lengthDesired = _totalArrayLength - _cursorStart;
        }
        /// @dev Prevent to reach an index that doesn't exist in the array
        address[] memory array = new address[](_lengthDesired);
        for (uint256 i = _cursorStart; i < _cursorStart + _lengthDesired; ) {
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

    function getAllBaseBonds() public view returns (address[] memory) {
        return allBaseBonds;
    }

    function getBondLengthPerVersion(uint256 _baseBondVersion) public view returns (uint256) {
        return bondClones[allBaseBonds[_baseBondVersion - 1]].length;
    }

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

    /* =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=
                          SETTERS
  =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-= */
    function setOracle(ICvgOracle newCvgOracle) external onlyOwner {
        cvgOracle = newCvgOracle;
    }

    function setTreasuryBonds(address newTreasuryBondsMultisig) external onlyOwner {
        treasuryBonds = newTreasuryBondsMultisig;
    }

    function setBondCalculator(IBondCalculator newBondCalculator) external onlyOwner {
        bondCalculator = newBondCalculator;
    }

    function setTreasuryDao(address newTreasuryDao) external onlyOwner {
        treasuryDao = newTreasuryDao;
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

    /// Function allowing to update the Cvg Cycle.
    /// Can be called by anyone
    /// Can only be called :
    ///             - after the CVG inflation distribution in gauges
    ///             - after 7 days after the previous cycle update
    function updateCvgCycle() external {
        require(msg.sender == address(cvgRewards), "NOT_CVG_REWARDS");
        uint256 _newCycle = ++cvgCycle;

        lockingPositionService.updateYsTotalSupply();
        emit NewCycle(_newCycle);
    }
}
