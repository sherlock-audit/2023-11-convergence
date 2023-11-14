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
import "./interfaces/ICvgControlTower.sol";
import "./interfaces/IOracleStruct.sol";
import "./Upgradeable/Beacon/BeaconProxy.sol";

/// @title Cvg-Finance - CloneFactory
/// @notice Convergence's factory to deploy clone of contracts
contract CloneFactory is Ownable2StepUpgradeable {
    struct WithdrawCallInfo {
        address addr;
        bytes signature;
    }

    /// @dev Convergence ecosystem address.
    ICvgControlTower public cvgControlTower;

    /// @dev Beacon contract storing the staking implementation contract.
    address public beaconSdStaking;

    /// @dev Beacon contract storing the buffer implementation contract.
    address public beaconBuffer;

    /// @dev Withdraw signature info.
    WithdrawCallInfo private withdrawCallInfo;

    event BondCreated(address base, address clone, IBondStruct.BondParams bondParams);
    event SdtStakingCreated(address stakingClone, address gaugeAsset, address bufferClone);

    /* =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=
                            CONSTRUCTOR
    =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-= */

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(ICvgControlTower _cvgControlTower) external initializer {
        cvgControlTower = _cvgControlTower;
        _transferOwnership(msg.sender);
    }

    /* =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=
                            EXTERNALS
    =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-= */

    /**
     *  @notice Create a bond through the minimal proxy implementation.
     *  @param _bondParams - global bond parameters
     *  @param _version - version of the base bond to clone
     */
    function createBond(IBondStruct.BondParams calldata _bondParams, uint256 _version) external onlyOwner {
        ICvgControlTower _cvgControlTower = cvgControlTower;
        address baseImplementation = _cvgControlTower.allBaseBonds(_version - 1);
        address newClone = _clone(baseImplementation);

        IBondDepository(newClone).initialize(_cvgControlTower, _bondParams);
        _cvgControlTower.insertNewBond(newClone, _version);
        emit BondCreated(baseImplementation, newClone, _bondParams);
    }

    /**
     * @notice Create a sdtStaking contract and its associated buffer contract through the beacon proxy implementation.
     * @dev This is linking the newly created SdtBuffer to the associated SdtStakingService.
     * @dev The SdtBuffer is then set as the receiver of the rewards from the StakeDao gauge.
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

    /* =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=
                            INTERNALS
    =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-= */

    /**
     * @dev Deploys and returns the address of a clone that mimics the behaviour of `implementation`.
     * @param baseImplementation Implementation of the contract to be cloned
     * This function uses the create opcode, which should never revert.
     */
    function _clone(address baseImplementation) internal returns (address instance) {
        // solhint-disable-next-line no-inline-assembly
        assembly {
            let ptr := mload(0x40)
            mstore(ptr, 0x3d602d80600a3d3981f3363d3d373d3d3d363d73000000000000000000000000)
            mstore(add(ptr, 0x14), shl(0x60, baseImplementation))
            mstore(add(ptr, 0x28), 0x5af43d82803e903d91602b57fd5bf30000000000000000000000000000000000)
            instance := create(0, ptr, 0x37)
        }
        require(instance != address(0), "ERC1167: create failed");
    }
}
