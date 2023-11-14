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
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "../interfaces/IBondDepository.sol";
import "../interfaces/mock_ICvgControlTowerV2.sol";
import "../interfaces/IBondStruct.sol";
import "../interfaces/IOracleStruct.sol";
import "../interfaces/ISdtStakingPositionService.sol";
import "../interfaces/IBaseTest.sol";

import "../Upgradeable/Beacon/BeaconProxy.sol";

contract mock_CloneFactoryV2 is Ownable2StepUpgradeable {
    struct WithdrawCallInfo {
        address addr;
        bytes signature;
    }

    ICvgControlTowerV2 public cvgControlTower;
    address public beaconSdStaking;
    address public beaconBuffer;

    /// @dev withdraw signature info
    WithdrawCallInfo public withdrawCallInfo;

    event BondCreated(address base, address clone, IBondStruct.BondParams bondParams);
    event SdtStakingCreated(address stakingClone, address gaugeAsset, address bufferClone);
    event TestCreated(address base, address clone);

    /* =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=
                            CONSTRUCTOR
    =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-= */

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(ICvgControlTowerV2 _cvgControlTower) external initializer {
        cvgControlTower = _cvgControlTower;
        _transferOwnership(_cvgControlTower.treasuryDao());
    }

    /* =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=
                            EXTERNALS
    =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-= */

    /**
     *  @notice Create a bond through the minimal proxy implementation
     *  @param _bondParams    - global bond parameters
     *  @param _version       - version of the base bond to clone
     */
    function createBond(IBondStruct.BondParams calldata _bondParams, uint256 _version) external onlyOwner {
        ICvgControlTowerV2 _cvgControlTower = cvgControlTower;
        address baseImplementation = _cvgControlTower.allBaseBonds(_version - 1);
        address newClone = _clone(baseImplementation);

        IBondDepository(newClone).initialize(_cvgControlTower, _bondParams);
        _cvgControlTower.insertNewBond(newClone, _version);
        emit BondCreated(baseImplementation, newClone, _bondParams);
    }

    /**
     * @notice Create a sdAssetStaking and the associated buffer contract through the minimal proxy implementation
     * @param _sdAssetGauge - address of the sdAsset-gauge
     * @param _symbol - string ticker of the stakingAsset
     */
    function createSdtStakingAndBuffer(address _sdAssetGauge, string memory _symbol) external onlyOwner {
        ICvgControlTower _cvgControlTower = cvgControlTower;
        address _beaconSdStaking = beaconSdStaking;
        address _beaconBuffer = beaconBuffer;

        address beaconSdStakingProxy = address(
            new BeaconProxy(
                _beaconSdStaking,
                abi.encodeWithSignature(
                    "initialize(address,address,string,bool,(address,bytes))",
                    _cvgControlTower,
                    _sdAssetGauge,
                    _symbol,
                    true,
                    withdrawCallInfo
                )
            )
        );

        address beaconBufferProxy = address(
            new BeaconProxy(
                _beaconBuffer,
                abi.encodeWithSignature(
                    "initialize(address,address,address,address)",
                    _cvgControlTower,
                    beaconSdStakingProxy,
                    _sdAssetGauge,
                    cvgControlTower.sdt()
                )
            )
        );

        ISdtStakingPositionService(beaconSdStakingProxy).setBuffer(beaconBufferProxy);

        /// @dev setup the receiver of the rewards on the associated buffer
        _cvgControlTower.sdtBlackHole().setGaugeReceiver(_sdAssetGauge, beaconBufferProxy);

        /// @dev register the staking contract & the buffer in the CvgControlTower
        _cvgControlTower.insertNewSdtStaking(beaconSdStakingProxy);

        emit SdtStakingCreated(beaconSdStakingProxy, _sdAssetGauge, beaconBufferProxy);
    }

    function setBeaconSdStaking(address _beaconSdStaking) external onlyOwner {
        beaconSdStaking = _beaconSdStaking;
    }

    function setBeaconBuffer(address _beaconBuffer) external onlyOwner {
        beaconBuffer = _beaconBuffer;
    }

    /// @notice set withdrawCallInfo
    function setWithdrawCallInfo(WithdrawCallInfo calldata _withdrawCallInfo) external onlyOwner {
        withdrawCallInfo = _withdrawCallInfo;
    }

    /**
     * @notice
     * @param _baseImplementation
     */
    function createBaseTest(address _baseImplementation) external onlyOwner {
        address newClone = _clone(_baseImplementation);

        IBaseTest(newClone).initialize(cvgControlTower);
        emit TestCreated(_baseImplementation, newClone);
    }

    function changeMapping() external onlyOwner {
        cvgControlTower.changeTestMapping(address(this));
    }

    /* =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=
                            INTERNALS
    =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-= */

    /**
     * @dev Deploys and returns the address of a clone that mimics the behaviour of `implementation`.
     *
     * This function uses the create opcode, which should never revert.
     */
    function _clone(address newImplementation) internal returns (address instance) {
        // solhint-disable-next-line no-inline-assembly
        assembly {
            let ptr := mload(0x40)
            mstore(ptr, 0x3d602d80600a3d3981f3363d3d373d3d3d363d73000000000000000000000000)
            mstore(add(ptr, 0x14), shl(0x60, newImplementation))
            mstore(add(ptr, 0x28), 0x5af43d82803e903d91602b57fd5bf30000000000000000000000000000000000)
            instance := create(0, ptr, 0x37)
        }
        require(instance != address(0), "ERC1167: create failed");
    }
}
