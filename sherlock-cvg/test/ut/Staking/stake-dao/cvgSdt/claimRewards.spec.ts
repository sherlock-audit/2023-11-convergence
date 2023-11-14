import {loadFixture, mine} from "@nomicfoundation/hardhat-network-helpers";
import {expect} from "chai";
import {ethers} from "hardhat";
import {Signer, EventLog} from "ethers";
import {SdtStakingPositionService} from "../../../../../typechain-types/contracts/Staking/StakeDAO";
import {ERC20} from "../../../../../typechain-types/@openzeppelin/contracts/token/ERC20";
import {IContractsUser} from "../../../../../utils/contractInterface";
import {deploySdtStakingFixture, increaseCvgCycle} from "../../../../fixtures/fixtures";
import {CvgSDT} from "../../../../../typechain-types/contracts/Token";
import {LockingPositionService} from "../../../../../typechain-types/contracts/Locking";
import {GaugeController} from "../../../../../typechain-types-vyper/GaugeController";
import {CvgSdtBuffer, IFeeDistributor, SdtRewardReceiver} from "../../../../../typechain-types";
import {getExpectedCvgSdtRewards} from "../../../../../utils/stakeDao/getStakingShareForCycle";
import {TypedDeferredTopicFilter, TypedContractEvent} from "../../../../../typechain-types/common";
import {ClaimCvgSdtMultipleEvent} from "../../../../../typechain-types/contracts/Staking/StakeDAO/SdtStakingPositionService";
import {CLAIMER_REWARDS_PERCENTAGE, CYCLE_2, CYCLE_3, CYCLE_4, DENOMINATOR, TOKEN_4, TOKEN_5} from "../../../../../resources/constant";

