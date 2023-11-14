import {deployBase} from "./testContext";
import deployers from "../../scripts/deployer/unit/_index";
import {linkCvgPepe} from "../../scripts/linkers/cvgPepe";
import {FakeLiquidityDeployer} from "../../utils/FakeLiquidityDeployer";
import {time} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import {IContractsUser} from "../../utils/contractInterface";
import {bedTestSdtStaking} from "../Beds/bedTest-sdt-staking";

export async function deployBondCalculatorFixture() {
    let contractsUsers = await deployBase(false);
    contractsUsers = await deployers.deployBondCalculatorContract(contractsUsers, false);
    return contractsUsers;
}

export async function deployBondFixture() {
    let contractsUsers = await deployBase(false);
    const cvgControlTower = contractsUsers.contracts.base.cvgControlTower;
    await (await cvgControlTower.connect(contractsUsers.users.treasuryDao).setSdt(contractsUsers.contracts.tokens.sdt)).wait();
    contractsUsers = await deployers.deployCvgSdtTokenContract(contractsUsers);
    contractsUsers = await deployers.deployLiquidityCvgSdt(contractsUsers, false);
    contractsUsers = await FakeLiquidityDeployer.deployCvgFraxBpLiquidity(contractsUsers);
    contractsUsers = await deployers.deployBondPositionManagerContract(contractsUsers);
    contractsUsers = await deployers.deployOracleContract(contractsUsers, false);
    contractsUsers = await deployers.deployBondCalculatorContract(contractsUsers, false);

    contractsUsers = await deployers.deployBaseBondContract(contractsUsers);
    contractsUsers = await deployers.deployBondLogo(contractsUsers);
    contractsUsers = await deployers.deployLockingPositionManagerContract(contractsUsers);
    contractsUsers = await deployers.deployYsDistributor(contractsUsers);
    contractsUsers = await deployers.deploySwapperFactory(contractsUsers);
    contractsUsers = await deployers.deployCvgUtilities(contractsUsers);
    return contractsUsers;
}

export async function deployBondWithLockingFixture() {
    let contractsUsers = await deployBase(false);
    const cvgControlTower = contractsUsers.contracts.base.cvgControlTower;
    await (await cvgControlTower.connect(contractsUsers.users.treasuryDao).setSdt(contractsUsers.contracts.tokens.sdt)).wait();
    contractsUsers = await deployers.deployCvgSdtTokenContract(contractsUsers);
    contractsUsers = await deployers.deployLiquidityCvgSdt(contractsUsers, false);
    contractsUsers = await FakeLiquidityDeployer.deployCvgFraxBpLiquidity(contractsUsers);
    contractsUsers = await deployers.deployBondPositionManagerContract(contractsUsers);
    contractsUsers = await deployers.deployOracleContract(contractsUsers, false);
    contractsUsers = await deployers.deployBondCalculatorContract(contractsUsers, false);
    contractsUsers = await deployers.deployBaseBondContract(contractsUsers);
    contractsUsers = await deployers.deployBondLogo(contractsUsers);
    contractsUsers = await deployers.deployLockingPositionManagerContract(contractsUsers);
    contractsUsers = await deployers.deployYsDistributor(contractsUsers);
    contractsUsers = await deployers.deploySwapperFactory(contractsUsers);
    contractsUsers = await deployers.deployVeCVGContract(contractsUsers);
    contractsUsers = await deployers.deployGaugeControllerContract(contractsUsers);
    contractsUsers = await deployers.deployCvgRewardsContract(contractsUsers);
    contractsUsers = await deployers.deployCvgUtilities(contractsUsers);
    contractsUsers = await deployers.deployMockPositionLocker(contractsUsers);
    return contractsUsers;
}

