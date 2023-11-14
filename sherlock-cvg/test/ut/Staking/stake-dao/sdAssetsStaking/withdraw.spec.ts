import {loadFixture} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import {HardhatEthersSigner} from "@nomicfoundation/hardhat-ethers/signers";
import {expect} from "chai";
import {ethers} from "hardhat";
import {Signer} from "ethers";
import {SdtBlackHole, ISdAssetGauge, SdtStakingPositionService} from "../../../../../typechain-types";
import {IContractsUser} from "../../../../../utils/contractInterface";
import {deploySdtStakingFixture, increaseCvgCycle} from "../../../../fixtures/fixtures";
import {CYCLE_1, CYCLE_2, CYCLE_3, CYCLE_4, CYCLE_5, CYCLE_6, CYCLE_7, TOKEN_1, TOKEN_2, TOKEN_4, TOKEN_5} from "../../../../../resources/constant";
import {getExpectedCvgSdtRewards} from "../../../../../utils/stakeDao/getStakingShareForCycle";

describe("SdtStakingService - Withdraw", () => {
    let contractsUsers: IContractsUser;
    let user1: HardhatEthersSigner, user2: Signer;
    let sdtBlackHole: SdtBlackHole;

    let sdCrvGauge: ISdAssetGauge;
    let sdCRVStaking: SdtStakingPositionService, sdANGLEStaking: SdtStakingPositionService;

    before(async () => {
        contractsUsers = await loadFixture(deploySdtStakingFixture);
        const users = contractsUsers.users;
        user1 = users.user1;
        user2 = users.user2;
        sdCRVStaking = contractsUsers.contracts.stakeDao.sdAssetsStaking.sdCRVStaking;
        sdCrvGauge = contractsUsers.contracts.tokensStakeDao.sdCrvGauge;

        sdCRVStaking = contractsUsers.contracts.stakeDao.sdAssetsStaking.sdCRVStaking;

        sdANGLEStaking = contractsUsers.contracts.stakeDao.sdAssetsStaking.sdANGLEStaking;

        sdtBlackHole = contractsUsers.contracts.stakeDao.sdtBlackHole;

        // approve weth spending from staking contract
        await sdCrvGauge.connect(user1).approve(sdCRVStaking, ethers.MaxUint256);
        await sdCrvGauge.connect(user2).approve(sdCRVStaking, ethers.MaxUint256);

        // deposit for user1 and user2
        await sdCRVStaking.connect(user1).deposit(0, ethers.parseEther("10"), ethers.ZeroAddress);
        await sdCRVStaking.connect(user2).deposit(0, ethers.parseEther("20"), ethers.ZeroAddress);
    });

    it("Fails : Withdrawing with amount 0", async () => {
        await sdCRVStaking.connect(user1).withdraw(TOKEN_4, 0).should.be.revertedWith("WITHDRAW_LTE_0");
    });

    it("Fails : Withdrawing an amount exceeding deposited amount", async () => {
        const amount = ethers.parseEther("500");
        await sdCRVStaking.connect(user2).withdraw(TOKEN_5, amount).should.be.revertedWith("WITHDRAW_EXCEEDS_STAKED_AMOUNT");
    });

    it("Fails : Withdrawing with random user should revert", async () => {
        const amount = ethers.parseEther("100");
        await sdCRVStaking.connect(user1).withdraw(TOKEN_5, amount).should.be.revertedWith("TOKEN_NOT_OWNED");
    });

    it("Success : Withdrawing for user1", async () => {
        expect(await sdCRVStaking.tokenInfoByCycle(CYCLE_2, TOKEN_4)).to.deep.equal([ethers.parseEther("10"), ethers.parseEther("10")]);
        expect(await sdCRVStaking.tokenInfoByCycle(CYCLE_2, TOKEN_5)).to.deep.equal([ethers.parseEther("20"), ethers.parseEther("20")]);

        const amount = ethers.parseEther("1");
        const depositTx = sdCRVStaking.connect(user1).withdraw(TOKEN_4, amount);
        await expect(depositTx)
            .to.emit(sdCRVStaking, "Withdraw")
            .withArgs(TOKEN_4, await user1.getAddress(), CYCLE_1, amount);

        await expect(depositTx).to.changeTokenBalances(sdCrvGauge, [sdtBlackHole, user1], [-amount, amount]);

        // // staking information
        const expectedAmount = ethers.parseEther("9");
        expect((await sdCRVStaking.tokenInfoByCycle(CYCLE_2, TOKEN_4)).amountStaked).to.be.equal(expectedAmount);
        expect((await sdCRVStaking.tokenInfoByCycle(CYCLE_2, TOKEN_5)).amountStaked).to.be.equal(ethers.parseEther("20"));
    });

    it("Success : Withdrawing for user2", async () => {
        await sdANGLEStaking.connect(user2).withdraw(TOKEN_2, ethers.parseEther("150"));
        await sdANGLEStaking.connect(user2).deposit(TOKEN_2, ethers.parseEther("100"), ethers.ZeroAddress);
    });

    it("Success : Going to cycle 3", async () => {
        await increaseCvgCycle(contractsUsers, 2);
    });
    let cvgDistributionCycle2: bigint;
    it("Success : Removes all staked assets in N+2", async () => {
        await sdANGLEStaking.connect(user2).withdraw(TOKEN_2, ethers.parseEther("14950"));

        const [stakedAmountCycle1, stakedAmountCycle2, stakedAmountCycle3, stakingInfo, expectedDistribution, lastCycleUpdate] = await Promise.all([
            await sdANGLEStaking.stakedAmountEligibleAtCycle(CYCLE_1, TOKEN_2, CYCLE_3),
            await sdANGLEStaking.stakedAmountEligibleAtCycle(CYCLE_2, TOKEN_2, CYCLE_3),
            await sdANGLEStaking.stakedAmountEligibleAtCycle(CYCLE_3, TOKEN_2, CYCLE_3),
            await sdANGLEStaking.stakingInfo(TOKEN_2),
            await getExpectedCvgSdtRewards(sdANGLEStaking, TOKEN_2, CYCLE_2),
            await sdANGLEStaking.stakingHistoryByToken(TOKEN_2, 1),
        ]);
        cvgDistributionCycle2 = expectedDistribution[0];
        expect(stakingInfo).to.be.deep.eq([TOKEN_2, "STK-sdANGLE", 0, 0, cvgDistributionCycle2, []]);

        expect(stakedAmountCycle1).to.be.eq(0);
        expect(stakedAmountCycle2).to.be.eq(ethers.parseEther("14950"));
        expect(stakedAmountCycle3).to.be.eq(0);
        expect(lastCycleUpdate).to.be.eq(3);
    });

    let stakingAmountCycle3 = 0n;
    it("Success : Deposits in cycle 3 for user 2 after emptying the position", async () => {
        stakingAmountCycle3 = ethers.parseEther("150");
        await sdANGLEStaking.connect(user2).deposit(TOKEN_2, stakingAmountCycle3, ethers.ZeroAddress);
        const [stakedAmountCycle2, stakedAmountCycle3, stakedAmountCycle4, stakingInfo, lastCycleUpdate] = await Promise.all([
            await sdANGLEStaking.stakedAmountEligibleAtCycle(CYCLE_2, TOKEN_2, CYCLE_3),
            await sdANGLEStaking.stakedAmountEligibleAtCycle(CYCLE_3, TOKEN_2, CYCLE_3),
            await sdANGLEStaking.stakedAmountEligibleAtCycle(CYCLE_4, TOKEN_2, CYCLE_3),
            await sdANGLEStaking.stakingInfo(TOKEN_2),
            await sdANGLEStaking.stakingHistoryByToken(TOKEN_2, 2),
        ]);

        expect(stakingInfo).to.be.deep.eq([2n, "STK-sdANGLE", stakingAmountCycle3, 0, cvgDistributionCycle2, []]);

        expect(stakedAmountCycle2).to.be.eq(ethers.parseEther("14950"));
        expect(stakedAmountCycle3).to.be.eq(0);
        expect(stakedAmountCycle4).to.be.eq(0); // equals 0 because the cycle 4 is in the future
        expect(lastCycleUpdate).to.be.eq(CYCLE_4);
    });

    it("Success : Going in cycle 5", async () => {
        await increaseCvgCycle(contractsUsers, 2);
    });

    let cvgDistributionCycle4: bigint;
    it("Success : Despositing & Withdrawing in cycle 5, remove only one part of the pending", async () => {
        const stakedAmount = ethers.parseEther("50000");
        const withdrawAmount = ethers.parseEther("25000");
        await sdANGLEStaking.connect(user2).deposit(TOKEN_2, stakedAmount, ethers.ZeroAddress);
        await sdANGLEStaking.connect(user2).withdraw(TOKEN_2, withdrawAmount);

        const [
            stakedAmountCycle2,
            stakedAmountCycle3,
            stakedAmountCycle4,
            stakedAmountCycle5,
            stakedAmountCycle6,
            stakingInfo,
            lastCycleUpdate,
            expectedDistribution4,
            tokenInfoCycle6,
        ] = await Promise.all([
            await sdANGLEStaking.stakedAmountEligibleAtCycle(CYCLE_2, TOKEN_2, CYCLE_5),
            await sdANGLEStaking.stakedAmountEligibleAtCycle(CYCLE_3, TOKEN_2, CYCLE_5),
            await sdANGLEStaking.stakedAmountEligibleAtCycle(CYCLE_4, TOKEN_2, CYCLE_5),
            await sdANGLEStaking.stakedAmountEligibleAtCycle(CYCLE_5, TOKEN_2, CYCLE_5),
            await sdANGLEStaking.stakedAmountEligibleAtCycle(CYCLE_6, TOKEN_2, CYCLE_5),
            await sdANGLEStaking.stakingInfo(TOKEN_2),
            await sdANGLEStaking.stakingHistoryByToken(TOKEN_2, 3),
            await getExpectedCvgSdtRewards(sdANGLEStaking, TOKEN_2, CYCLE_4),
            await sdANGLEStaking.tokenInfoByCycle(CYCLE_6, TOKEN_2),
        ]);

        cvgDistributionCycle4 = expectedDistribution4[0];

        expect(stakingInfo).to.be.deep.eq([
            TOKEN_2,
            "STK-sdANGLE",
            stakedAmount - withdrawAmount,
            stakingAmountCycle3,
            cvgDistributionCycle2 + cvgDistributionCycle4,
            [],
        ]);
        expect(stakedAmountCycle2).to.be.eq(ethers.parseEther("14950"));
        expect(stakedAmountCycle3).to.be.eq(0);
        expect(stakedAmountCycle4).to.be.eq(stakingAmountCycle3);
        expect(stakedAmountCycle5).to.be.eq(0);
        expect(stakedAmountCycle6).to.be.eq(0);
        expect(lastCycleUpdate).to.be.eq(CYCLE_5);
        expect(tokenInfoCycle6).to.be.deep.eq([withdrawAmount + stakingAmountCycle3, withdrawAmount]);
    });

    it("Success : Going in cycle 6", async () => {
        await increaseCvgCycle(contractsUsers, 1);
    });

    let cvgDistributionCycle5: bigint;
    it("Success : Despositing in cycle 6, remove all pending and a part of not pending", async () => {
        const stakedAmount = ethers.parseEther("50000");
        const withdrawAmount = ethers.parseEther("55000");
        await sdANGLEStaking.connect(user2).deposit(TOKEN_2, stakedAmount, ethers.ZeroAddress);
        await sdANGLEStaking.connect(user2).withdraw(TOKEN_2, withdrawAmount);

        const [stakedAmountCycle5, stakingInfo, lastCycleUpdate, expectedDistribution5, tokenInfoCycle6, tokenInfoCycle7] = await Promise.all([
            await sdANGLEStaking.stakedAmountEligibleAtCycle(CYCLE_5, TOKEN_2, CYCLE_6),
            await sdANGLEStaking.stakingInfo(TOKEN_2),
            await sdANGLEStaking.stakingHistoryByToken(TOKEN_2, 4),
            await getExpectedCvgSdtRewards(sdANGLEStaking, TOKEN_2, CYCLE_5),
            await sdANGLEStaking.tokenInfoByCycle(CYCLE_6, TOKEN_2),
            await sdANGLEStaking.tokenInfoByCycle(CYCLE_7, TOKEN_2),
        ]);

        cvgDistributionCycle5 = expectedDistribution5[0];

        expect(stakingInfo).to.be.deep.eq([
            TOKEN_2,
            "STK-sdANGLE",
            0,
            20150000000000000000000n,
            cvgDistributionCycle2 + cvgDistributionCycle4 + cvgDistributionCycle5,
            [],
        ]);

        expect(stakedAmountCycle5).to.be.eq(stakingAmountCycle3);
        expect(lastCycleUpdate).to.be.eq(CYCLE_6);
        expect(tokenInfoCycle6).to.be.deep.eq([20150000000000000000000n, 25000000000000000000000n]);
        expect(tokenInfoCycle7).to.be.deep.eq([20150000000000000000000n, 0]);
    });

    it("Success : Claim all ", async () => {
        await sdCRVStaking.connect(user1).claimCvgRewards(TOKEN_1);
        await sdANGLEStaking.connect(user2).claimCvgRewards(TOKEN_2);
        await sdCRVStaking.connect(user1).claimCvgRewards(TOKEN_4);
        await sdCRVStaking.connect(user2).claimCvgRewards(TOKEN_5);
    });
});
