import * as Contracts from "../typechain-types";
import {GaugeController} from "../typechain-types-vyper/GaugeController";

import {HardhatEthersSigner} from "@nomicfoundation/hardhat-ethers/signers";
import {VeCVG} from "../typechain-types-vyper/VeCVG";

export interface IContracts {
    base: {
        cvgControlTower: Contracts.CvgControlTower;
        cloneFactory: Contracts.CloneFactory;
        proxyAdmin: Contracts.ProxyAdmin;
        cvgUtilities: Contracts.CvgUtilities;
        swapperFactory: Contracts.SwapperFactory;
    };
    locking: {
        lockingPositionService: Contracts.LockingPositionService;
        lockingPositionManager: Contracts.LockingPositionManager;
        lockingPositionDelegate: Contracts.LockingPositionDelegate;
        lockingLogo: Contracts.LockingLogo;
        veCvg: Contracts.VeCVG;
        gaugeController: GaugeController;
        vveCVGCalculator: Contracts.VveCvgCalculator;
    };

    stakeDao: {
        baseSdAssetStaking: Contracts.SdtStakingPositionService;
        sdtBlackHole: Contracts.SdtBlackHole;
        baseSdtBuffer: Contracts.SdtBuffer;
        cvgSdtBuffer: Contracts.CvgSdtBuffer;
        sdtStakingViewer: Contracts.SdtStakingViewer;
        sdtStakingPositionManager: Contracts.SdtStakingPositionManager;
        cvgSdtStaking: Contracts.SdtStakingPositionService;
        feeDistributor: Contracts.IFeeDistributor;
        veSdt: Contracts.IVeSDT;
        multiMerkleStash: Contracts.IMultiMerkleStash;
        sdtFeeCollector: Contracts.SdtFeeCollector;
        sdtUtilities: Contracts.SdtUtilities;
        sdtStakingLogo: Contracts.SdtStakingLogo;
        sdtRewardReceiver: Contracts.SdtRewardReceiver;
        sdAssetsStaking: {
            sdCRVStaking: Contracts.SdtStakingPositionService;
            sdPENDLEStaking: Contracts.SdtStakingPositionService;
            sdBALStaking: Contracts.SdtStakingPositionService;
            sdFXSStaking: Contracts.SdtStakingPositionService;
            sdANGLEStaking: Contracts.SdtStakingPositionService;
            sdFXNStaking: Contracts.SdtStakingPositionService;
            sdTriCryptoStaking: Contracts.SdtStakingPositionService;
        };
        sdAssetsBuffer: {
            sdCRVBuffer: Contracts.SdtBuffer;
            sdPENDLEBuffer: Contracts.SdtBuffer;
            sdBALBuffer: Contracts.SdtBuffer;
            sdFXSBuffer: Contracts.SdtBuffer;
            sdANGLEBuffer: Contracts.SdtBuffer;
            sdFXNBuffer: Contracts.SdtBuffer;
            sdTriCryptoBuffer: Contracts.SdtBuffer;
        };
        upgradeableSdStakingBeacon: Contracts.UpgradeableBeacon;
        upgradeableBufferBeacon: Contracts.UpgradeableBeacon;
    };

    rewards: {
        cvgRewards: Contracts.CvgRewards;
        cvgSdtBuffer: Contracts.CvgSdtBuffer;
        ysDistributor: Contracts.YsDistributor;
    };

    bonds: {
        bondCalculator: Contracts.BondCalculator;
        cvgOracle: Contracts.CvgOracle;
        bondPositionManager: Contracts.BondPositionManager;
        bondLogo: Contracts.BondLogo;
        baseBond: Contracts.BondDepository;
    };

    presaleVesting: {
        ibo: Contracts.Ibo;
        sbt: Contracts.SBT;
        seedPresale: Contracts.SeedPresaleCvg;
        vestingCvg: Contracts.VestingCvg;
        wlPresaleCvg: Contracts.WlPresaleCvg;
        cvgAirdrop: Contracts.CvgAirdrop;
        wl: {
            S_wlAddresses: string[];
            M_wlAddresses: string[];
            L_wlAddresses: string[];
        };
    };

    tokens: {
        cvg: Contracts.Cvg;
        cvgSdt: Contracts.CvgSDT;
        frax: Contracts.ERC20;
        dai: Contracts.ERC20;
        usdc: Contracts.ERC20;
        usdt: Contracts.ERC20;
        sdt: Contracts.ERC20;
        crv: Contracts.ERC20;
        weth: Contracts.ERC20;
        cvx: Contracts.ERC20;
        cnc: Contracts.ERC20;
        fxs: Contracts.ERC20;
        fraxBp: Contracts.ERC20;
        _3crv: Contracts.ERC20;
    };
    tokensStakeDao: {
        sdFrax3Crv: Contracts.ERC20;
        sdCrv: Contracts.ISdAsset;
        sdBal: Contracts.ISdAsset;
        sdPendle: Contracts.ISdAsset;
        sdAngle: Contracts.ISdAsset;
        sdFxs: Contracts.ISdAsset;

        sdCrvGauge: Contracts.ISdAssetGauge;
        sdBalGauge: Contracts.ISdAssetGauge;
        sdPendleGauge: Contracts.ISdAssetGauge;
        sdAngleGauge: Contracts.ISdAssetGauge;
        sdFxsGauge: Contracts.ISdAssetGauge;

        bbAUsd: Contracts.ERC20;
        bal: Contracts.ERC20;

        sanUsdEur: Contracts.ERC20;
        agEur: Contracts.ERC20;
        angle: Contracts.ERC20;
        _80bal_20weth: Contracts.ERC20;

        crvCRVUSDTBTCWSTETH: Contracts.ERC20;
        crvCRVUSDTBTCWSTETHGauge: Contracts.ISdAssetGauge;
    };

    lp: {
        poolCvgFraxBp: Contracts.ICrvPool;
        stablePoolCvgSdt: Contracts.ICrvPoolPlain;
    };

    mainnetDeployed: {
        cvgPepe: Contracts.CvgPepe;
        presaleWl: Contracts.WlPresaleCvg;
        presaleSeed: Contracts.SeedPresaleCvg;
        ibo: Contracts.Ibo;
    };

    tests: {
        baseTest: Contracts.BaseTest;
        positionLocker: Contracts.PositionLocker;
        mockCvgUtilities: Contracts.MockCvgUtilities;
        mockFeeDistributor: Contracts.MockFeeDistributor;
    };

    dao: {
        protoDao: Contracts.ProtoDao;
        internalDao: Contracts.InternalDao;
    };
}

export interface IUsers {
    owner: HardhatEthersSigner;
    user1: HardhatEthersSigner;
    user2: HardhatEthersSigner;
    user3: HardhatEthersSigner;
    user4: HardhatEthersSigner;
    user5: HardhatEthersSigner;
    user6: HardhatEthersSigner;
    user7: HardhatEthersSigner;
    user8: HardhatEthersSigner;
    user9: HardhatEthersSigner;
    user10: HardhatEthersSigner;
    user11: HardhatEthersSigner;
    user12: HardhatEthersSigner;
    treasuryDao: HardhatEthersSigner;
    treasuryCore: HardhatEthersSigner;
    treasuryBonds: HardhatEthersSigner;
    treasuryAirdrop: HardhatEthersSigner;
    veSdtMultisig: HardhatEthersSigner;
    allUsers: HardhatEthersSigner[];
    classicWl: string[];
}

export interface IContractsUser {
    contracts: IContracts;
    users: IUsers;
}