export async function deployCloneFactoryFixture() {
    let contractsUsers = await deployBase(false);
    const cvgControlTower = contractsUsers.contracts.base.cvgControlTower;
    await (await cvgControlTower.connect(contractsUsers.users.treasuryDao).setSdt(contractsUsers.contracts.tokens.sdt)).wait();
    contractsUsers = await deployers.deployCvgSdtTokenContract(contractsUsers);
    contractsUsers = await deployers.linkFeeDistributorAndVeSdt(contractsUsers);
    contractsUsers = await deployers.deployCvgSdtBuffer(contractsUsers);
    contractsUsers = await deployers.deploySdtFeeCollector(contractsUsers);
    contractsUsers = await deployers.deploySdtBlackHole(contractsUsers);
    contractsUsers = await deployers.deploySdtStakingPositionManager(contractsUsers);
    contractsUsers = await deployers.deploySdtStakingViewer(contractsUsers);
    contractsUsers = await deployers.deployBaseSdtStaking(contractsUsers);
    contractsUsers = await deployers.deployUpgradeableBeacon(contractsUsers);

    return contractsUsers;
}

export async function deployRewardsFixture() {
    let contractsUsers = await deployBase(false);
    const cvgControlTower = contractsUsers.contracts.base.cvgControlTower;
    await (await cvgControlTower.connect(contractsUsers.users.treasuryDao).setSdt(contractsUsers.contracts.tokens.sdt)).wait();
    contractsUsers = await deployers.deployCvgSdtTokenContract(contractsUsers);
    contractsUsers = await deployers.deployLiquidityCvgSdt(contractsUsers, false);
    contractsUsers = await deployers.deployLockingPositionManagerContract(contractsUsers);
    contractsUsers = await deployers.deployVeCVGContract(contractsUsers);
    contractsUsers = await deployers.deployGaugeControllerContract(contractsUsers);
    contractsUsers = await deployers.deployCvgRewardsContract(contractsUsers);
    return contractsUsers;
}

export async function deployYsDistributorFixture() {
    let contractsUsers = await deployBase(false);
    const cvgControlTower = contractsUsers.contracts.base.cvgControlTower;
    await (await cvgControlTower.connect(contractsUsers.users.treasuryDao).setSdt(contractsUsers.contracts.tokens.sdt)).wait();
    contractsUsers = await deployers.deployCvgSdtTokenContract(contractsUsers);
    contractsUsers = await deployers.deployLiquidityCvgSdt(contractsUsers, false);

    contractsUsers = await deployers.deployLockingPositionManagerContract(contractsUsers);
    contractsUsers = await deployers.deployVeCVGContract(contractsUsers);
    contractsUsers = await deployers.deployGaugeControllerContract(contractsUsers);

    contractsUsers = await deployers.deployCvgRewardsContract(contractsUsers);
    contractsUsers = await deployers.deployCvgUtilities(contractsUsers);
    contractsUsers = await deployers.deployYsDistributor(contractsUsers);
    contractsUsers = await deployers.deployLockingLogo(contractsUsers);
    contractsUsers = await deployers.deploySwapperFactory(contractsUsers);
    contractsUsers = await deployers.deployMockPositionLocker(contractsUsers);
    contractsUsers = await FakeLiquidityDeployer.deployCvgFraxBpLiquidity(contractsUsers);
    contractsUsers = await deployers.deployOracleContract(contractsUsers, false);
    contractsUsers = await deployers.deployCvgAirdrop(contractsUsers);

    return contractsUsers;
}

export async function deployPresaleVestingFixture() {
    let contractsUsers = await deployBase(true);

    contractsUsers = await deployers.deployLockingPositionManagerContract(contractsUsers);
    contractsUsers = await deployers.deployVveCvgCalculator(contractsUsers);
    return contractsUsers;
}

export async function deployOracleFixture() {
    let contractsUsers = await deployBase(false);
    contractsUsers = await FakeLiquidityDeployer.deployCvgFraxBpLiquidity(contractsUsers);
    contractsUsers = await deployers.deployOracleContract(contractsUsers, false);

    return contractsUsers;
}

export async function deployIboFixture() {
    let contractsUsers = await deployBase(false);
    contractsUsers = await deployers.deployOracleContract(contractsUsers, true);
    contractsUsers = await deployers.deployBondCalculatorContract(contractsUsers, true);
    contractsUsers = await linkCvgPepe(contractsUsers);
    contractsUsers = await deployers.deployIbo(contractsUsers);
    return contractsUsers;
}

