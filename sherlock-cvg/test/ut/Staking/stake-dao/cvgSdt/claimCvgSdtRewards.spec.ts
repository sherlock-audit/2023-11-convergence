import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {ethers} from "hardhat";
import {Signer} from "ethers";
import {expect} from "chai";
import {IFeeDistributor, SdtRewardReceiver} from "../../../../../typechain-types";

import {ERC20} from "../../../../../typechain-types/@openzeppelin/contracts/token/ERC20";
import {Cvg, CvgSDT} from "../../../../../typechain-types/contracts/Token";
import {deploySdtStakingFixture, increaseCvgCycle} from "../../../../fixtures/fixtures";
import {LockingPositionService} from "../../../../../typechain-types/contracts/Locking";
import {IContractsUser} from "../../../../../utils/contractInterface";
import {GaugeController} from "../../../../../typechain-types-vyper/GaugeController";
import {CvgSdtBuffer, SdtStakingPositionService} from "../../../../../typechain-types";
import {getExpectedCvgSdtRewards} from "../../../../../utils/stakeDao/getStakingShareForCycle";
import {CLAIMER_REWARDS_PERCENTAGE, CYCLE_1, CYCLE_2, CYCLE_3, CYCLE_4, CYCLE_5, DENOMINATOR, MINT, TOKEN_4, TOKEN_5} from "../../../../../resources/constant";
import {TypedContractEvent, TypedDeferredTopicFilter} from "../../../../../typechain-types/common";
import {ClaimCvgMultipleEvent, ClaimCvgSdtMultipleEvent} from "../../../../../typechain-types/contracts/Staking/StakeDAO/SdtStakingPositionService";
import {mine} from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("CvgSdtStaking - Claim CvgSdt Rewards ", () => {
    let contractsUsers: IContractsUser;
    let owner: Signer, user1: Signer, user2: Signer, veSdtMultisig: Signer;
    let cvgSdtStakingContract: SdtStakingPositionService,
        cvgSdtBuffer: CvgSdtBuffer,
        feeDistributor: IFeeDistributor,
        gaugeController: GaugeController,
        lockingPositionService: LockingPositionService,
        sdtRewardReceiver: SdtRewardReceiver;
    let sdt: ERC20, cvg: Cvg, cvgSdt: CvgSDT, sdFRAX3CRV: ERC20;
    let filterClaimCvg: TypedDeferredTopicFilter<
        TypedContractEvent<ClaimCvgMultipleEvent.InputTuple, ClaimCvgMultipleEvent.OutputTuple, ClaimCvgMultipleEvent.OutputObject>
    >;
    let filterClaimCvgSdt: TypedDeferredTopicFilter<
        TypedContractEvent<ClaimCvgSdtMultipleEvent.InputTuple, ClaimCvgSdtMultipleEvent.OutputTuple, ClaimCvgSdtMultipleEvent.OutputObject>
    >;

    let depositedAmountToken4 = ethers.parseEther("5000"),
        depositedAmountToken5 = ethers.parseEther("100000"),
        withdrawAmount = ethers.parseEther("4000"),
        depositedAmount = ethers.parseEther("3000");
    before(async () => {
        contractsUsers = await loadFixture(deploySdtStakingFixture);

        const users = contractsUsers.users;
        const contracts = contractsUsers.contracts;
        const stakeDao = contracts.stakeDao;
        const tokens = contracts.tokens;
        const tokensStakeDao = contracts.tokensStakeDao;

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
        sdFRAX3CRV = tokensStakeDao.sdFrax3Crv;

        // mint locking position and vote for cvgSdtStaking gauge
        await cvg.approve(lockingPositionService, ethers.parseEther("300000"));
        await lockingPositionService.mintPosition(47, ethers.parseEther("100000"), 0, owner, true);
        await gaugeController.simple_vote(5, cvgSdtStakingContract, 1000);
        await sdt.approve(cvgSdt, ethers.MaxUint256);

        // mint cvgSdt
        await cvgSdt.mint(owner, ethers.parseEther("3000000"));

        // transfer cvgSdt to users
        await cvgSdt.transfer(user1, ethers.parseEther("1000000"));
        await cvgSdt.transfer(user2, ethers.parseEther("1000000"));
        await cvgSdt.transfer(veSdtMultisig, ethers.parseEther("1000000"));
        // approve cvgSdt spending from staking contract
        await cvgSdt.connect(user1).approve(cvgSdtStakingContract, ethers.MaxUint256);
        await cvgSdt.connect(user2).approve(cvgSdtStakingContract, ethers.MaxUint256);

        // deposit for user1 and user2
        await cvgSdtStakingContract.connect(user1).deposit(MINT, depositedAmountToken4, ethers.ZeroAddress);
        await cvgSdtStakingContract.connect(user2).deposit(MINT, depositedAmountToken5, ethers.ZeroAddress);

        filterClaimCvg = cvgSdtStakingContract.filters.ClaimCvgMultiple(undefined, undefined);
        filterClaimCvgSdt = cvgSdtStakingContract.filters.ClaimCvgSdtMultiple(undefined, undefined);
    });
    it("Fail: initialize ysDistributor", async () => {
        await cvgSdtBuffer.initialize(user1, feeDistributor).should.be.revertedWith("Initializable: contract is already initialized");
    });
    it("Fail: pull rewards with random user", async () => {
        await cvgSdtBuffer.pullRewards(owner).should.be.revertedWith("NOT_CVG_SDT_STAKING");
    });
    it("Fails : claimCvgSdtRewards too early (at cycle N 1) should revert", async () => {
        await cvgSdtStakingContract.connect(user1).claimCvgRewards(TOKEN_4).should.be.revertedWith("ALL_CVG_CLAIMED_FOR_NOW");
        await cvgSdtStakingContract.connect(user1).claimCvgSdtRewards(TOKEN_4, false, false).should.be.revertedWith("ALL_SDT_CLAIMED_FOR_NOW");
    });

    it("Success : Verifying tokenStakingInfo initial state", async () => {
        expect(await cvgSdtStakingContract.stakingHistoryByToken(TOKEN_4, 0)).to.be.eq(CYCLE_2);
        expect(await cvgSdtStakingContract.stakingHistoryByToken(TOKEN_5, 0)).to.be.eq(CYCLE_2);
    });

    it("Success : Verifying tokenInfoByCycle initial state", async () => {
        expect(await cvgSdtStakingContract.tokenInfoByCycle(CYCLE_1, TOKEN_4)).to.be.deep.eq([0, 0]);
        expect(await cvgSdtStakingContract.tokenInfoByCycle(CYCLE_1, TOKEN_5)).to.be.deep.eq([0, 0]);
        expect(await cvgSdtStakingContract.tokenInfoByCycle(CYCLE_2, TOKEN_4)).to.be.deep.eq([depositedAmountToken4, depositedAmountToken4]);
        expect(await cvgSdtStakingContract.tokenInfoByCycle(CYCLE_2, TOKEN_5)).to.be.deep.eq([depositedAmountToken5, depositedAmountToken5]);
    });

    it("Success : Verifying tokenInfoByCycle initial state", async () => {
        // First cycle is set as already set to prevent call on first cycle
        expect(await cvgSdtStakingContract.cycleInfo(CYCLE_1)).to.be.deep.eq([0, 0, false, true]);
        expect(await cvgSdtStakingContract.cycleInfo(CYCLE_2)).to.be.deep.eq([0, depositedAmountToken4 + depositedAmountToken5, false, false]);
    });

    it("Success : Processing rewards & Updating cvg cycle to 1", async () => {
        await increaseCvgCycle(contractsUsers, 1);
        expect(await cvgSdtStakingContract.stakingCycle()).to.be.equal(CYCLE_2);
    });

    it("Success : Withdrawing user2 at cycle 2", async () => {
        await cvgSdtStakingContract.connect(user2).withdraw(TOKEN_5, withdrawAmount);
        expect(await cvgSdtStakingContract.stakingHistoryByToken(TOKEN_5, 0)).to.be.eq(CYCLE_2);
        expect(await cvgSdtStakingContract.tokenInfoByCycle(CYCLE_2, TOKEN_5)).to.be.deep.eq([depositedAmountToken5 - withdrawAmount, depositedAmountToken5]);
        expect(await cvgSdtStakingContract.tokenInfoByCycle(CYCLE_3, TOKEN_5)).to.be.deep.eq([depositedAmountToken5 - withdrawAmount, 0]);
        expect(await cvgSdtStakingContract.cycleInfo(CYCLE_2)).to.be.deep.eq([0, depositedAmountToken4 + depositedAmountToken5 - withdrawAmount, false, false]);
        expect(await cvgSdtStakingContract.cycleInfo(CYCLE_3)).to.be.deep.eq([0, depositedAmountToken4 + depositedAmountToken5 - withdrawAmount, false, false]);
    });

    it("Fails : Claiming rewards on first cycle", async () => {
        await cvgSdtStakingContract.connect(user1).claimCvgRewards(TOKEN_4).should.be.revertedWith("ALL_CVG_CLAIMED_FOR_NOW");
        await cvgSdtStakingContract.connect(user2).claimCvgRewards(TOKEN_5).should.be.revertedWith("ALL_CVG_CLAIMED_FOR_NOW");
        await cvgSdtStakingContract.connect(user1).claimCvgSdtRewards(TOKEN_4, false, false).should.be.revertedWith("ALL_SDT_CLAIMED_FOR_NOW");
        await cvgSdtStakingContract.connect(user2).claimCvgSdtRewards(TOKEN_5, false, false).should.be.revertedWith("ALL_SDT_CLAIMED_FOR_NOW");
    });

    it("Success : Go to Cycle 3 !", async () => {
        await increaseCvgCycle(contractsUsers, 1);
        expect(await cvgSdtStakingContract.stakingCycle()).to.be.equal(CYCLE_3);
    });
    it("Success : Process StakeDao for cycle 2.", async () => {
        const amountSdt = ethers.parseEther("1000");
        const amountCvgSdt = ethers.parseEther("400");
        //rewards distribution
        await sdt.connect(veSdtMultisig).transfer(cvgSdtBuffer, amountSdt);
        await cvgSdt.connect(veSdtMultisig).transfer(cvgSdtBuffer, amountCvgSdt);
        //process
        await cvgSdtStakingContract.connect(veSdtMultisig).processSdtRewards();

        const rewardForCycle = await cvgSdtStakingContract.getProcessedSdtRewards(2);
        const expectedSdtAmount = (amountSdt * (DENOMINATOR - CLAIMER_REWARDS_PERCENTAGE)) / DENOMINATOR;
        const expectedCvgSdtAmount = (amountCvgSdt * (DENOMINATOR - CLAIMER_REWARDS_PERCENTAGE)) / DENOMINATOR;
        expect(rewardForCycle[0]).to.deep.eq([await sdt.getAddress(), expectedSdtAmount]);
        expect(rewardForCycle[1].token).to.be.equal(await sdFRAX3CRV.getAddress());
        expect(rewardForCycle[1].amount).to.be.gt("0"); //=> amount of SdFRAX3CRV that cannot be determinated
        expect(rewardForCycle[2]).to.deep.eq([await cvgSdt.getAddress(), expectedCvgSdtAmount]);
    });

    it("Success : deposit with user2 at cycle 3", async () => {
        await cvgSdtStakingContract.connect(user2).deposit(TOKEN_5, depositedAmount, ethers.ZeroAddress);

        expect(await cvgSdtStakingContract.stakingHistoryByToken(TOKEN_5, 0)).to.be.eq(CYCLE_2);
        expect(await cvgSdtStakingContract.stakingHistoryByToken(TOKEN_5, 1)).to.be.eq(CYCLE_3);
        expect(await cvgSdtStakingContract.tokenInfoByCycle(CYCLE_3, TOKEN_5)).to.be.deep.eq([depositedAmountToken5 - withdrawAmount, 0]);
        expect(await cvgSdtStakingContract.tokenInfoByCycle(CYCLE_4, TOKEN_5)).to.be.deep.eq([
            depositedAmountToken5 - withdrawAmount + depositedAmount,
            depositedAmount,
        ]);
        expect(await cvgSdtStakingContract.cycleInfo(CYCLE_3)).to.be.deep.eq([0, depositedAmountToken4 + depositedAmountToken5 - withdrawAmount, false, false]);
        expect(await cvgSdtStakingContract.cycleInfo(CYCLE_4)).to.be.deep.eq([
            0,
            depositedAmountToken4 + depositedAmountToken5 - withdrawAmount + depositedAmount,
            false,
            false,
        ]);
    });

    it("Success :  Go to cycle 4 !", async () => {
        await increaseCvgCycle(contractsUsers, 1);
        expect(await cvgSdtStakingContract.stakingCycle()).to.be.equal(CYCLE_4);
    });

    it("Success : Process SDT Rewards for Cycle 3", async () => {
        const amountSdt = ethers.parseEther("700");
        const amountCvgSdt = ethers.parseEther("300");
        //rewards distribution
        await sdt.connect(veSdtMultisig).transfer(cvgSdtBuffer, amountSdt);
        await cvgSdt.connect(veSdtMultisig).transfer(cvgSdtBuffer, amountCvgSdt);
        //process
        await cvgSdtStakingContract.connect(veSdtMultisig).processSdtRewards();

        const rewardForCycle = await cvgSdtStakingContract.getProcessedSdtRewards(3);
        const expectedSdtAmount = (amountSdt * (DENOMINATOR - CLAIMER_REWARDS_PERCENTAGE)) / DENOMINATOR;
        const expectedCvgSdtAmount = (amountCvgSdt * (DENOMINATOR - CLAIMER_REWARDS_PERCENTAGE)) / DENOMINATOR;
        expect(rewardForCycle[0]).to.deep.eq([await sdt.getAddress(), expectedSdtAmount]);
        expect(rewardForCycle[1].token).to.be.equal(await sdFRAX3CRV.getAddress());
        expect(rewardForCycle[1].amount).to.be.gt("0"); //=> amount of SdFRAX3CRV that cannot be determinated
        expect(rewardForCycle[2]).to.deep.eq([await cvgSdt.getAddress(), expectedCvgSdtAmount]);
    });

    it("Success : Go to cycle 5 !", async () => {
        await increaseCvgCycle(contractsUsers, 1);
        expect(await cvgSdtStakingContract.stakingCycle()).to.be.equal(CYCLE_5);
    });

    it("Success : Process SDT Rewards for Cycle 4 ", async () => {
        const amountSdt = ethers.parseEther("800");
        const amountCvgSdt = ethers.parseEther("1000");
        //send more sdFRAX3CRV to feeDistributor
        await sdFRAX3CRV.connect(owner).transfer(feeDistributor, ethers.parseEther("20000"));
        //rewards distribution
        await sdt.connect(veSdtMultisig).transfer(cvgSdtBuffer, amountSdt);
        await cvgSdt.connect(veSdtMultisig).transfer(cvgSdtBuffer, amountCvgSdt);
        //process
        await cvgSdtStakingContract.connect(veSdtMultisig).processSdtRewards();

        const rewardForCycle = await cvgSdtStakingContract.getProcessedSdtRewards(CYCLE_4);
        const expectedSdtAmount = (amountSdt * (DENOMINATOR - CLAIMER_REWARDS_PERCENTAGE)) / DENOMINATOR;
        const expectedCvgSdtAmount = (amountCvgSdt * (DENOMINATOR - CLAIMER_REWARDS_PERCENTAGE)) / DENOMINATOR;
        expect(rewardForCycle[0]).to.deep.eq([await sdt.getAddress(), expectedSdtAmount]);
        expect(rewardForCycle[1].token).to.be.equal(await sdFRAX3CRV.getAddress());
        expect(rewardForCycle[1].amount).to.be.gt("0"); //=> amount of SdFRAX3CRV that cannot be determinated
        expect(rewardForCycle[2]).to.deep.eq([await cvgSdt.getAddress(), expectedCvgSdtAmount]);
    });

    it("Fails : claimCvgSdtRewards claim on a token not owned", async () => {
        await cvgSdtStakingContract.connect(user2).claimCvgSdtRewards(TOKEN_4, false, false).should.be.revertedWith("TOKEN_NOT_OWNED");
    });

    it("Success: Verify getAllClaimableCvgAmount equals to claimable of CVG for cycle 2 / 3 / 4", async () => {
        const cycle2RewardsExpected = await getExpectedCvgSdtRewards(cvgSdtStakingContract, TOKEN_4, CYCLE_2);
        const cycle3RewardsExpected = await getExpectedCvgSdtRewards(cvgSdtStakingContract, TOKEN_4, CYCLE_3);
        const cycle4RewardsExpected = await getExpectedCvgSdtRewards(cvgSdtStakingContract, TOKEN_4, CYCLE_4);

        const cvgRewards = await cvgSdtStakingContract.getAllClaimableCvgAmount(TOKEN_4);
        expect(cvgRewards).to.be.equal(cycle2RewardsExpected[0] + cycle3RewardsExpected[0] + cycle4RewardsExpected[0]);
    });

    it("Success: getClaimableCyclesAndAmounts with toCycle under actual cycle", async () => {
        const cycle2RewardsExpected = await getExpectedCvgSdtRewards(cvgSdtStakingContract, TOKEN_4, CYCLE_2);
        const cycle3RewardsExpected = await getExpectedCvgSdtRewards(cvgSdtStakingContract, TOKEN_4, CYCLE_3);
        const allCycleAmounts = await cvgSdtStakingContract.getClaimableCyclesAndAmounts(TOKEN_4);
        // cycle 2
        let sdtRewards = allCycleAmounts[0].sdtRewards;
        expect(allCycleAmounts[0].cvgRewards).to.be.equal(cycle2RewardsExpected[0]);
        expect(sdtRewards[0].amount).to.be.equal(cycle2RewardsExpected[1]);
        expect(sdtRewards[1].amount).to.be.equal(cycle2RewardsExpected[2]);
        expect(sdtRewards[2].amount).to.be.equal(cycle2RewardsExpected[3]);

        //cycle 3
        sdtRewards = allCycleAmounts[1].sdtRewards;
        expect(allCycleAmounts[1].cvgRewards).to.be.equal(cycle3RewardsExpected[0]);
        expect(sdtRewards[0].amount).to.be.equal(cycle3RewardsExpected[1]);
        expect(sdtRewards[1].amount).to.be.equal(cycle3RewardsExpected[2]);
        expect(sdtRewards[2].amount).to.be.equal(cycle3RewardsExpected[3]);
    });

    it("Success: Verify getAllClaimableAmounts for cycle 2 / 3 / 4", async () => {
        const cycle2RewardsExpected = await getExpectedCvgSdtRewards(cvgSdtStakingContract, TOKEN_4, CYCLE_2);
        const cycle3RewardsExpected = await getExpectedCvgSdtRewards(cvgSdtStakingContract, TOKEN_4, CYCLE_3);
        const cycle4RewardsExpected = await getExpectedCvgSdtRewards(cvgSdtStakingContract, TOKEN_4, CYCLE_4);

        const allClaimableAmounts = await cvgSdtStakingContract.getAllClaimableAmounts(TOKEN_4);
        const cvgRewards = allClaimableAmounts[0];
        const allSdtRewards = allClaimableAmounts[1];

        const sdtRewards = allSdtRewards[0].amount;
        const sdFrax3CrvRewards = allSdtRewards[1].amount;
        const cvgSdtRewards = allSdtRewards[2].amount;

        expect(cvgRewards).to.be.equal(cycle2RewardsExpected[0] + cycle3RewardsExpected[0] + cycle4RewardsExpected[0]);
        expect(sdtRewards).to.be.equal(cycle2RewardsExpected[1] + cycle3RewardsExpected[1] + cycle4RewardsExpected[1]);
        expect(sdFrax3CrvRewards).to.be.equal(cycle2RewardsExpected[2] + cycle3RewardsExpected[2] + cycle4RewardsExpected[2]);
        expect(cvgSdtRewards).to.be.equal(cycle2RewardsExpected[3] + cycle3RewardsExpected[3] + cycle4RewardsExpected[3]);
    });

    it("Success: getClaimableCyclesAndAmounts with fromCycle equals to toCycle", async () => {
        const cycle2RewardsExpected = await getExpectedCvgSdtRewards(cvgSdtStakingContract, TOKEN_4, CYCLE_2);
        const allCycleAmounts = await cvgSdtStakingContract.getClaimableCyclesAndAmounts(TOKEN_4);
        // cycle 2
        let sdtRewards = allCycleAmounts[0].sdtRewards;
        expect(allCycleAmounts[0].cvgRewards).to.be.equal(cycle2RewardsExpected[0]);
        expect(sdtRewards[0].amount).to.be.equal(cycle2RewardsExpected[1]);
        expect(sdtRewards[1].amount).to.be.equal(cycle2RewardsExpected[2]);
        expect(sdtRewards[2].amount).to.be.equal(cycle2RewardsExpected[3]);
    });

    it("Success: Check claimable", async () => {
        const cycle2RewardsExpected = await getExpectedCvgSdtRewards(cvgSdtStakingContract, TOKEN_4, CYCLE_2);
        const cycle3RewardsExpected = await getExpectedCvgSdtRewards(cvgSdtStakingContract, TOKEN_4, CYCLE_3);
        const cycle4RewardsExpected = await getExpectedCvgSdtRewards(cvgSdtStakingContract, TOKEN_4, CYCLE_4);
        const cvgClaimable = await cvgSdtStakingContract.getAllClaimableCvgAmount(TOKEN_4);
        const allAmounts = await cvgSdtStakingContract.getAllClaimableAmounts(TOKEN_4);
        const allCycleAmounts = await cvgSdtStakingContract.getClaimableCyclesAndAmounts(TOKEN_4);
        const totalCvg = cycle2RewardsExpected[0] + cycle3RewardsExpected[0] + cycle4RewardsExpected[0];
        const totalSdt = cycle2RewardsExpected[1] + cycle3RewardsExpected[1] + cycle4RewardsExpected[1];
        const totalSdFrax3CRV = cycle2RewardsExpected[2] + cycle3RewardsExpected[2] + cycle4RewardsExpected[2];
        const totalCvgSdt = cycle2RewardsExpected[3] + cycle3RewardsExpected[3] + cycle4RewardsExpected[3];

        expect(cvgClaimable).to.be.equal(totalCvg);
        expect(allAmounts[0]).to.be.equal(totalCvg);
        expect(allAmounts[1][0].amount).to.be.equal(totalSdt);
        expect(allAmounts[1][1].amount).to.be.equal(totalSdFrax3CRV);
        expect(allAmounts[1][2].amount).to.be.equal(totalCvgSdt);

        // cycle 2
        let sdtRewards = allCycleAmounts[0].sdtRewards;
        expect(allCycleAmounts[0].cvgRewards).to.be.equal(cycle2RewardsExpected[0]);
        expect(sdtRewards[0].amount).to.be.equal(cycle2RewardsExpected[1]);
        expect(sdtRewards[1].amount).to.be.equal(cycle2RewardsExpected[2]);
        expect(sdtRewards[2].amount).to.be.equal(cycle2RewardsExpected[3]);

        //cycle 3
        sdtRewards = allCycleAmounts[1].sdtRewards;
        expect(allCycleAmounts[1].cvgRewards).to.be.equal(cycle3RewardsExpected[0]);
        expect(sdtRewards[0].amount).to.be.equal(cycle3RewardsExpected[1]);
        expect(sdtRewards[1].amount).to.be.equal(cycle3RewardsExpected[2]);
        expect(sdtRewards[2].amount).to.be.equal(cycle3RewardsExpected[3]);

        //cycle 4
        sdtRewards = allCycleAmounts[2].sdtRewards;
        expect(allCycleAmounts[2].cvgRewards).to.be.equal(cycle4RewardsExpected[0]);
        expect(sdtRewards[0].amount).to.be.equal(cycle4RewardsExpected[1]);
        expect(sdtRewards[1].amount).to.be.equal(cycle4RewardsExpected[2]);
        expect(sdtRewards[2].amount).to.be.equal(cycle4RewardsExpected[3]);
    });

    it("Success : Claim with claimCvgRewards for Token 4 for cycle 2 / 3 / 4 ", async () => {
        const cycle2RewardsExpected = await getExpectedCvgSdtRewards(cvgSdtStakingContract, TOKEN_4, CYCLE_2);
        const cycle3RewardsExpected = await getExpectedCvgSdtRewards(cvgSdtStakingContract, TOKEN_4, CYCLE_3);
        const cycle4RewardsExpected = await getExpectedCvgSdtRewards(cvgSdtStakingContract, TOKEN_4, CYCLE_4);

        const tx = cvgSdtStakingContract.connect(user1).claimCvgRewards(TOKEN_4);

        await expect(tx).to.changeTokenBalances(cvg, [user1], [cycle2RewardsExpected[0] + cycle3RewardsExpected[0] + cycle4RewardsExpected[0]]);

        const events = await cvgSdtStakingContract.queryFilter(filterClaimCvg, -1, "latest");

        const event = events[0].args;
        const expectedEvent = [TOKEN_4, await user1.getAddress()];
        expect(event).to.be.deep.eq(expectedEvent);
    });

    it("Success:  Claim with claimCvgSdtRewards for Token 4 for cycle 2 / 3 / 4. Only StakeDao is claimed on the 3 cycles.", async () => {
        const cycle2RewardsExpected = await getExpectedCvgSdtRewards(cvgSdtStakingContract, TOKEN_4, CYCLE_2);
        const cycle3RewardsExpected = await getExpectedCvgSdtRewards(cvgSdtStakingContract, TOKEN_4, CYCLE_3);
        const cycle4RewardsExpected = await getExpectedCvgSdtRewards(cvgSdtStakingContract, TOKEN_4, CYCLE_4);
        const allCycleAmounts = await cvgSdtStakingContract.getClaimableCyclesAndAmounts(TOKEN_4);
        //cycle 2
        expect(allCycleAmounts[0].cycleClaimable).to.be.equal(2);
        let sdtRewards = allCycleAmounts[0].sdtRewards;
        expect(allCycleAmounts[0].cvgRewards).to.be.equal(0);
        expect(sdtRewards[0].amount).to.be.equal(cycle2RewardsExpected[1]);
        expect(sdtRewards[1].amount).to.be.equal(cycle2RewardsExpected[2]);
        expect(sdtRewards[2].amount).to.be.equal(cycle2RewardsExpected[3]);

        //cycle 3
        expect(allCycleAmounts[1].cycleClaimable).to.be.equal(3);
        sdtRewards = allCycleAmounts[1].sdtRewards;
        expect(allCycleAmounts[1].cvgRewards).to.be.equal(0);
        expect(sdtRewards[0].amount).to.be.equal(cycle3RewardsExpected[1]);
        expect(sdtRewards[1].amount).to.be.equal(cycle3RewardsExpected[2]);
        expect(sdtRewards[2].amount).to.be.equal(cycle3RewardsExpected[3]);

        //cycle 4
        expect(allCycleAmounts[2].cycleClaimable).to.be.equal(4);
        sdtRewards = allCycleAmounts[2].sdtRewards;
        expect(allCycleAmounts[2].cvgRewards).to.be.equal(0);
        expect(sdtRewards[0].amount).to.be.equal(cycle4RewardsExpected[1]);
        expect(sdtRewards[1].amount).to.be.equal(cycle4RewardsExpected[2]);
        expect(sdtRewards[2].amount).to.be.equal(cycle4RewardsExpected[3]);
    });

    it("Success : Claim Token 4 CvgSdt Rewards for cycle 2 & 3 & 4. CVG Are already claimed here.", async () => {
        const cycle2RewardsExpected = await getExpectedCvgSdtRewards(cvgSdtStakingContract, TOKEN_4, CYCLE_2);
        const cycle3RewardsExpected = await getExpectedCvgSdtRewards(cvgSdtStakingContract, TOKEN_4, CYCLE_3);
        const cycle4RewardsExpected = await getExpectedCvgSdtRewards(cvgSdtStakingContract, TOKEN_4, CYCLE_4);
        const tx = cvgSdtStakingContract.connect(user1).claimCvgSdtRewards(TOKEN_4, false, false);

        const totalSdt = cycle2RewardsExpected[1] + cycle3RewardsExpected[1] + cycle4RewardsExpected[1];
        const totalSdFrax3CRV = cycle2RewardsExpected[2] + cycle3RewardsExpected[2] + cycle4RewardsExpected[2];

        // Only cycle 3 is claimed for CVG
        await expect(tx).to.changeTokenBalances(cvg, [user1], [0]);

        await expect(tx).to.changeTokenBalances(sdt, [sdtRewardReceiver, user1], [-totalSdt, totalSdt]);
        await expect(tx).to.changeTokenBalances(sdFRAX3CRV, [sdtRewardReceiver, user1], [-totalSdFrax3CRV, totalSdFrax3CRV]);

        const events = await cvgSdtStakingContract.queryFilter(filterClaimCvgSdt, -1, "latest");
        const event = events[0].args;
        expect(event.tokenId).to.be.eq(TOKEN_4);
        expect(event.account).to.be.eq(await user1.getAddress());
    });

    it("Success: getClaimableCyclesAndAmounts with all rewards claimed for cycle 2 to cycle 4 should compute nothing to claim", async () => {
        const allCycleAmounts = await cvgSdtStakingContract.getClaimableCyclesAndAmounts(TOKEN_4);
        expect(allCycleAmounts.length).to.be.eq(0);
    });

    it("Success : claimCvgSdtRewards user2 / token2 for cycle 2 & 3 & 4", async () => {
        await mine(1);
        const cycle2RewardsExpected = await getExpectedCvgSdtRewards(cvgSdtStakingContract, TOKEN_5, CYCLE_2);
        const cycle3RewardsExpected = await getExpectedCvgSdtRewards(cvgSdtStakingContract, TOKEN_5, CYCLE_3);
        const cycle4RewardsExpected = await getExpectedCvgSdtRewards(cvgSdtStakingContract, TOKEN_5, CYCLE_4);
        const tx = cvgSdtStakingContract.connect(user2).claimCvgSdtRewards(TOKEN_5, false, false);
        const totalCvg = cycle2RewardsExpected[0] + cycle3RewardsExpected[0] + cycle4RewardsExpected[0];
        const totalSdt = cycle2RewardsExpected[1] + cycle3RewardsExpected[1] + cycle4RewardsExpected[1];
        const totalSdFrax3CRV = cycle2RewardsExpected[2] + cycle3RewardsExpected[2] + cycle4RewardsExpected[2];

        // Only cycle 3 is claimed for CVG
        await expect(tx).to.changeTokenBalances(cvg, [user2], [totalCvg]);

        await expect(tx).to.changeTokenBalances(sdt, [sdtRewardReceiver, user2], [-totalSdt, totalSdt]);
        await expect(tx).to.changeTokenBalances(sdFRAX3CRV, [sdtRewardReceiver, user2], [-totalSdFrax3CRV, totalSdFrax3CRV]);

        const events = await cvgSdtStakingContract.queryFilter(filterClaimCvgSdt, -1, "latest");
        const event = events[0].args;
        expect(event.tokenId).to.be.eq(TOKEN_5);
        expect(event.account).to.be.eq(await user2.getAddress());
    });

    it("Fails : Reclaim with several combinations", async () => {
        await cvgSdtStakingContract.connect(user1).claimCvgRewards(TOKEN_4).should.be.revertedWith("ALL_CVG_CLAIMED_FOR_NOW");
        await cvgSdtStakingContract.connect(user1).claimCvgSdtRewards(TOKEN_4, false, false).should.be.revertedWith("ALL_SDT_CLAIMED_FOR_NOW");

        await cvgSdtStakingContract.connect(user1).claimCvgRewards(TOKEN_4).should.be.revertedWith("ALL_CVG_CLAIMED_FOR_NOW");
        await cvgSdtStakingContract.connect(user1).claimCvgSdtRewards(TOKEN_4, false, false).should.be.revertedWith("ALL_SDT_CLAIMED_FOR_NOW");

        await cvgSdtStakingContract.connect(user1).claimCvgRewards(TOKEN_4).should.be.revertedWith("ALL_CVG_CLAIMED_FOR_NOW");
        await cvgSdtStakingContract.connect(user1).claimCvgSdtRewards(TOKEN_4, false, false).should.be.revertedWith("ALL_SDT_CLAIMED_FOR_NOW");

        await cvgSdtStakingContract.connect(user2).claimCvgRewards(TOKEN_5).should.be.revertedWith("ALL_CVG_CLAIMED_FOR_NOW");
        await cvgSdtStakingContract.connect(user2).claimCvgSdtRewards(TOKEN_5, false, false).should.be.revertedWith("ALL_SDT_CLAIMED_FOR_NOW");
        await cvgSdtStakingContract.connect(user2).claimCvgSdtRewards(TOKEN_5, false, false).should.be.revertedWith("ALL_SDT_CLAIMED_FOR_NOW");

        await cvgSdtStakingContract.connect(user2).claimCvgRewards(TOKEN_5).should.be.revertedWith("ALL_CVG_CLAIMED_FOR_NOW");
        await cvgSdtStakingContract.connect(user2).claimCvgSdtRewards(TOKEN_5, false, false).should.be.revertedWith("ALL_SDT_CLAIMED_FOR_NOW");
    });
});