describe("cvgSdtStaking - Claim Cvg Rewards", () => {
    let contractsUsers: IContractsUser;
    let owner: Signer, user1: Signer, user2: Signer, veSdtMultisig: Signer;
    let cvgSdtStakingContract: SdtStakingPositionService,
        cvgSdtBuffer: CvgSdtBuffer,
        feeDistributor: IFeeDistributor,
        gaugeController: GaugeController,
        lockingPositionService: LockingPositionService,
        sdtRewardReceiver: SdtRewardReceiver;
    let sdt: ERC20, cvg: ERC20, cvgSdt: CvgSDT, sdFRAX3CRV: ERC20;

    let filterClaimCvgSdt: TypedDeferredTopicFilter<
        TypedContractEvent<ClaimCvgSdtMultipleEvent.InputTuple, ClaimCvgSdtMultipleEvent.OutputTuple, ClaimCvgSdtMultipleEvent.OutputObject>
    >;

    before(async () => {
        contractsUsers = await loadFixture(deploySdtStakingFixture);

        const users = contractsUsers.users;
        const contracts = contractsUsers.contracts;
        const stakeDao = contracts.stakeDao;
        const tokens = contracts.tokens;

        owner = users.owner;
        user1 = users.user1;
        user2 = users.user2;
        veSdtMultisig = users.veSdtMultisig;

        cvgSdtStakingContract = stakeDao.cvgSdtStaking;
        cvgSdtBuffer = stakeDao.cvgSdtBuffer;
        feeDistributor = stakeDao.feeDistributor;
        gaugeController = contracts.locking.gaugeController;
        lockingPositionService = contracts.locking.lockingPositionService;
        sdtRewardReceiver = contracts.stakeDao.sdtRewardReceiver;
        cvg = tokens.cvg;
        cvgSdt = tokens.cvgSdt;
        sdt = tokens.sdt;
        sdFRAX3CRV = contracts.tokensStakeDao.sdFrax3Crv;

        // mint locking position and vote for cvgSdtStaking gauge
        await cvg.approve(lockingPositionService, ethers.parseEther("300000"));
        await lockingPositionService.mintPosition(47, ethers.parseEther("100000"), 0, owner, true);
        await gaugeController.simple_vote(5, cvgSdtStakingContract, 1000);
        await sdt.approve(cvgSdt, ethers.MaxUint256);

        // mint cvgSdt
        await cvgSdt.mint(owner, ethers.parseEther("3000000"));

        // transfer cvgSdt to users
        await cvgSdt.transfer(user1, ethers.parseEther("10000"));
        await cvgSdt.transfer(user2, ethers.parseEther("10000"));
        await cvgSdt.transfer(veSdtMultisig, ethers.parseEther("1000000"));

        // approve cvgSdt spending from staking contract
        await cvgSdt.connect(user1).approve(cvgSdtStakingContract, ethers.MaxUint256);
        await cvgSdt.connect(user2).approve(cvgSdtStakingContract, ethers.MaxUint256);

        // deposit for user1 and user2
        await cvgSdtStakingContract.connect(user1).deposit(0, ethers.parseEther("5000"), ethers.ZeroAddress);
        await cvgSdtStakingContract.connect(user2).deposit(0, ethers.parseEther("5000"), ethers.ZeroAddress);

        filterClaimCvgSdt = cvgSdtStakingContract.filters.ClaimCvgSdtMultiple(undefined, undefined);
    });
    it("setDistributor with other caller than cloneFactory should revert", async () => {
        await cvgSdtStakingContract.setBuffer(ethers.ZeroAddress).should.be.revertedWith("NOT_CLONE_FACTORY");
    });

    it("process cvg rewards for cycle 1 & update cvg cycle to 2 should compute right infos", async () => {
        await increaseCvgCycle(contractsUsers, 1);

        expect(await cvgSdtStakingContract.stakingCycle()).to.be.equal(2);
        expect((await cvgSdtStakingContract.cycleInfo(1)).cvgRewardsAmount).to.be.equal(0);
    });
    it("Process stakers rewards with other caller than gauge should revert", async () => {
        await cvgSdtStakingContract.processStakersRewards(1).should.be.revertedWith("NOT_CVG_REWARDS");
    });

    it("process Sdt rewards for cycle 1 should ", async () => {
        await expect(cvgSdtStakingContract.connect(veSdtMultisig).processSdtRewards()).to.be.rejectedWith("NO_STAKERS");
    });

    it("withdraw user2 at cycle 3", async () => {
        await cvgSdtStakingContract.connect(user2).withdraw(TOKEN_5, ethers.parseEther("4000"));
    });

    it("Success : Go in cycle 3 !", async () => {
        await increaseCvgCycle(contractsUsers, 1);
        expect(await cvgSdtStakingContract.stakingCycle()).to.be.equal(CYCLE_3);
        expect((await cvgSdtStakingContract.cycleInfo(CYCLE_2)).cvgRewardsAmount).to.be.equal("35701357466063347935012");
    });
    it("Success : Process SDT rewards for cycle 2.", async () => {
        const amountSdt = ethers.parseEther("1000");
        const amountCvgSdt = ethers.parseEther("400");
        //rewards distribution
        await sdt.connect(veSdtMultisig).transfer(cvgSdtBuffer, amountSdt);
        await cvgSdt.connect(veSdtMultisig).transfer(cvgSdtBuffer, amountCvgSdt);
        // TODO TEST transfers
        //bal before
        const balanceCvgSdtBuffer = await cvgSdt.balanceOf(cvgSdtBuffer);
        const cvgSdtForProcessor = (balanceCvgSdtBuffer * 1_250n) / 100_000n;
        const cvgSdtDistributed = balanceCvgSdtBuffer - cvgSdtForProcessor;

        const balSdtBuffer = await sdt.balanceOf(cvgSdtBuffer);
        const sdtForProcessor = (balSdtBuffer * 1_250n) / 100_000n;
        const sdtDistributed = balSdtBuffer - sdtForProcessor;
        //process
        const txProcess = cvgSdtStakingContract.connect(veSdtMultisig).processSdtRewards();

        await expect(txProcess).to.changeTokenBalances(
            cvgSdt,
            [cvgSdtBuffer, sdtRewardReceiver, veSdtMultisig],
            [-balanceCvgSdtBuffer, cvgSdtDistributed, cvgSdtForProcessor]
        );
        await expect(txProcess).to.changeTokenBalances(sdt, [cvgSdtBuffer, sdtRewardReceiver, veSdtMultisig], [-balSdtBuffer, sdtDistributed, sdtForProcessor]);
    });

    it("deposit with user2 at cycle 3", async () => {
        await cvgSdtStakingContract.connect(user2).deposit(5, ethers.parseEther("3000"), ethers.ZeroAddress);
    });

    it("claimRewards cycle 2 with wrong owner should revert", async () => {
        await cvgSdtStakingContract.connect(user2).claimCvgRewards(TOKEN_4).should.be.revertedWith("TOKEN_NOT_OWNED");
        await cvgSdtStakingContract.connect(user2).claimCvgSdtRewards(TOKEN_4, false, false).should.be.revertedWith("TOKEN_NOT_OWNED");
    });

    it("claimRewards cycle 2 for user 1 should compute right infos", async () => {
        const amountCvgClaimedExpected = await getExpectedCvgSdtRewards(cvgSdtStakingContract, TOKEN_4, CYCLE_2);
        const cvgAmountExpected = amountCvgClaimedExpected[0];
        const sdtAmountExpected = amountCvgClaimedExpected[1];
        const sdFrax3CrvAmountExpected = amountCvgClaimedExpected[2];
        const cvgSdtAmountExpected = amountCvgClaimedExpected[3];

        const claimCvgTx = cvgSdtStakingContract.connect(user1).claimCvgRewards(TOKEN_4);
        // await expect(claimCvgTx)
        //     .to.emit(cvgSdtStakingContract, "ClaimCvgMultiple") // 5000/6000 = 83%
        //     .withArgs(4, await user1.getAddress(), "2", cvgAmountExpected);

        await expect(claimCvgTx).to.changeTokenBalances(cvg, [user1], [cvgAmountExpected]);
        const claimSdtTx = cvgSdtStakingContract.connect(user1).claimCvgSdtRewards(TOKEN_4, false, false);

        await expect(claimSdtTx).to.changeTokenBalances(sdt, [sdtRewardReceiver, user1], [-sdtAmountExpected, sdtAmountExpected]);
        await expect(claimSdtTx).to.changeTokenBalances(sdFRAX3CRV, [sdtRewardReceiver, user1], [-sdFrax3CrvAmountExpected, sdFrax3CrvAmountExpected]);

        const receipt = await (await claimSdtTx).wait();

        const logs = receipt?.logs as EventLog[];
        const event = logs[logs.length - 1].args;
        expect(event.tokenId).to.be.eq(4);
        expect(event.account).to.be.eq(await user1.getAddress());
    });

    it("claimRewards cycle 2 for user 2 should compute right infos", async () => {
        const amountCvgClaimedExpected = await getExpectedCvgSdtRewards(cvgSdtStakingContract, TOKEN_5, CYCLE_2);
        const cvgAmountExpected = amountCvgClaimedExpected[0];
        const sdtAmountExpected = amountCvgClaimedExpected[1];
        const sdFrax3CrvAmountExpected = amountCvgClaimedExpected[2];
        const cvgSdtAmountExpected = amountCvgClaimedExpected[3];

        const claimCvgTx = cvgSdtStakingContract.connect(user2).claimCvgRewards(TOKEN_5);
        // await expect(claimCvgTx)
        //     .to.emit(cvgSdtStakingContract, "ClaimCvg") // 5000/6000 = 83%
        //     .withArgs(5, await user2.getAddress(), "2", cvgAmountExpected);

        const claimSdtTx = cvgSdtStakingContract.connect(user2).claimCvgSdtRewards(TOKEN_5, false, false);
        await expect(claimSdtTx).to.changeTokenBalances(sdt, [sdtRewardReceiver, user2], [-sdtAmountExpected, sdtAmountExpected]);
        await expect(claimSdtTx).to.changeTokenBalances(sdFRAX3CRV, [sdtRewardReceiver, user2], [-sdFrax3CrvAmountExpected, sdFrax3CrvAmountExpected]);

        const receipt = await (await claimSdtTx).wait();
        const logs = receipt?.logs as EventLog[];
        const event = logs[logs.length - 1].args;
        expect(event.tokenId).to.be.eq(5);
        expect(event.account).to.be.eq(await user2.getAddress());
    });

    it("Re-claim cycle 2 should revert", async () => {
        await cvgSdtStakingContract.connect(user1).claimCvgRewards(4).should.be.revertedWith("ALL_CVG_CLAIMED_FOR_NOW");
        await cvgSdtStakingContract.connect(user2).claimCvgRewards(5).should.be.revertedWith("ALL_CVG_CLAIMED_FOR_NOW");
        await cvgSdtStakingContract.connect(user1).claimCvgSdtRewards(4, false, false).should.be.revertedWith("ALL_SDT_CLAIMED_FOR_NOW");
        await cvgSdtStakingContract.connect(user2).claimCvgSdtRewards(5, false, false).should.be.revertedWith("ALL_SDT_CLAIMED_FOR_NOW");
    });

    it("process rewards & update cvg cycle to 4 should compute right infos", async () => {
        await increaseCvgCycle(contractsUsers, 1);

        expect(await cvgSdtStakingContract.stakingCycle()).to.be.equal(4);
        expect((await cvgSdtStakingContract.cycleInfo(3)).cvgRewardsAmount).to.be.equal("35768357305071914750811");
    });
    it("process Sdt rewards for cycle 3 should compute right infos", async () => {
        const amountSdt = ethers.parseEther("700");
        const amountCvgSdt = ethers.parseEther("200");

        //rewards distribution
        await sdt.connect(veSdtMultisig).transfer(cvgSdtBuffer, amountSdt);
        await cvgSdt.connect(veSdtMultisig).transfer(cvgSdtBuffer, amountCvgSdt);

        const cvgSdtForProcessor = (amountCvgSdt * 1_250n) / 100_000n;
        const cvgSdtDistributed = amountCvgSdt - cvgSdtForProcessor;

        const sdtForProcessor = (amountSdt * 1_250n) / 100_000n;
        const sdtDistributed = amountSdt - sdtForProcessor;

        //process
        await cvgSdtStakingContract.connect(veSdtMultisig).processSdtRewards();

        const rewardForCycle = await cvgSdtStakingContract.getProcessedSdtRewards(3);
        expect(rewardForCycle[0].token).to.be.equal(await sdt.getAddress());
        expect(rewardForCycle[0].amount).to.be.equal(sdtDistributed);
        expect(rewardForCycle[1].token).to.be.equal(await sdFRAX3CRV.getAddress());
        expect(rewardForCycle[1].amount).to.be.gt("0"); // => cannot be determinated
        expect(rewardForCycle[2].token).to.be.equal(await cvgSdt.getAddress());
        expect(rewardForCycle[2].amount).to.be.equal(cvgSdtDistributed);
    });

    it("claimRewards cycle 3 for user 1 should compute right infos", async () => {
        const amountCvgClaimedExpected = await getExpectedCvgSdtRewards(cvgSdtStakingContract, 4, 3);
        const cvgAmountExpected = amountCvgClaimedExpected[0];
        const sdtAmountExpected = amountCvgClaimedExpected[1];
        const sdFrax3CrvAmountExpected = amountCvgClaimedExpected[2];
        const cvgSdtAmountExpected = amountCvgClaimedExpected[3];

        const claimCvgTx = cvgSdtStakingContract.connect(user1).claimCvgRewards(4);
        // await expect(claimCvgTx)
        //     .to.emit(cvgSdtStakingContract, "ClaimCvg") // 5000/6000 = 83%
        //     .withArgs(4, await user1.getAddress(), "3", cvgAmountExpected);

        const claimSdtTx = cvgSdtStakingContract.connect(user1).claimCvgSdtRewards(4, false, false);
        await expect(claimSdtTx).to.changeTokenBalances(sdt, [sdtRewardReceiver, user1], [-sdtAmountExpected, sdtAmountExpected]);
        await expect(claimSdtTx).to.changeTokenBalances(sdFRAX3CRV, [sdtRewardReceiver, user1], [-sdFrax3CrvAmountExpected, sdFrax3CrvAmountExpected]);

        const receipt = await (await claimSdtTx).wait();
        const logs = receipt?.logs as EventLog[];

        const event = logs[logs.length - 1].args;
        expect(event.tokenId).to.be.eq(4);
        expect(event.account).to.be.eq(await user1.getAddress());
    });

    it("Success : claimRewards cycle 3 for user 2 should compute right infos", async () => {
        const amountCvgClaimedExpected = await getExpectedCvgSdtRewards(cvgSdtStakingContract, TOKEN_5, CYCLE_3);
        const cvgAmountExpected = amountCvgClaimedExpected[0];
        const sdtAmountExpected = amountCvgClaimedExpected[1];
        const sdFrax3CrvAmountExpected = amountCvgClaimedExpected[2];
        const cvgSdtAmountExpected = amountCvgClaimedExpected[3];

        const claimCvgTx = cvgSdtStakingContract.connect(user2).claimCvgRewards(TOKEN_5);
        // await expect(claimCvgTx)
        //     .to.emit(cvgSdtStakingContract, "ClaimCvg") // 5000/6000 = 83%
        //     .withArgs(5, await user2.getAddress(), "3", cvgAmountExpected);

        const claimSdtTx = cvgSdtStakingContract.connect(user2).claimCvgSdtRewards(TOKEN_5, false, false);
        await expect(claimSdtTx).to.changeTokenBalances(sdt, [sdtRewardReceiver, user2], [-sdtAmountExpected, sdtAmountExpected]);
        await expect(claimSdtTx).to.changeTokenBalances(sdFRAX3CRV, [sdtRewardReceiver, user2], [-sdFrax3CrvAmountExpected, sdFrax3CrvAmountExpected]);

        const events = await cvgSdtStakingContract.queryFilter(filterClaimCvgSdt, -1, "latest");
        const event = events[0].args;

        expect(event.tokenId).to.be.eq(5);
        expect(event.account).to.be.eq(await user2.getAddress());
    });

    it("Fails : Re-claim cycle 3 should revert", async () => {
        await cvgSdtStakingContract.connect(user1).claimCvgRewards(TOKEN_4).should.be.revertedWith("ALL_CVG_CLAIMED_FOR_NOW");
        await cvgSdtStakingContract.connect(user2).claimCvgRewards(TOKEN_5).should.be.revertedWith("ALL_CVG_CLAIMED_FOR_NOW");
        await cvgSdtStakingContract.connect(user1).claimCvgSdtRewards(TOKEN_4, false, false).should.be.revertedWith("ALL_SDT_CLAIMED_FOR_NOW");
        await cvgSdtStakingContract.connect(user2).claimCvgSdtRewards(TOKEN_5, false, false).should.be.revertedWith("ALL_SDT_CLAIMED_FOR_NOW");
    });

    it("process rewards & update cvg cycle to 5 should compute right infos", async () => {
        await increaseCvgCycle(contractsUsers, 1);

        expect(await cvgSdtStakingContract.stakingCycle()).to.be.equal(5);
        expect((await cvgSdtStakingContract.cycleInfo(4)).cvgRewardsAmount).to.be.equal("35837182192447873948626");
    });

    it("Success : Processing Sdt rewards for cycle 4 should compute right infos", async () => {
        const amountSdt = (ethers.parseEther("800") * 1_250n) / 100_000n;
        const amountCvgSdt = (ethers.parseEther("300") * 1_250n) / 100_000n;
        //send more sdFRAX3CRV to feeDistributor
        await sdFRAX3CRV.connect(owner).transfer(feeDistributor, ethers.parseEther("300"));

        //rewards distribution
        await sdt.connect(veSdtMultisig).transfer(cvgSdtBuffer, amountSdt);
        await cvgSdt.connect(veSdtMultisig).transfer(cvgSdtBuffer, amountCvgSdt);

        const cvgSdtForProcessor = (amountCvgSdt * 1_250n) / 100_000n;
        const cvgSdtDistributed = amountCvgSdt - cvgSdtForProcessor;

        const sdtForProcessor = (amountSdt * 1_250n) / 100_000n;
        const sdtDistributed = amountSdt - sdtForProcessor;

        //process
        await cvgSdtStakingContract.connect(veSdtMultisig).processSdtRewards();

        const rewardForCycle = await cvgSdtStakingContract.getProcessedSdtRewards(4);
        expect(rewardForCycle[0].token).to.be.equal(await sdt.getAddress());
        expect(rewardForCycle[0].amount).to.be.equal(sdtDistributed);
        expect(rewardForCycle[1].token).to.be.equal(await sdFRAX3CRV.getAddress());
        expect(rewardForCycle[1].amount).to.be.gt("0"); // => cannot be determinated
        expect(rewardForCycle[2].token).to.be.equal(await cvgSdt.getAddress());
        expect(rewardForCycle[2].amount).to.be.equal(cvgSdtDistributed);
    });

    it("Success : Claiming CVG on cycle 4 for user 1", async () => {
        const amountCvgClaimedExpected = await getExpectedCvgSdtRewards(cvgSdtStakingContract, TOKEN_4, CYCLE_4);
        const cvgAmountExpected = amountCvgClaimedExpected[0];
        const sdtAmountExpected = amountCvgClaimedExpected[1];
        const sdFrax3CrvAmountExpected = amountCvgClaimedExpected[2];
        const cvgSdtAmountExpected = amountCvgClaimedExpected[3];

        const claimCvgTx = cvgSdtStakingContract.connect(user1).claimCvgRewards(TOKEN_4);
        // await expect(claimCvgTx)
        //     .to.emit(cvgSdtStakingContract, "ClaimCvg") // 5000/6000 = 83%
        //     .withArgs(TOKEN_4, await user1.getAddress(), "4", cvgAmountExpected);

        const claimSdtTx = cvgSdtStakingContract.connect(user1).claimCvgSdtRewards(TOKEN_4, false, false);
        await expect(claimSdtTx).to.changeTokenBalances(sdt, [sdtRewardReceiver, user1], [-sdtAmountExpected, sdtAmountExpected]);
        await expect(claimSdtTx).to.changeTokenBalances(sdFRAX3CRV, [sdtRewardReceiver, user1], [-sdFrax3CrvAmountExpected, sdFrax3CrvAmountExpected]);

        const events = await cvgSdtStakingContract.queryFilter(filterClaimCvgSdt, -1, "latest");
        const event = events[0].args;

        expect(event.tokenId).to.be.eq(TOKEN_4);
        expect(event.account).to.be.eq(await user1.getAddress());
    });

    it("claimRewards cycle 4 for user 2 should compute right infos", async () => {
        await mine(1);
        const amountCvgClaimedExpected = await getExpectedCvgSdtRewards(cvgSdtStakingContract, TOKEN_5, 4);
        const cvgAmountExpected = amountCvgClaimedExpected[0];
        const sdtAmountExpected = amountCvgClaimedExpected[1];
        const sdFrax3CrvAmountExpected = amountCvgClaimedExpected[2];
        const cvgSdtAmountExpected = amountCvgClaimedExpected[3];

        const claimCvgTx = cvgSdtStakingContract.connect(user2).claimCvgRewards(TOKEN_5);
        // await expect(claimCvgTx)
        //     .to.emit(cvgSdtStakingContract, "ClaimCvg") // 5000/6000 = 83%
        //     .withArgs(TOKEN_5, await user2.getAddress(), "4", cvgAmountExpected);

        const claimSdtTx = cvgSdtStakingContract.connect(user2).claimCvgSdtRewards(TOKEN_5, false, false);
        await expect(claimSdtTx).to.changeTokenBalances(sdt, [sdtRewardReceiver, user2], [-sdtAmountExpected, sdtAmountExpected]);
        await expect(claimSdtTx).to.changeTokenBalances(sdFRAX3CRV, [sdtRewardReceiver, user2], [-sdFrax3CrvAmountExpected, sdFrax3CrvAmountExpected]);

        const events = await cvgSdtStakingContract.queryFilter(filterClaimCvgSdt, -1, "latest");
        const event = events[0].args;
        expect(event.tokenId).to.be.eq(TOKEN_5);
        expect(event.account).to.be.eq(await user2.getAddress());
    });

    it("Re-claim cycle 4 should revert", async () => {
        await cvgSdtStakingContract.connect(user1).claimCvgRewards(TOKEN_4).should.be.revertedWith("ALL_CVG_CLAIMED_FOR_NOW");
        await cvgSdtStakingContract.connect(user2).claimCvgRewards(TOKEN_5).should.be.revertedWith("ALL_CVG_CLAIMED_FOR_NOW");
        await cvgSdtStakingContract.connect(user1).claimCvgSdtRewards(TOKEN_4, false, false).should.be.revertedWith("ALL_SDT_CLAIMED_FOR_NOW");
        await cvgSdtStakingContract.connect(user2).claimCvgSdtRewards(TOKEN_5, false, false).should.be.revertedWith("ALL_SDT_CLAIMED_FOR_NOW");
    });
});
