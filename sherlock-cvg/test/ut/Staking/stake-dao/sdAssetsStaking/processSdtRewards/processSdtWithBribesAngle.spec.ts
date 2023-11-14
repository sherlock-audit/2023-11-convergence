import {loadFixture, time} from "@nomicfoundation/hardhat-network-helpers";
import {Signer, ContractTransactionResponse} from "ethers";
import {SdtStakingPositionService} from "../../../../../../typechain-types/contracts/Staking/StakeDAO";
import {deploySdtStakingFixture, increaseCvgCycle, increaseCvgCycleWithoutTime} from "../../../../../fixtures/fixtures";
import {IContractsUser, IUsers} from "../../../../../../utils/contractInterface";
import {CvgControlTower, ERC20, ISdAsset, ISdAssetGauge, SdtBlackHole, SdtRewardReceiver, SdtBuffer, SdtFeeCollector} from "../../../../../../typechain-types";

import {expect} from "chai";
import {takesGaugeOwnershipAndSetDistributor} from "../../../../../../utils/stakeDao/takesGaugeOwnershipAndSetDistributor";
import {ethers} from "hardhat";
import {distributeGaugeRewards} from "../../../../../../utils/stakeDao/distributeGaugeRewards";
import {Balances, getBalances} from "../../../../../../utils/erc20/getBalances";
import {CLAIMER_REWARDS_PERCENTAGE, CYCLE_2, DENOMINATOR, TOKEN_4} from "../../../../../../resources/constant";
import {ICommonStruct} from "../../../../../../typechain-types/contracts/interfaces/ISdtBuffer";

