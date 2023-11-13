import {deployControlTowerContract} from "./00_deployControlTower";
import {deployCvgTokenContract} from "./01_deployCvgToken";
import {deployOracleContract} from "./02_deployOracle";
import {deployBondCalculatorContract} from "./03_deployBondCalculator";
import {deployCloneFactoryContract} from "./04_deployCloneFactory";

import {deployBaseBondContract} from "./05_deployBaseBond";
import {deployVeCVGContract} from "./07_deployVeCVG";
import {deployGaugeControllerContract} from "./08_deployGaugeController";
import {deployCvgRewardsContract} from "./13_deployCvgRewards";
import {deployYsDistributor} from "./13_deployYsDistributor";

import {deployCvgSdtTokenContract} from "./XX_deployCvgSdtTokenContract";
import {deployCvgAirdrop} from "./XX_deployCvgAirdrop";
import {deployProxyAdmin} from "./XX_deployProxyAdmin";
import {setStorageBalanceAssets} from "./XX_setStorageBalanceAssets";

import {deployCvgSdtBuffer} from "./XX_deployCvgSdtBuffer";
import {deployBaseSdtStaking} from "./XX_deployBaseSdtStaking";
import {deployUpgradeableBeacon} from "./XX_deployUpgradeableBeacon";
import {deployCvgSdtStakingContract} from "./XX_deployCvgSdtStaking";

import {deployPresaleSeed} from "./XX_deployPresaleSeed";
import {deployPresaleWl} from "./XX_deployPresaleWl";
import {deployVestingContract} from "./XX_deployVestingCvg";

import {deployLiquidityCvgSdt} from "./XX_deployLiquidityCvgSdt";
import {deployVveCvgCalculator} from "./XX_deployVveCvgCalculator";
import {deployLockingLogo} from "./XX_deployLockingLogo";

import {deployLockingPositionManagerContract} from "./06_deployLockingPositionManager";
import {deploySwapperFactory} from "./XX_deploySwapperFactory";
import {deployCvgUtilities} from "./XX_deployCvgUtilities";
import {deployMockCvgUtilities} from "./XX_deployMockCvgUtilities";
import {deployMockFeeDistributor} from "./XX_deployMockFeeDistributor";
import {deployBondPositionManagerContract} from "./XX_deployBondPositionManager";
import {deployBondLogo} from "./XX_deployBondLogo";
import {deployIbo} from "./XX_deployIbo";
import {linkFeeDistributorAndVeSdt} from "./XX_linkFeeDistributorAndVeSdt";
import {deployCloneSdtStaking} from "./XX_deployCloneSdtStaking";
import {deployMockPositionLocker} from "./XX_deployMockPositionLocker";
import {deploySdtStakingPositionManager} from "./XX_deploySdtStakingPositionManager";
import {deploySdtStakingViewer} from "./XX_deploySdtStakingViewer";

import {fetchStakeDaoTokens} from "./fetchStakeDaoTokens";
import {deployInternalDaoContract} from "./XX_deployInternalDao";
import {deployProtoDaoContract} from "./XX_deployProtoDao";
import {deploySdtBlackHole} from "./XX_deploySdtBlackHole";

import {deploySdtFeeCollector} from "./XX_deploySdtFeeCollector";
import {deploySdtUtilities} from "./deploySdtUtilities";
import {deploySdtStakingLogo} from "./XX_deploySdtStakingLogo";
import {deploySdtRewardReceiver} from "./deploySdtRewardReceiver";

export default {
    deployControlTowerContract,
    deployCvgTokenContract,
    deployOracleContract,
    deployBondCalculatorContract,
    deployCloneFactoryContract,
    deployBaseBondContract,
    deployVeCVGContract,
    deployGaugeControllerContract,
    deployCvgRewardsContract,
    deployYsDistributor,
    deployCvgSdtTokenContract,
    deployCvgAirdrop,
    deployProxyAdmin,
    setStorageBalanceAssets,
    deployBaseSdtStaking,
    deployCvgSdtBuffer,
    deployCvgSdtStakingContract,
    deployPresaleSeed,
    deployPresaleWl,
    deployVestingContract,
    deployLiquidityCvgSdt,
    deployVveCvgCalculator,
    deployLockingLogo,
    deployLockingPositionManagerContract,
    deploySwapperFactory,
    deployCvgUtilities,
    deployBondPositionManagerContract,
    deployBondLogo,
    deployIbo,
    linkFeeDistributorAndVeSdt,
    deployCloneSdtStaking,
    deployMockPositionLocker,
    fetchStakeDaoTokens,
    deployProtoDaoContract,
    deployInternalDaoContract,
    deploySdtBlackHole,
    deployUpgradeableBeacon,
    deploySdtFeeCollector,
    deploySdtUtilities,
    deploySdtStakingPositionManager,
    deploySdtStakingViewer,
    deploySdtStakingLogo,
    deployMockCvgUtilities,
    deployMockFeeDistributor,
    deploySdtRewardReceiver,
};
