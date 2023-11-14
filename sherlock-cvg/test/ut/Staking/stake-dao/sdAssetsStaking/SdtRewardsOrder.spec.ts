import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {ethers} from "hardhat";
import {Signer, ZeroAddress, MaxUint256, parseEther, parseUnits} from "ethers";
import {expect} from "chai";
import {deploySdtStakingFixture, increaseCvgCycle} from "../../../../fixtures/fixtures";
import {IContractsUser, IUsers} from "../../../../../utils/contractInterface";
import {GaugeController} from "../../../../../typechain-types-vyper";
import {
    Cvg,
    LockingPositionService,
    ISdAssetGauge,
    SdtBuffer,
    SdtBlackHole,
    SdtStakingPositionService,
    ERC20,
    ISdAsset,
    SdtRewardReceiver,
} from "../../../../../typechain-types";
import {getExpectedCvgSdtRewards} from "../../../../../utils/stakeDao/getStakingShareForCycle";
import {CLAIMER_REWARDS_PERCENTAGE, CYCLE_2, CYCLE_3, CYCLE_4, CYCLE_5, DENOMINATOR, TOKEN_4, TOKEN_5} from "../../../../../resources/constant";

describe("sdAssetStaking - Sdt Rewards Different Order", () => {
    let contractsUsers: IContractsUser, users: IUsers;
    let owner: Signer, user1: Signer, user2: Signer;
    let gaugeController: GaugeController,
        lockingPositionService: LockingPositionService,
        sdtBlackHole: SdtBlackHole,
        sdFXSStakingBuffer: SdtBuffer,
        sdtRewardsReceiver: SdtRewardReceiver;
    let cvg: Cvg;
    let sdt: ERC20, bal: ERC20, usdc: ERC20, frax: ERC20, sdCrv: ISdAsset;
    let sdFXSGaugeStaking: SdtStakingPositionService, sdFxsGauge: ISdAssetGauge;

    before(async () => {
        contractsUsers = await loadFixture(deploySdtStakingFixture);
        const tokens = contractsUsers.contracts.tokens;
        const tokensStakeDao = contractsUsers.contracts.tokensStakeDao;

        users = contractsUsers.users;
        owner = users.owner;
        user1 = users.user1;
        user2 = users.user2;
        sdtBlackHole = contractsUsers.contracts.stakeDao.sdtBlackHole;
        lockingPositionService = contractsUsers.contracts.locking.lockingPositionService;

        sdFXSGaugeStaking = contractsUsers.contracts.stakeDao.sdAssetsStaking.sdFXSStaking;
        sdFXSStakingBuffer = await ethers.getContractAt("SdtBuffer", await sdFXSGaugeStaking.buffer());
        gaugeController = contractsUsers.contracts.locking.gaugeController;
        sdFxsGauge = tokensStakeDao.sdFxsGauge;
        sdtRewardsReceiver = contractsUsers.contracts.stakeDao.sdtRewardReceiver;
        cvg = tokens.cvg;
        sdt = tokens.sdt;
        sdCrv = tokensStakeDao.sdCrv;
        bal = tokensStakeDao.bal;
        usdc = tokens.usdc;
        frax = tokens.frax;

        // mint locking position and vote for cvgSdtStaking gauge
        await cvg.approve(lockingPositionService, parseEther("300000"));
        await lockingPositionService.mintPosition(47, parseEther("100000"), 0, owner, true);
        await gaugeController.simple_vote(5, sdFXSGaugeStaking, 1000);
        // approve weth spending from staking contract
        await sdFxsGauge.connect(user1).approve(sdFXSGaugeStaking, MaxUint256);
        await sdFxsGauge.connect(user2).approve(sdFXSGaugeStaking, MaxUint256);

        // deposit for user1 and user2
        await sdFXSGaugeStaking.connect(user1).deposit(0, parseEther("10"), ZeroAddress);
        await sdFXSGaugeStaking.connect(user2).deposit(0, parseEther("10"), ZeroAddress);
    });

    it("Success : Processing rewards & update cvg cycle to 2", async () => {
        await increaseCvgCycle(contractsUsers, 1);

        expect(await sdFXSGaugeStaking.stakingCycle()).to.be.equal(2);
        expect((await sdFXSGaugeStaking.cycleInfo(1)).cvgRewardsAmount).to.be.equal(0);
    });

    it("Success : Adding a bribe reward on the sdtBlackHole linked to the buffer", async () => {
        await sdtBlackHole.setBribeTokens([sdCrv, bal, usdc], sdFXSStakingBuffer);
        const bribesTokens = await sdtBlackHole.getBribeTokensForBuffer(sdFXSStakingBuffer);
        expect(bribesTokens[0]).to.be.equal(await sdCrv.getAddress());
        expect(bribesTokens[1]).to.be.equal(await bal.getAddress());
        expect(bribesTokens[2]).to.be.equal(await usdc.getAddress());
    });

    it("Success : Processing cvg rewards for cycle 2 & update cycle to 3", async () => {
        await increaseCvgCycle(contractsUsers, 1);
        expect(await sdFXSGaugeStaking.stakingCycle()).to.be.equal(CYCLE_3);
        expect((await sdFXSGaugeStaking.cycleInfo(CYCLE_2)).cvgRewardsAmount).to.be.equal("1448393378773124657558");
    });
    let sdCrvBribeCycle2 = parseEther("5000");
    let balBribeCycle2 = parseEther("2000");
    let usdcBribeCycle2 = parseUnits("1000", 6);
    it("Success : Sending bribes to the SdtBlackHole", async () => {
        await sdCrv.transfer(sdtBlackHole, sdCrvBribeCycle2);
        await bal.transfer(sdtBlackHole, balBribeCycle2);
        await usdc.transfer(sdtBlackHole, usdcBribeCycle2);
    });
    it("Success : Processing SDT rewards for cycle 2", async () => {
        const processSdtRewardsTx = await sdFXSGaugeStaking.processSdtRewards();
        //bribes rewards balance
        sdCrvBribeCycle2 -= (sdCrvBribeCycle2 * CLAIMER_REWARDS_PERCENTAGE) / DENOMINATOR;
        balBribeCycle2 -= (balBribeCycle2 * CLAIMER_REWARDS_PERCENTAGE) / DENOMINATOR;
        usdcBribeCycle2 -= (usdcBribeCycle2 * CLAIMER_REWARDS_PERCENTAGE) / DENOMINATOR;

        expect(await sdCrv.balanceOf(sdtRewardsReceiver)).to.be.equal(sdCrvBribeCycle2);
        expect(await bal.balanceOf(sdtRewardsReceiver)).to.be.equal(balBribeCycle2);
        expect(await usdc.balanceOf(sdtRewardsReceiver)).to.be.equal(usdcBribeCycle2);
        const rewardsWrittenCycle2 = await sdFXSGaugeStaking.getProcessedSdtRewards(2);
        //SDT gauge rewards
        // const rewardSDT = rewardsWrittenCycle2[0];//
        // const rewardFXS = rewardsWrittenCycle2[1];//
        //SDT bribes rewards
        // const rewardSDCRV = rewardsWrittenCycle2[2];//
        // const rewardBAL = rewardsWrittenCycle2[3];//
        // const rewardUSDC = rewardsWrittenCycle2[4];//
        const rewardSDCRV = rewardsWrittenCycle2[0];
        const rewardBAL = rewardsWrittenCycle2[1];
        const rewardUSDC = rewardsWrittenCycle2[2];
        expect(rewardSDCRV.token).to.be.equal(await sdCrv.getAddress());
        expect(rewardSDCRV.amount).to.be.equal(sdCrvBribeCycle2);
        expect(rewardBAL.token).to.be.equal(await bal.getAddress());
        expect(rewardBAL.amount).to.be.equal(balBribeCycle2);
        expect(rewardUSDC.token).to.be.equal(await usdc.getAddress());
        expect(rewardUSDC.amount).to.be.equal(usdcBribeCycle2);
    });
    it("Success : Claiming Cvg & Sdt rewards cycle 2 for user 1 ", async () => {
        const amountCvgClaimedExpected = await getExpectedCvgSdtRewards(sdFXSGaugeStaking, TOKEN_4, CYCLE_2);
        const cvgAmountExpected = amountCvgClaimedExpected[0];
        const balBeforeSdCrv = await sdCrv.balanceOf(user1);
        const balBeforeBal = await bal.balanceOf(user1);
        const balBeforeUsdc = await usdc.balanceOf(user1);
        const claimCvgSdtTx = await sdFXSGaugeStaking.connect(user1).claimCvgSdtRewards(TOKEN_4, false, false);
        // expect(await sdCrv.balanceOf(user1)).to.be.equal(balBeforeSdCrv + amountCvgClaimedExpected[3]);//
        // expect(await bal.balanceOf(user1)).to.be.equal(balBeforeBal + amountCvgClaimedExpected[4]);//
        // expect(await usdc.balanceOf(user1)).to.be.equal(balBeforeUsdc + amountCvgClaimedExpected[5]);//
        expect(await sdCrv.balanceOf(user1)).to.be.equal(balBeforeSdCrv + amountCvgClaimedExpected[1]);
        expect(await bal.balanceOf(user1)).to.be.equal(balBeforeBal + amountCvgClaimedExpected[2]);
        expect(await usdc.balanceOf(user1)).to.be.equal(balBeforeUsdc + amountCvgClaimedExpected[3]);
        await expect(claimCvgSdtTx).to.changeTokenBalances(cvg, [user1], [cvgAmountExpected]);
    });
    it("Success : Claiming Cvg & Sdt rewards cycle 2 for user 2 ", async () => {
        const amountCvgClaimedExpected = await getExpectedCvgSdtRewards(sdFXSGaugeStaking, TOKEN_5, CYCLE_2);
        const cvgAmountExpected = amountCvgClaimedExpected[0];
        const balBeforeSdCrv = await sdCrv.balanceOf(user2);
        const balBeforeBal = await bal.balanceOf(user2);
        const balBeforeUsdc = await usdc.balanceOf(user2);
        const claimCvgSdtTx = await sdFXSGaugeStaking.connect(user2).claimCvgSdtRewards(TOKEN_5, false, false);
        // expect(await sdCrv.balanceOf(user2)).to.be.equal(balBeforeSdCrv + amountCvgClaimedExpected[3]);//
        // expect(await bal.balanceOf(user2)).to.be.equal(balBeforeBal + amountCvgClaimedExpected[4]);//
        // expect(await usdc.balanceOf(user2)).to.be.equal(balBeforeUsdc + amountCvgClaimedExpected[5]);//
        expect(await sdCrv.balanceOf(user2)).to.be.equal(balBeforeSdCrv + amountCvgClaimedExpected[1]);
        expect(await bal.balanceOf(user2)).to.be.equal(balBeforeBal + amountCvgClaimedExpected[2]);
        expect(await usdc.balanceOf(user2)).to.be.equal(balBeforeUsdc + amountCvgClaimedExpected[3]);
        await expect(claimCvgSdtTx).to.changeTokenBalances(cvg, [user2], [cvgAmountExpected]);
    });
    it("Success : Adding a bribe reward on the sdtBlackHole linked to the buffer", async () => {
        await sdtBlackHole.setBribeTokens([bal, frax, usdc], sdFXSStakingBuffer);
    });

    it("Success : Processing cvg rewards for cycle 3 & update cycle to 4", async () => {
        await increaseCvgCycle(contractsUsers, 1);
        expect(await sdFXSGaugeStaking.stakingCycle()).to.be.equal(CYCLE_4);
        expect((await sdFXSGaugeStaking.cycleInfo(CYCLE_3)).cvgRewardsAmount).to.be.equal("1404482062976930899951");
    });
    let balBribeCycle3 = parseEther("3000");
    let fraxBribeCycle3 = parseEther("8000");
    let usdcBribeCycle3 = parseUnits("7000", 6);
    it("Success : Sending bribes in the buffer", async () => {
        await bal.transfer(sdtBlackHole, balBribeCycle3);
        await frax.transfer(sdtBlackHole, fraxBribeCycle3);
        await usdc.transfer(sdtBlackHole, usdcBribeCycle3);
    });
    it("Success : Processing SDT rewards for cycle 3", async () => {
        const processSdtRewardsTx = await sdFXSGaugeStaking.processSdtRewards();
        //bribes rewards balance
        balBribeCycle3 -= (balBribeCycle3 * CLAIMER_REWARDS_PERCENTAGE) / DENOMINATOR;
        fraxBribeCycle3 -= (fraxBribeCycle3 * CLAIMER_REWARDS_PERCENTAGE) / DENOMINATOR;
        usdcBribeCycle3 -= (usdcBribeCycle3 * CLAIMER_REWARDS_PERCENTAGE) / DENOMINATOR;

        expect(await bal.balanceOf(sdtRewardsReceiver)).to.be.equal(balBribeCycle3);
        expect(await frax.balanceOf(sdtRewardsReceiver)).to.be.equal(fraxBribeCycle3);
        expect(await usdc.balanceOf(sdtRewardsReceiver)).to.be.equal(usdcBribeCycle3);
        const rewardsWrittenCycle3 = await sdFXSGaugeStaking.getProcessedSdtRewards(3);
        //SDT bribes rewards
        const rewardBAL = rewardsWrittenCycle3[0];
        const rewardUSDC = rewardsWrittenCycle3[1];
        const rewardFRAX = rewardsWrittenCycle3[2]; //new bribe token so positioned at end
        expect(rewardBAL.token).to.be.equal(await bal.getAddress());
        expect(rewardBAL.amount).to.be.equal(balBribeCycle3);
        expect(rewardFRAX.token).to.be.equal(await frax.getAddress());
        expect(rewardFRAX.amount).to.be.equal(fraxBribeCycle3);
        expect(rewardUSDC.token).to.be.equal(await usdc.getAddress());
        expect(rewardUSDC.amount).to.be.equal(usdcBribeCycle3);
    });
    it("Success : Claiming Cvg & Sdt rewards cycle 3 for user 1 ", async () => {
        const claimableBefore = await sdFXSGaugeStaking.getAllClaimableAmounts(TOKEN_4);
        const amountCvgSdtClaimedExpected = await getExpectedCvgSdtRewards(sdFXSGaugeStaking, TOKEN_4, CYCLE_3);
        const cvgAmountExpected = amountCvgSdtClaimedExpected[0];

        const balBeforeBal = await bal.balanceOf(user1);
        const balBeforeFrax = await frax.balanceOf(user1);
        const balBeforeUsdc = await usdc.balanceOf(user1);
        const claimCvgSdtTx = await sdFXSGaugeStaking.connect(user1).claimCvgSdtRewards(TOKEN_4, false, false);

        const claimableAfter = await sdFXSGaugeStaking.getAllClaimableAmounts(TOKEN_4);
        expect(await bal.balanceOf(user1)).to.be.equal(balBeforeBal + amountCvgSdtClaimedExpected[1]);
        expect(await frax.balanceOf(user1)).to.be.equal(balBeforeFrax + amountCvgSdtClaimedExpected[3]);
        expect(await usdc.balanceOf(user1)).to.be.equal(balBeforeUsdc + amountCvgSdtClaimedExpected[2]);
        await expect(claimCvgSdtTx).to.changeTokenBalances(cvg, [user1], [cvgAmountExpected]);
        expect(claimableBefore[0]).to.be.equal(cvgAmountExpected); //cvg rewards
        expect(claimableBefore[1].length).to.be.equal(3); //sdt rewards
        expect(claimableBefore[1][0].amount).to.be.equal(amountCvgSdtClaimedExpected[1]); //sdt rewards
        expect(claimableBefore[1][1].amount).to.be.equal(amountCvgSdtClaimedExpected[2]); //sdt rewards
        expect(claimableBefore[1][2].amount).to.be.equal(amountCvgSdtClaimedExpected[3]); //sdt rewards

        expect(claimableAfter[0]).to.be.equal(0); //cvg rewards
        expect(claimableAfter[1].length).to.be.equal(0); //sdt rewards
    });
    it("Success : Claiming Cvg & Sdt rewards cycle 3 for user 2 ", async () => {
        const amountCvgSdtClaimedExpected = await getExpectedCvgSdtRewards(sdFXSGaugeStaking, TOKEN_5, CYCLE_3);
        const cvgAmountExpected = amountCvgSdtClaimedExpected[0];

        const balBeforeBal = await bal.balanceOf(user2);
        const balBeforeFrax = await frax.balanceOf(user2);
        const balBeforeUsdc = await usdc.balanceOf(user2);
        const claimCvgSdtTx = await sdFXSGaugeStaking.connect(user2).claimCvgSdtRewards(TOKEN_5, false, false);

        expect(await bal.balanceOf(user2)).to.be.equal(balBeforeBal + amountCvgSdtClaimedExpected[1]);
        expect(await frax.balanceOf(user2)).to.be.equal(balBeforeFrax + amountCvgSdtClaimedExpected[3]);
        expect(await usdc.balanceOf(user2)).to.be.equal(balBeforeUsdc + amountCvgSdtClaimedExpected[2]);
        await expect(claimCvgSdtTx).to.changeTokenBalances(cvg, [user2], [cvgAmountExpected]);
    });
    it("Success : Processing cvg rewards for cycle 4 & update cycle to 5", async () => {
        await increaseCvgCycle(contractsUsers, 1);
        expect(await sdFXSGaugeStaking.stakingCycle()).to.be.equal(CYCLE_5);
        expect((await sdFXSGaugeStaking.cycleInfo(CYCLE_4)).cvgRewardsAmount).to.be.equal("1359378125486185795017");
    });
    it("Success : Processing SDT rewards for cycle 4 without rewards", async () => {
        const processSdtRewardsTx = await sdFXSGaugeStaking.processSdtRewards();
        const rewardsWrittenCycle4 = await sdFXSGaugeStaking.getProcessedSdtRewards(CYCLE_4);
        expect(rewardsWrittenCycle4.length).to.be.equal(0);
    });
    it("Check claimable for cycle 4 user1", async () => {
        const amountCvgSdtClaimedExpected = await getExpectedCvgSdtRewards(sdFXSGaugeStaking, TOKEN_4, CYCLE_4);
        expect(amountCvgSdtClaimedExpected.length).to.be.equal(1); //only cvg rewards
    });
    it("Check claimable for cycle 4 user2", async () => {
        const amountCvgSdtClaimedExpected = await getExpectedCvgSdtRewards(sdFXSGaugeStaking, TOKEN_5, CYCLE_4);
        expect(amountCvgSdtClaimedExpected.length).to.be.equal(1); //only cvg rewards
    });
});
