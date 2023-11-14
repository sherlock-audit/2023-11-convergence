import chai from "chai";
import chaiAsPromised from "chai-as-promised";
chai.use(chaiAsPromised).should();
const expect = chai.expect;
import {Signer} from "ethers";
import {ethers, upgrades} from "hardhat";
import {IContractsUser, IUsers} from "../../../utils/contractInterface";
import {
    Cvg,
    ISdAssetGauge,
    LockingPositionService,
    SdtBlackHole,
    SdtBuffer,
    SdtStakingPositionService,
    SdtStakingPositionServiceV2,
    UpgradeableBeacon,
} from "../../../typechain-types";
import {deploySdtStakingFixture, increaseCvgCycle} from "../../fixtures/fixtures";
import {loadFixture, mine} from "@nomicfoundation/hardhat-network-helpers";
import {GaugeController} from "../../../typechain-types-vyper";
import {CYCLE_1, CYCLE_2, CYCLE_3, TOKEN_4, TOKEN_5} from "../../../resources/constant";
import {getExpectedCvgSdtRewards} from "../../../utils/stakeDao/getStakingShareForCycle";
import {TypedDeferredTopicFilter, TypedContractEvent} from "../../../typechain-types/common";
import {ClaimCvgMultipleEvent, ClaimCvgSdtMultipleEvent} from "../../../typechain-types/contracts/poc/SdtStakingPositionServiceV2";