export async function deploySdtStakingFixture() {
    let contractsUsers = await deployBase(false);
    const cvgControlTower = contractsUsers.contracts.base.cvgControlTower;
    await (await cvgControlTower.connect(contractsUsers.users.treasuryDao).setSdt(contractsUsers.contracts.tokens.sdt)).wait();
    contractsUsers = await deployers.fetchStakeDaoTokens(contractsUsers);
    contractsUsers = await deployers.deployLockingPositionManagerContract(contractsUsers);
    contractsUsers = await deployers.deployVeCVGContract(contractsUsers);
    contractsUsers = await deployers.deployGaugeControllerContract(contractsUsers);
    contractsUsers = await deployers.deployYsDistributor(contractsUsers);
    contractsUsers = await deployers.deployLockingLogo(contractsUsers);
    contractsUsers = await deployers.deploySwapperFactory(contractsUsers);
    contractsUsers = await deployers.deployCvgRewardsContract(contractsUsers);
    contractsUsers = await deployers.deployCvgUtilities(contractsUsers);
    contractsUsers = await FakeLiquidityDeployer.deployCvgFraxBpLiquidity(contractsUsers);
    contractsUsers = await deployers.deployOracleContract(contractsUsers, false);
    contractsUsers = await deployers.deployCvgSdtTokenContract(contractsUsers);
    contractsUsers = await deployers.linkFeeDistributorAndVeSdt(contractsUsers);
    contractsUsers = await deployers.deployCvgSdtBuffer(contractsUsers);
    contractsUsers = await deployers.deploySdtFeeCollector(contractsUsers);
    contractsUsers = await deployers.deploySdtBlackHole(contractsUsers);
    contractsUsers = await deployers.deploySdtStakingPositionManager(contractsUsers);
    contractsUsers = await deployers.deployLiquidityCvgSdt(contractsUsers, true);

    contractsUsers = await deployers.deploySdtRewardReceiver(contractsUsers);
   
    contractsUsers = await deployers.deploySdtStakingViewer(contractsUsers);
    contractsUsers = await deployers.deployBaseSdtStaking(contractsUsers);
    contractsUsers = await deployers.deployUpgradeableBeacon(contractsUsers);
    contractsUsers = await deployers.deployCvgSdtStakingContract(contractsUsers);
    contractsUsers = await deployers.deployCloneSdtStaking(contractsUsers);
    contractsUsers = await deployers.deploySdtUtilities(contractsUsers);
    contractsUsers = await deployers.deploySdtStakingLogo(contractsUsers);

    contractsUsers = await deployers.deploySdtUtilities(contractsUsers);

    contractsUsers = await bedTestSdtStaking(contractsUsers);

    return contractsUsers;
}

export async function deployDaoFixture() {
    let contractsUsers = await deployBase(false);
    contractsUsers = await deployers.deployProtoDaoContract(contractsUsers);
    contractsUsers = await deployers.deployInternalDaoContract(contractsUsers);

    return contractsUsers;
}

export async function increaseCvgCycle({contracts, users}: IContractsUser, cycleAmount: number) {
    for (let i = 0; i < cycleAmount; i++) {
        await time.increase(7 * 86400);
        await (await contracts.rewards.cvgRewards.connect(users.treasuryDao).writeStakingRewards()).wait();
        await (await contracts.rewards.cvgRewards.connect(users.treasuryDao).writeStakingRewards()).wait();
        await (await contracts.rewards.cvgRewards.connect(users.treasuryDao).writeStakingRewards()).wait();
        await (await contracts.rewards.cvgRewards.connect(users.treasuryDao).writeStakingRewards()).wait();
    }
}

export async function increaseCvgCycleWithoutTime({contracts, users}: IContractsUser, cycleAmount: number) {
    for (let i = 0; i < cycleAmount; i++) {
        await (await contracts.rewards.cvgRewards.connect(users.treasuryDao).writeStakingRewards()).wait();
        await (await contracts.rewards.cvgRewards.connect(users.treasuryDao).writeStakingRewards()).wait();
        await (await contracts.rewards.cvgRewards.connect(users.treasuryDao).writeStakingRewards()).wait();
        await (await contracts.rewards.cvgRewards.connect(users.treasuryDao).writeStakingRewards()).wait();
    }
}