describe("sdAssetStaking - SD_ANGLE - process SDT rewards with bribes", () => {
    let contractsUsers: IContractsUser, users: IUsers;
    let owner: Signer, user1: Signer, user2: Signer, treasuryDao: Signer;
    let sdtFeeCollector: SdtFeeCollector,
        sdtBlackHole: SdtBlackHole,
        cvgControlTower: CvgControlTower,
        sdAngleStakingBuffer: SdtBuffer,
        sdtRewardReceiver: SdtRewardReceiver;
    let angle: ERC20, sdt: ERC20, sanUsdEur: ERC20, agEur: ERC20, usdc: ERC20, frax: ERC20, sdAngle: ISdAsset;
    let sdANGLEStaking: SdtStakingPositionService, sdAngleGauge: ISdAssetGauge;

    let rootFees: bigint;

    before(async () => {
        contractsUsers = await loadFixture(deploySdtStakingFixture);
        const tokens = contractsUsers.contracts.tokens;
        const tokensStakeDao = contractsUsers.contracts.tokensStakeDao;

        users = contractsUsers.users;
        owner = users.owner;
        user2 = users.user2;
        treasuryDao = users.treasuryDao;
        sdtBlackHole = contractsUsers.contracts.stakeDao.sdtBlackHole;
        cvgControlTower = contractsUsers.contracts.base.cvgControlTower;
        sdtFeeCollector = contractsUsers.contracts.stakeDao.sdtFeeCollector;
        sdtRewardReceiver = contractsUsers.contracts.stakeDao.sdtRewardReceiver;
        sdANGLEStaking = contractsUsers.contracts.stakeDao.sdAssetsStaking.sdANGLEStaking;
        sdAngleStakingBuffer = await ethers.getContractAt("SdtBuffer", await sdANGLEStaking.buffer());
        sdAngleGauge = tokensStakeDao.sdAngleGauge;

        sdt = tokens.sdt;
        sanUsdEur = tokensStakeDao.sanUsdEur;
        agEur = tokensStakeDao.agEur;
        sdAngle = tokensStakeDao.sdAngle;
        angle = tokensStakeDao.angle;

        usdc = tokens.usdc;
        frax = tokens.frax;

        rootFees = await sdtFeeCollector.rootFees();
    });

    it("Success : Desposit 10M more sdCRV to have a better ROI", async () => {
        const amount10M = ethers.parseEther("10000000");
        const depositTx = sdANGLEStaking.connect(user2).deposit(0, amount10M, ethers.ZeroAddress);

        await expect(depositTx).to.changeTokenBalances(sdAngleGauge, [user2, sdtBlackHole], [-amount10M, amount10M]);
    });

    it("Success : Takes the ownership of the gauge contract and set reward distributor", async () => {
        await takesGaugeOwnershipAndSetDistributor(sdAngleGauge, owner);
    });

    it("Fails : Try to claim SDT rewards before CVG processing ", async () => {
        await expect(sdANGLEStaking.processSdtRewards()).to.be.rejectedWith("NO_STAKERS");
    });

    it("Success : Go to cycle 2", async () => {
        await increaseCvgCycle(contractsUsers, 1);
    });
    it("Fails : Try to claim SDT on the first cycle of the integration", async () => {
        await expect(sdANGLEStaking.processSdtRewards()).to.be.rejectedWith("NO_STAKERS");
    });

    it("Success : Distributing gauges rewards in SDT, SAN_USD_EUR, AG_EUR and ANGLE", async () => {
        await distributeGaugeRewards(
            sdAngleGauge,
            [
                {token: sdt, amount: ethers.parseEther("100")},
                {token: sanUsdEur, amount: ethers.parseUnits("10000", 6)},
                {token: agEur, amount: ethers.parseEther("500")},
                {token: angle, amount: ethers.parseEther("1000")},
            ],
            owner
        );
    });

    it("Success : Go to cycle 3", async () => {
        await increaseCvgCycle(contractsUsers, 1);
    });

    let processSdtRewardsTx: Promise<ContractTransactionResponse>;

    it("Success : Process SDT rewards for cycle 2 in cycle 3", async () => {
        processSdtRewardsTx = sdANGLEStaking.processSdtRewards();
    });

    it("Success : claimed amounts are the full amount", async () => {
        const claimSdtTx = await sdANGLEStaking.connect(user2).claimCvgSdtRewards(TOKEN_4, false, false);
    });

    it("Success : Add a bribe reward on the sdtBlackHole linked to the buffer", async () => {
        await sdtBlackHole.setBribeTokens([contractsUsers.contracts.tokensStakeDao.sdAngle], sdAngleStakingBuffer);
    });

    let sdAngleBribe = ethers.parseEther("10000");
    it("Success : Send bribes in the buffer", async () => {
        await sdAngle.transfer(sdtBlackHole, sdAngleBribe);
    });

    it("Success : Distributes gauges rewards in SDT, SAN_USD_EUR, AG_EUR and ANGLE", async () => {
        await distributeGaugeRewards(
            sdAngleGauge,
            [
                {token: sdt, amount: ethers.parseEther("100")},
                {token: sanUsdEur, amount: ethers.parseUnits("6800", 6)},
                {token: agEur, amount: ethers.parseEther("18600.333")},
                {token: angle, amount: ethers.parseEther("10000")},
            ],
            owner
        );
    });

    it("Success : Increase time and claim rewards on gauge", async () => {
        await time.increase(7 * 86_400);
        await sdAngleGauge.claim_rewards(sdtBlackHole);
    });

    it("Success : Go to cycle 3", async () => {
        await increaseCvgCycleWithoutTime(contractsUsers, 1);
    });

    let bufferBalances: Balances[];
    it("Success : Stream the rewards on the buffer and process rewards separately", async () => {
        await sdAngleGauge.claim_rewards(sdtBlackHole);
        bufferBalances = await getBalances([
            {
                token: await sdt.getAddress(),
                addresses: [await sdAngleStakingBuffer.getAddress()],
            },
            {
                token: await sanUsdEur.getAddress(),
                addresses: [await sdAngleStakingBuffer.getAddress()],
            },
            {
                token: await agEur.getAddress(),
                addresses: [await sdAngleStakingBuffer.getAddress()],
            },
            {
                token: await angle.getAddress(),
                addresses: [await sdAngleStakingBuffer.getAddress()],
            },
        ]);
        processSdtRewardsTx = sdANGLEStaking.processSdtRewards();
    });

    let rewardsWrittenCycle3: ICommonStruct.TokenAmountStruct[];

    it("Verify : Amounts in SDT sent to the Staking contract & to the FeeCollector", async () => {
        const sdtAmountBalance = bufferBalances[0].balances[0].amount;
        const feeAmount = (rootFees * sdtAmountBalance) / 100_000n;
        const claimerRewards = (sdtAmountBalance * CLAIMER_REWARDS_PERCENTAGE) / DENOMINATOR;
        const rewardsAmount = sdtAmountBalance - feeAmount - claimerRewards;

        // Verify amount of SDT, check that fees are distributed to FeeCollector
        await expect(processSdtRewardsTx).to.changeTokenBalances(
            sdt,
            [sdAngleStakingBuffer, sdtRewardReceiver, sdtFeeCollector, owner],
            [-sdtAmountBalance, rewardsAmount, feeAmount, claimerRewards]
        );

        rewardsWrittenCycle3 = await sdANGLEStaking.getProcessedSdtRewards(3);
        const sdtWritten = rewardsWrittenCycle3[0];

        expect(sdtWritten.token).to.be.eq(await sdt.getAddress());
        expect(sdtWritten.amount).to.be.eq(rewardsAmount);
    });

    it("Verify : Amounts of gauge rewards SAN EUR USD ", async () => {
        const claimerRewards = (bufferBalances[1].balances[0].amount * CLAIMER_REWARDS_PERCENTAGE) / DENOMINATOR;
        await expect(processSdtRewardsTx).to.changeTokenBalances(
            sanUsdEur,
            [sdAngleStakingBuffer, sdtRewardReceiver, owner],
            [-bufferBalances[1].balances[0].amount, bufferBalances[1].balances[0].amount - claimerRewards, claimerRewards]
        );

        const rewardWritten = rewardsWrittenCycle3[1];

        expect(rewardWritten.token).to.be.eq(await sanUsdEur.getAddress());
        expect(rewardWritten.amount).to.be.eq(bufferBalances[1].balances[0].amount - claimerRewards);
    });

    it("Verify : Amounts of gauge rewards agEur ", async () => {
        const claimerRewards = (bufferBalances[2].balances[0].amount * CLAIMER_REWARDS_PERCENTAGE) / DENOMINATOR;
        await expect(processSdtRewardsTx).to.changeTokenBalances(
            agEur,
            [sdAngleStakingBuffer, sdtRewardReceiver, owner],
            [-bufferBalances[2].balances[0].amount, bufferBalances[2].balances[0].amount - claimerRewards, claimerRewards]
        );

        const rewardWritten = rewardsWrittenCycle3[2];

        expect(rewardWritten.token).to.be.eq(await agEur.getAddress());
        expect(rewardWritten.amount).to.be.eq(bufferBalances[2].balances[0].amount - claimerRewards);
    });

    it("Verify : Amounts of gauge rewards ANGLE", async () => {
        const claimerRewards = (bufferBalances[3].balances[0].amount * CLAIMER_REWARDS_PERCENTAGE) / DENOMINATOR;
        await expect(processSdtRewardsTx).to.changeTokenBalances(
            angle,
            [sdAngleStakingBuffer, sdtRewardReceiver, owner],
            [-bufferBalances[3].balances[0].amount, bufferBalances[3].balances[0].amount - claimerRewards, claimerRewards]
        );

        const rewardWritten = rewardsWrittenCycle3[3];

        expect(rewardWritten.token).to.be.eq(await angle.getAddress());
        expect(rewardWritten.amount).to.be.eq(bufferBalances[3].balances[0].amount - claimerRewards);
    });

    it("Verify : sdANGLE bribes are claimed", async () => {
        const claimerRewards = (sdAngleBribe * CLAIMER_REWARDS_PERCENTAGE) / DENOMINATOR;
        await expect(processSdtRewardsTx).to.changeTokenBalances(
            sdAngle,
            [sdtBlackHole, sdtRewardReceiver, owner],
            [-sdAngleBribe, sdAngleBribe - claimerRewards, claimerRewards]
        );

        const rewardWritten = rewardsWrittenCycle3[4];

        expect(rewardWritten.token).to.be.eq(await sdAngle.getAddress());
        expect(rewardWritten.amount).to.be.eq(sdAngleBribe - claimerRewards);
    });
});
