import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {ethers} from "hardhat";
import {Signer} from "ethers";
import {expect} from "chai";
import {Cvg} from "../../../../../typechain-types/contracts/Token";
import {deploySdtStakingFixture, increaseCvgCycle} from "../../../../fixtures/fixtures";
import {LockingPositionService} from "../../../../../typechain-types/contracts/Locking";
import {IContractsUser, IUsers} from "../../../../../utils/contractInterface";
import {GaugeController} from "../../../../../typechain-types-vyper/GaugeController";
import {ISdAssetGauge, SdtBlackHole, SdtBuffer, SdtStakingPositionService} from "../../../../../typechain-types";
import {CYCLE_2, CYCLE_3, CYCLE_4, CYCLE_5, TOKEN_1, TOKEN_4, TOKEN_5} from "../../../../../resources/constant";
import {mine} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import {getExpectedCvgSdtRewards} from "../../../../../utils/stakeDao/getStakingShareForCycle";

describe("sdAssetStaking - Claim Cvg Rewards", () => {
    let contractsUsers: IContractsUser, users: IUsers;
    let owner: Signer, user1: Signer, user2: Signer;
    let gaugeController: GaugeController, lockingPositionService: LockingPositionService;
    let cvg: Cvg;
    let sdCRVStaking: SdtStakingPositionService, sdCrvGauge: ISdAssetGauge, sdCRVBuffer: SdtBuffer;
    let sdtBlackHole: SdtBlackHole;

    before(async () => {
        contractsUsers = await loadFixture(deploySdtStakingFixture);
        const tokens = contractsUsers.contracts.tokens;
        const tokensStakeDao = contractsUsers.contracts.tokensStakeDao;

        users = contractsUsers.users;
        owner = users.owner;
        user1 = users.user1;
        user2 = users.user2;
        lockingPositionService = contractsUsers.contracts.locking.lockingPositionService;

        sdCRVStaking = contractsUsers.contracts.stakeDao.sdAssetsStaking.sdCRVStaking;
        gaugeController = contractsUsers.contracts.locking.gaugeController;
        sdtBlackHole = contractsUsers.contracts.stakeDao.sdtBlackHole;
        sdCrvGauge = tokensStakeDao.sdCrvGauge;
        sdCRVBuffer = contractsUsers.contracts.stakeDao.sdAssetsBuffer.sdCRVBuffer;
        cvg = tokens.cvg;

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
    });

    it("Fail: initialize sdCRVBuffer", async () => {
        await sdCRVBuffer.initialize(user1, user1, user1, user1).should.be.revertedWith("Initializable: contract is already initialized");
    });

    it("Fail: initialize sdCRVBuffer", async () => {
        await sdCRVBuffer.pullRewards(owner).should.be.revertedWith("ONLY_STAKING");
    });

    it("Fail: initialize ysDistributor", async () => {
        await sdtBlackHole.initialize(user1).should.be.revertedWith("Initializable: contract is already initialized");
    });
    it("Fail: pullSdStakingBribes with random user", async () => {
        await sdtBlackHole.pullSdStakingBribes(owner, 0).should.be.revertedWith("NOT_A_BUFFER");
    });
    it("Fail: setGaugeReceiver with random user", async () => {
        await sdtBlackHole.setGaugeReceiver(user1, user2).should.be.revertedWith("NOT_CLONE_FACTORY");
    });

    it("Fails : Claiming Cvg too early (at cycle N 1)", async () => {
        await sdCRVStaking.connect(user1).claimCvgRewards(TOKEN_1).should.be.revertedWith("ALL_CVG_CLAIMED_FOR_NOW");
    });

    it("Success : Go to cycle 2 !", async () => {
        await increaseCvgCycle(contractsUsers, 1);

        expect(await sdCRVStaking.stakingCycle()).to.be.equal(2);
        expect((await sdCRVStaking.cycleInfo(1)).cvgRewardsAmount).to.be.equal(0);
    });

    it("Fails : Processing stakers rewards CVG not CvgRewards", async () => {
        await sdCRVStaking.processStakersRewards(1).should.be.revertedWith("NOT_CVG_REWARDS");
    });

    it("Sucess : Withdrawing user2 at cycle 3", async () => {
        await sdCRVStaking.connect(user2).withdraw(5, ethers.parseEther("8"));
    });

    it("Fails : Claiming Cvg Rewards for current cycle", async () => {
        await sdCRVStaking.connect(user1).claimCvgRewards(TOKEN_4).should.be.revertedWith("ALL_CVG_CLAIMED_FOR_NOW");
        await sdCRVStaking.connect(user2).claimCvgRewards(TOKEN_5).should.be.revertedWith("ALL_CVG_CLAIMED_FOR_NOW");
    });

    it("Success : Go to cycle 3 !", async () => {
        await increaseCvgCycle(contractsUsers, 1);

        expect(await sdCRVStaking.stakingCycle()).to.be.equal(CYCLE_3);
        expect((await sdCRVStaking.cycleInfo(CYCLE_2)).cvgRewardsAmount).to.be.equal("21990950226244343225533");
    });

    it("Success : Depositing with user2 at cycle 3", async () => {
        await sdCRVStaking.connect(user2).deposit(TOKEN_5, ethers.parseEther("6"), ethers.ZeroAddress);
    });

    it("Fails : Claiming Cvg cycle 2 with wrong owner", async () => {
        await sdCRVStaking.connect(user2).claimCvgRewards(TOKEN_1).should.be.revertedWith("TOKEN_NOT_OWNED");
    });

    it("Success : Claiming Cvg cycle 2 for user 1 ", async () => {
        const amountCvgClaimedExpected = await getExpectedCvgSdtRewards(sdCRVStaking, TOKEN_4, CYCLE_2);
        const cvgAmountExpected = amountCvgClaimedExpected[0];

        const claimCvgTx = sdCRVStaking.connect(user1).claimCvgRewards(TOKEN_4);
        await expect(claimCvgTx).to.changeTokenBalances(cvg, [user1], [cvgAmountExpected]);
    });

    it("Success : Claiming Cvg cycle 2 for user 2 ", async () => {
        await mine(1);
        const amountCvgClaimedExpected = await getExpectedCvgSdtRewards(sdCRVStaking, TOKEN_5, CYCLE_2);
        const cvgAmountExpected = amountCvgClaimedExpected[0];

        const claimCvgTx = sdCRVStaking.connect(user2).claimCvgRewards(TOKEN_5);
        await expect(claimCvgTx).to.changeTokenBalances(cvg, [user2], [cvgAmountExpected]);
    });

    it("Fails : Try to reclaim Cvg", async () => {
        await sdCRVStaking.connect(user1).claimCvgRewards(TOKEN_4).should.be.revertedWith("ALL_CVG_CLAIMED_FOR_NOW");
        await sdCRVStaking.connect(user2).claimCvgRewards(TOKEN_5).should.be.revertedWith("ALL_CVG_CLAIMED_FOR_NOW");
    });

    it("Success : Go to cycle 4 !", async () => {
        await increaseCvgCycle(contractsUsers, 1);

        expect(await sdCRVStaking.stakingCycle()).to.be.equal(CYCLE_4);
        expect((await sdCRVStaking.cycleInfo(CYCLE_3)).cvgRewardsAmount).to.be.equal("22011296803121177935699");
    });

    it("Success : Claiming CVG cycle 3 for user 1", async () => {
        const amountCvgClaimedExpected = await getExpectedCvgSdtRewards(sdCRVStaking, TOKEN_4, CYCLE_3);
        const cvgAmountExpected = amountCvgClaimedExpected[0];

        const claimCvgTx = sdCRVStaking.connect(user1).claimCvgRewards(TOKEN_4);
        await expect(claimCvgTx).to.changeTokenBalances(cvg, [user1], [cvgAmountExpected]);
    });

    it("Success : Claiming cycle 3 for user 2 ", async () => {
        await mine(1);
        const amountCvgClaimedExpected = await getExpectedCvgSdtRewards(sdCRVStaking, TOKEN_5, CYCLE_3);
        const cvgAmountExpected = amountCvgClaimedExpected[0];

        const claimCvgTx = sdCRVStaking.connect(user2).claimCvgRewards(TOKEN_5);
        await expect(claimCvgTx).to.changeTokenBalances(cvg, [user2], [cvgAmountExpected]);
    });

    it("Fails : Re-claiming cycle 3 already claimed", async () => {
        await sdCRVStaking.connect(user1).claimCvgRewards(TOKEN_4).should.be.revertedWith("ALL_CVG_CLAIMED_FOR_NOW");
        await sdCRVStaking.connect(user2).claimCvgRewards(TOKEN_5).should.be.revertedWith("ALL_CVG_CLAIMED_FOR_NOW");
    });

    it("Success : Go to cycle 5 !", async () => {
        await increaseCvgCycle(contractsUsers, 1);

        expect(await sdCRVStaking.stakingCycle()).to.be.equal(CYCLE_5);
        expect((await sdCRVStaking.cycleInfo(CYCLE_4)).cvgRewardsAmount).to.be.equal("22032197612477680884638");
    });

    it("Success : Claiming CVG cycle 4 for user 1 ", async () => {
        await mine(1);
        const amountCvgClaimedExpected = await getExpectedCvgSdtRewards(sdCRVStaking, TOKEN_4, CYCLE_4);
        const cvgAmountExpected = amountCvgClaimedExpected[0];

        const claimCvgTx = sdCRVStaking.connect(user1).claimCvgRewards(TOKEN_4);
        await expect(claimCvgTx).to.changeTokenBalances(cvg, [user1], [cvgAmountExpected]);
    });

    it("Success : Claiming CvgRewards on cycle 4 for user 2 ", async () => {
        await mine(1);
        const amountCvgClaimedExpected = await getExpectedCvgSdtRewards(sdCRVStaking, TOKEN_5, CYCLE_4);
        const cvgAmountExpected = amountCvgClaimedExpected[0];

        const claimCvgTx = sdCRVStaking.connect(user2).claimCvgRewards(TOKEN_5);
        await expect(claimCvgTx).to.changeTokenBalances(cvg, [user2], [cvgAmountExpected]);
    });

    it("Fails : Re-claiming cycle 4", async () => {
        await sdCRVStaking.connect(user1).claimCvgRewards(TOKEN_4).should.be.revertedWith("ALL_CVG_CLAIMED_FOR_NOW");
        await sdCRVStaking.connect(user2).claimCvgRewards(TOKEN_5).should.be.revertedWith("ALL_CVG_CLAIMED_FOR_NOW");
    });
});
