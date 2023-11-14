import chai from "chai";
import chaiAsPromised from "chai-as-promised";
chai.use(chaiAsPromised).should();
const expect = chai.expect;
import {
    BondDepository,
    BondPositionManager,
    CloneFactory,
    CvgControlTower,
    CvgRewards,
    CvgSdtBuffer,
    LockingPositionManager,
    LockingPositionService,
    MockFeeDistributor,
    ProxyAdmin,
    SdtBlackHole,
    SdtRewardReceiver,
    SdtStakingPositionManager,
    SdtStakingPositionService,
    YsDistributor,
} from "../../../typechain-types";
import {Signer, ZeroAddress} from "ethers";
import {ethers} from "hardhat";
import {deployProxy} from "../../../utils/global/deployProxy";
import {TRANSFER_ERC20} from "../../../resources/signatures";
import {deployOnlyControlTower} from "../../fixtures/testContext";
import {deployMockFeeDistributor} from "../../../scripts/deployer/unit/XX_deployMockFeeDistributor";
import {IContractsUser} from "../../../utils/contractInterface";
const slippage = 10;

describe("Coverage Initialize", () => {
    let cvgControlTower: CvgControlTower, proxyAdmin: ProxyAdmin, mockFeeDistributor: MockFeeDistributor, cloneFactory: CloneFactory;
    let user1: Signer, user10: Signer, user11: Signer, treasuryDao: Signer;
    let contractsUsers: IContractsUser;

    before(async () => {
        contractsUsers = await deployOnlyControlTower();
        contractsUsers = await deployMockFeeDistributor(contractsUsers);
        const contracts = contractsUsers.contracts;
        const users = contractsUsers.users;
        proxyAdmin = contracts.base.proxyAdmin;
        cvgControlTower = contracts.base.cvgControlTower;
        cloneFactory = contracts.base.cloneFactory;
        mockFeeDistributor = contracts.tests.mockFeeDistributor;
        user1 = users.user1;
        user10 = users.user10;
        user11 = users.user11;
        treasuryDao = users.treasuryDao;
        //unset addresses on controlTower
        await cvgControlTower.connect(treasuryDao).setTreasuryBonds(ZeroAddress);
        await cvgControlTower.connect(treasuryDao).setVeSdtMultisig(ZeroAddress);
        await cvgControlTower.connect(treasuryDao).setTreasuryDao(ZeroAddress);
        await cvgControlTower.connect(treasuryDao).setTreasuryAirdrop(ZeroAddress);
        await cvgControlTower.connect(treasuryDao).setTreasuryCore(ZeroAddress);
    });
    it("Fail: initialize cvgControlTower", async () => {
        await cvgControlTower.initialize(user1, user1, user1, user1, user1).should.be.revertedWith("Initializable: contract is already initialized");
    });
    it("Deploy cvgControlTower should revert", async () => {
        const sigParams = "address,address,address,address,address";
        await deployProxy<CvgControlTower>(
            sigParams,
            [ZeroAddress, await user1.getAddress(), await user1.getAddress(), await user1.getAddress(), await user1.getAddress()],
            "CvgControlTower",
            proxyAdmin
        ).should.be.revertedWith("TREASURY_BOND_ZERO");
        await deployProxy<CvgControlTower>(
            sigParams,
            [await user1.getAddress(), ZeroAddress, await user1.getAddress(), await user1.getAddress(), await user1.getAddress()],
            "CvgControlTower",
            proxyAdmin
        ).should.be.revertedWith("VESDT_MULTISIG_ZERO");
        await deployProxy<CvgControlTower>(
            sigParams,
            [await user1.getAddress(), await user1.getAddress(), ZeroAddress, await user1.getAddress(), await user1.getAddress()],
            "CvgControlTower",
            proxyAdmin
        ).should.be.revertedWith("TREASURY_DAO_ZERO");
        await deployProxy<CvgControlTower>(
            sigParams,
            [await user1.getAddress(), await user1.getAddress(), await user1.getAddress(), ZeroAddress, await user1.getAddress()],
            "CvgControlTower",
            proxyAdmin
        ).should.be.revertedWith("TREASURY_AIRDROP_ZERO");
        await deployProxy<CvgControlTower>(
            sigParams,
            [await user1.getAddress(), await user1.getAddress(), await user1.getAddress(), await user1.getAddress(), ZeroAddress],
            "CvgControlTower",
            proxyAdmin
        ).should.be.revertedWith("TREASURY_CORE_ZERO");
    });
    it("Deploy LockingPositionManager should revert", async () => {
        const sigParams = "address";
        const params = [await cvgControlTower.getAddress()];
        await deployProxy<LockingPositionManager>(sigParams, params, "LockingPositionManager", proxyAdmin).should.be.revertedWith("TREASURY_DAO_ZERO");
    });
    it("Deploy LockingPositionService should revert", async () => {
        const sigParams = "address";
        const params = [await cvgControlTower.getAddress()];
        await deployProxy<LockingPositionService>(sigParams, params, "LockingPositionService", proxyAdmin).should.be.revertedWith("CVG_ZERO");
    });
    it("Deploy SdtFeeCollector should revert", async () => {
        const SdtFeeCollectorFactory = await ethers.getContractFactory("SdtFeeCollector");
        await SdtFeeCollectorFactory.deploy(cvgControlTower).should.be.revertedWith("SDT_ZERO");
        await cvgControlTower.connect(treasuryDao).setSdt(user1);
        await SdtFeeCollectorFactory.deploy(cvgControlTower).should.be.revertedWith("CVGSDT_DISTRIBUTOR_ZERO");
        await cvgControlTower.connect(treasuryDao).setCvgSdtBuffer(user1);
        await SdtFeeCollectorFactory.deploy(cvgControlTower).should.be.revertedWith("TRESO_BONDS_ZERO");
        await cvgControlTower.connect(treasuryDao).setTreasuryBonds(user1);
        await SdtFeeCollectorFactory.deploy(cvgControlTower).should.be.revertedWith("TRESO_DAO_ZERO");
        //unset
        await cvgControlTower.connect(treasuryDao).setSdt(ZeroAddress);
        await cvgControlTower.connect(treasuryDao).setCvgSdtBuffer(ZeroAddress);
        await cvgControlTower.connect(treasuryDao).setTreasuryBonds(ZeroAddress);
    });

    it("Deploy StakingPositionManager should revert", async () => {
        const sigParams = "address";
        const params = [await cvgControlTower.getAddress()];
        await deployProxy<SdtStakingPositionManager>(sigParams, params, "SdtStakingPositionManager", proxyAdmin).should.be.revertedWith("TREASURY_DAO_ZERO");
    });
    it("Deploy CvgSdtStaking should revert", async () => {
        const sigParams = "address,address,string,bool,(address,bytes)";
        let params = [await cvgControlTower.getAddress(), ZeroAddress, "STK-cvgSDT", false, [ZeroAddress, TRANSFER_ERC20]];
        await deployProxy<SdtStakingPositionService>(sigParams, params, "SdtStakingPositionService", proxyAdmin).should.be.revertedWith("STAKING_ASSET_ZERO");
        params = [await cvgControlTower.getAddress(), await user1.getAddress(), "STK-cvgSDT", false, [ZeroAddress, TRANSFER_ERC20]];
        await deployProxy<SdtStakingPositionService>(sigParams, params, "SdtStakingPositionService", proxyAdmin).should.be.revertedWith(
            "CVGSDT_DISTRIBUTOR_ZERO"
        );
        params = [await cvgControlTower.getAddress(), await user1.getAddress(), "STK-cvgSDT", true, [ZeroAddress, TRANSFER_ERC20]];
        await deployProxy<SdtStakingPositionService>(sigParams, params, "SdtStakingPositionService", proxyAdmin).should.be.revertedWith("SDT_BLACKHOLE_ZERO");
        await cvgControlTower.connect(treasuryDao).setSdtBlackHole(user1);

        await cvgControlTower.connect(treasuryDao).setCvgSdt(user1);
        params = [await cvgControlTower.getAddress(), await user1.getAddress(), "STK-cvgSDT", true, [ZeroAddress, TRANSFER_ERC20]];
        await deployProxy<SdtStakingPositionService>(sigParams, params, "SdtStakingPositionService", proxyAdmin).should.be.revertedWith("CVG_ZERO");
        await cvgControlTower.connect(treasuryDao).setCvg(user1);

        params = [await cvgControlTower.getAddress(), await user1.getAddress(), "STK-cvgSDT", true, [ZeroAddress, TRANSFER_ERC20]];
        await deployProxy<SdtStakingPositionService>(sigParams, params, "SdtStakingPositionService", proxyAdmin).should.be.revertedWith(
            "SDT_REWARD_RECEIVER_ZERO"
        );
        await cvgControlTower.connect(treasuryDao).setSdtRewardReceiver(treasuryDao);

        params = [await cvgControlTower.getAddress(), await user1.getAddress(), "STK-cvgSDT", true, [ZeroAddress, TRANSFER_ERC20]];
        await deployProxy<SdtStakingPositionService>(sigParams, params, "SdtStakingPositionService", proxyAdmin).should.be.revertedWith(
            "SDT_STAKING_MANAGER_ZERO"
        );
        await cvgControlTower.connect(treasuryDao).setSdtStakingPositionManager(treasuryDao);

        params = [await cvgControlTower.getAddress(), await user1.getAddress(), "STK-cvgSDT", true, [ZeroAddress, TRANSFER_ERC20]];
        await deployProxy<SdtStakingPositionService>(sigParams, params, "SdtStakingPositionService", proxyAdmin).should.be.revertedWith("TREASURY_DAO_ZERO");
        //unset
        await cvgControlTower.connect(treasuryDao).setSdtBlackHole(ZeroAddress);
        await cvgControlTower.connect(treasuryDao).setCvgSdt(ZeroAddress);
        await cvgControlTower.connect(treasuryDao).setCvg(ZeroAddress);
        await cvgControlTower.connect(treasuryDao).setSdt(ZeroAddress);
    });
    it("Deploy SdtStakingLogo should revert", async () => {
        const SdtStakingLogoFactory = await ethers.getContractFactory("SdtStakingLogo");
        await SdtStakingLogoFactory.deploy(cvgControlTower).should.be.revertedWith("SDT_ZERO");
        await cvgControlTower.connect(treasuryDao).setSdt(user1);
        await SdtStakingLogoFactory.deploy(cvgControlTower).should.be.revertedWith("TREASURY_DAO_ZERO");
        //unset
        await cvgControlTower.connect(treasuryDao).setSdt(ZeroAddress);
    });
    it("Deploy CvgRewards should revert", async () => {
        const sigParams = "address";
        const params = [await cvgControlTower.getAddress()];
        await deployProxy<CvgRewards>(sigParams, params, "CvgRewards", proxyAdmin).should.be.revertedWith("TREASURY_DAO_ZERO");
    });
    it("Deploy YsDistributor should revert", async () => {
        const sigParams = "address";
        const params = [await cvgControlTower.getAddress()];

        await deployProxy<YsDistributor>(sigParams, params, "YsDistributor", proxyAdmin).should.be.revertedWith("LOCKING_SERVICE_ZERO");
        await cvgControlTower.connect(treasuryDao).setLockingPositionService(user1);
        await deployProxy<YsDistributor>(sigParams, params, "YsDistributor", proxyAdmin).should.be.revertedWith("LOCKING_MANAGER_ZERO");
        await cvgControlTower.connect(treasuryDao).setLockingPositionManager(user1);
        await deployProxy<YsDistributor>(sigParams, params, "YsDistributor", proxyAdmin).should.be.revertedWith("LOCKING_DELEGATE_ZERO");
        //unset
        await cvgControlTower.connect(treasuryDao).setCvg(ZeroAddress);
        await cvgControlTower.connect(treasuryDao).setLockingPositionService(ZeroAddress);
        await cvgControlTower.connect(treasuryDao).setLockingPositionManager(ZeroAddress);
    });
    it("Deploy CvgSdtBuffer should revert", async () => {
        const sigParams = "address,address";
        const params = [await cvgControlTower.getAddress(), await mockFeeDistributor.getAddress()];
        await deployProxy<CvgSdtBuffer>(sigParams, params, "CvgSdtBuffer", proxyAdmin).should.be.revertedWith("SDT_ZERO");
        await cvgControlTower.connect(treasuryDao).setSdt(user1);
        await deployProxy<CvgSdtBuffer>(sigParams, params, "CvgSdtBuffer", proxyAdmin).should.be.revertedWith("CVGSDT_ZERO");
        await cvgControlTower.connect(treasuryDao).setCvgSdt(user1);
        await deployProxy<CvgSdtBuffer>(sigParams, params, "CvgSdtBuffer", proxyAdmin).should.be.revertedWith("SDFRAX3CRV_ZERO");
        //unset
        await cvgControlTower.connect(treasuryDao).setSdt(ZeroAddress);
        await cvgControlTower.connect(treasuryDao).setCvgSdt(ZeroAddress);
    });
    it("Deploy SdtBlackHole should revert", async () => {
        const sigParams = "address";
        const params = [await cvgControlTower.getAddress()];
        const sdtBlackHole = await deployProxy<SdtBlackHole>(sigParams, params, "SdtBlackHole", proxyAdmin).should.be.revertedWith("SDT_ZERO");
    });
    it("Deploy VveCvgCalculator should revert", async () => {
        const VveCvgCalculatorFactory = await ethers.getContractFactory("VveCvgCalculator");
        await VveCvgCalculatorFactory.deploy(cvgControlTower).should.be.revertedWith("LOCKING_ZERO");
        await cvgControlTower.connect(treasuryDao).setLockingPositionService(user1);
        await VveCvgCalculatorFactory.deploy(cvgControlTower).should.be.revertedWith("CVG_ZERO");
        await cvgControlTower.connect(treasuryDao).setCvg(user1);
        await VveCvgCalculatorFactory.deploy(cvgControlTower).should.be.revertedWith("VESTING_ZERO");
        await cvgControlTower.connect(treasuryDao).setVestingCvg(user1);
        await VveCvgCalculatorFactory.deploy(cvgControlTower).should.be.revertedWith("TREASURY_AIRDROP_ZERO");
        //unset
        await cvgControlTower.connect(treasuryDao).setLockingPositionService(ZeroAddress);
        await cvgControlTower.connect(treasuryDao).setCvg(ZeroAddress);
        await cvgControlTower.connect(treasuryDao).setVestingCvg(ZeroAddress);
    });
    it("Deploy CvgSdt should revert", async () => {
        const CvgSdtFactory = await ethers.getContractFactory("CvgSDT");
        await CvgSdtFactory.deploy(cvgControlTower).should.be.revertedWith("SDT_ZERO");
    });
    it("Deploy BondPositionManager should revert", async () => {
        const sigParams = "address";
        const params = [await cvgControlTower.getAddress()];
        await deployProxy<BondPositionManager>(sigParams, params, "BondPositionManager", proxyAdmin).should.be.revertedWith("TREASURY_DAO_ZERO");
    });
    it("Deploy CvgAirdrop should revert", async () => {
        const CvgAirdropFactory = await ethers.getContractFactory("CvgAirdrop");
        await CvgAirdropFactory.deploy(cvgControlTower).should.be.revertedWith("LOCKING_ZERO");
        await cvgControlTower.connect(treasuryDao).setLockingPositionService(user1);
        await CvgAirdropFactory.deploy(cvgControlTower).should.be.revertedWith("CVG_ZERO");
        await cvgControlTower.connect(treasuryDao).setCvg(user1);
        await CvgAirdropFactory.deploy(cvgControlTower).should.be.revertedWith("TREASURY_AIRDROP_ZERO");
        //unset
        await cvgControlTower.connect(treasuryDao).setLockingPositionService(ZeroAddress);
        await cvgControlTower.connect(treasuryDao).setCvg(ZeroAddress);
    });
    it("Deploy Clone BondDepository should revert", async () => {
        const BondDepositoryFactory = await ethers.getContractFactory("BondDepository");
        const bondDepository: BondDepository = await BondDepositoryFactory.deploy();
        await cvgControlTower.connect(treasuryDao).setNewVersionBaseBond(bondDepository);
        const params = {
            maxCvgToMint: 1000000n,
            minRoi: 5_000,
            maxRoi: 65_000,
            composedFunction: "0",
            vestingTerm: 432_000,
            token: await user1.getAddress(),
            percentageMaxCvgToMint: 200,
            bondDuration: 43_200,
            gamma: 250_000,
            scale: 5_000,
        };
        await cloneFactory.connect(treasuryDao).createBond(params, 1).should.be.revertedWith("CVG_ZERO");
        await cvgControlTower.connect(treasuryDao).setCvg(user1);
        await cloneFactory.connect(treasuryDao).createBond(params, 1).should.be.revertedWith("TREASURY_DAO_ZERO");
        //unset
        await cvgControlTower.connect(treasuryDao).setCvg(ZeroAddress);
    });
});