describe("Beacon SdAssetStaking tests", () => {
    let contractsUsers: IContractsUser, users: IUsers;
    let cvg: Cvg;
    let sdCRVStaking: SdtStakingPositionService, sdCrvGauge: ISdAssetGauge, sdCRVBuffer: SdtBuffer;
    let sdCRVStakingV2: SdtStakingPositionServiceV2;
    let sdANGLEStaking: SdtStakingPositionService;
    let sdANGLEStakingV2: SdtStakingPositionServiceV2;
    let owner: Signer, user1: Signer, user2: Signer, treasuryDao: Signer;
    let upgradeableSdStakingBeacon: UpgradeableBeacon;
    let sdtStakingPositionServiceV2Implementation: SdtStakingPositionServiceV2;
    let gaugeController: GaugeController, lockingPositionService: LockingPositionService;
    let sdtBlackHole: SdtBlackHole;
    let filterClaimCvg: TypedDeferredTopicFilter<
        TypedContractEvent<ClaimCvgMultipleEvent.InputTuple, ClaimCvgMultipleEvent.OutputTuple, ClaimCvgMultipleEvent.OutputObject>
    >;
    let filterClaimCvgSdt: TypedDeferredTopicFilter<
        TypedContractEvent<ClaimCvgSdtMultipleEvent.InputTuple, ClaimCvgSdtMultipleEvent.OutputTuple, ClaimCvgSdtMultipleEvent.OutputObject>
    >;
    before(async () => {
        contractsUsers = await loadFixture(deploySdtStakingFixture);
        const tokens = contractsUsers.contracts.tokens;
        const tokensStakeDao = contractsUsers.contracts.tokensStakeDao;

        users = contractsUsers.users;
        owner = users.owner;
        user1 = users.user1;
        user2 = users.user2;
        treasuryDao = users.treasuryDao;

        lockingPositionService = contractsUsers.contracts.locking.lockingPositionService;

        sdCRVStaking = contractsUsers.contracts.stakeDao.sdAssetsStaking.sdCRVStaking;
        gaugeController = contractsUsers.contracts.locking.gaugeController;
        sdtBlackHole = contractsUsers.contracts.stakeDao.sdtBlackHole;
        sdCrvGauge = tokensStakeDao.sdCrvGauge;
        sdCRVBuffer = contractsUsers.contracts.stakeDao.sdAssetsBuffer.sdCRVBuffer;
        cvg = tokens.cvg;

        sdANGLEStaking = contractsUsers.contracts.stakeDao.sdAssetsStaking.sdANGLEStaking;
        upgradeableSdStakingBeacon = contractsUsers.contracts.stakeDao.upgradeableSdStakingBeacon;

        // mint locking position and vote for cvgSdtStaking gauge
        await cvg.approve(lockingPositionService, ethers.parseEther("300000"));
        await lockingPositionService.mintPosition(47, ethers.parseEther("100000"), 0, owner, true);
        await gaugeController.simple_vote(5, sdCRVStaking, 1000);
        // approve weth spending from staking contract
        await sdCrvGauge.connect(user1).approve(sdCRVStaking, ethers.MaxUint256);
        await sdCrvGauge.connect(user2).approve(sdCRVStaking, ethers.MaxUint256);

        // deposit for user1 and user2
        await sdCRVStaking.connect(user1).deposit(0, ethers.parseEther("10"), ethers.ZeroAddress);
        await sdCRVStaking.connect(user2).deposit(0, ethers.parseEther("10"), ethers.ZeroAddress);

        filterClaimCvg = sdCRVStaking.filters.ClaimCvgMultiple(undefined, undefined);
        filterClaimCvgSdt = sdCRVStaking.filters.ClaimCvgSdtMultiple(undefined, undefined);
    });
    it("Deploy sdtStakingPositionService implementation V2", async () => {
        const interfaceV1 = await ethers.getContractFactory("SdtStakingPositionService");
        const interfaceV2 = await ethers.getContractFactory("SdtStakingPositionServiceV2");
        //check if v2 is upgradeable safe with v1
        await upgrades.validateUpgrade(interfaceV1, interfaceV2);
        //deploy v2 implementation
        sdtStakingPositionServiceV2Implementation = await ethers.deployContract("SdtStakingPositionServiceV2", []);
        await sdtStakingPositionServiceV2Implementation.waitForDeployment();
    });
    it("Success : Processing rewards & update cvg cycle to 2", async () => {
        await increaseCvgCycle(contractsUsers, 1);

        expect(await sdCRVStaking.stakingCycle()).to.be.equal(CYCLE_2);
        expect((await sdCRVStaking.cycleInfo(CYCLE_1)).cvgRewardsAmount).to.be.equal(0);
    });
    it("Success : Processing rewards & update cycle to 3", async () => {
        await increaseCvgCycle(contractsUsers, 1);

        expect(await sdCRVStaking.stakingCycle()).to.be.equal(CYCLE_3);
        expect((await sdCRVStaking.cycleInfo(CYCLE_2)).cvgRewardsAmount).to.be.equal("21990950226244343225533");
    });
    it("Upgrade to V2", async () => {
        await upgradeableSdStakingBeacon.connect(treasuryDao).upgradeTo(await sdtStakingPositionServiceV2Implementation.getAddress());
        //interface proxys
        sdCRVStakingV2 = await ethers.getContractAt("SdtStakingPositionServiceV2", await sdCRVStaking.getAddress());
        sdANGLEStakingV2 = await ethers.getContractAt("SdtStakingPositionServiceV2", await sdANGLEStaking.getAddress());
    });
    it("Test V2 function", async () => {
        await sdCRVStakingV2.newValue();
        await sdANGLEStakingV2.newValue();
        expect(await sdCRVStakingV2.stakingCycle()).to.be.equal(CYCLE_3);
        expect((await sdCRVStakingV2.cycleInfo(CYCLE_2)).cvgRewardsAmount).to.be.equal("21990950226244343225533");
    });

    it("Success : Claiming Cvg  cycle 2 for user 1 ", async () => {
        const amountCvgClaimedExpected = await getExpectedCvgSdtRewards(sdCRVStakingV2, TOKEN_4, CYCLE_2);
        const cvgAmountExpected = amountCvgClaimedExpected[0];

        const claimCvgTx = sdCRVStakingV2.connect(user1).claimCvgRewards(TOKEN_4);
        await expect(claimCvgTx).to.changeTokenBalances(cvg, [user1], [cvgAmountExpected]);

        const events = await sdCRVStakingV2.queryFilter(filterClaimCvg, -1, "latest");
        const event = events[0].args;

        const expectedEvent = [TOKEN_4, await user1.getAddress()];
        expect(event).to.be.deep.eq(expectedEvent);
    });
    it("Success : Claiming Cvg cycle 2 for user 2 ", async () => {
        await mine(1);
        const amountCvgClaimedExpected = await getExpectedCvgSdtRewards(sdCRVStakingV2, TOKEN_5, CYCLE_2);
        const cvgAmountExpected = amountCvgClaimedExpected[0];

        const claimCvgTx = sdCRVStakingV2.connect(user2).claimCvgRewards(TOKEN_5);
        await expect(claimCvgTx).to.changeTokenBalances(cvg, [user2], [cvgAmountExpected]);

        const events = await sdCRVStakingV2.queryFilter(filterClaimCvg, -1, "latest");
        const event = events[0].args;

        const expectedEvent = [TOKEN_5, await user2.getAddress()];
        expect(event).to.be.deep.eq(expectedEvent);
    });
});
