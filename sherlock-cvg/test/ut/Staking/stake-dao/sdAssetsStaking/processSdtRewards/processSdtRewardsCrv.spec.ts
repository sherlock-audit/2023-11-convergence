import {loadFixture, time} from "@nomicfoundation/hardhat-network-helpers";
import {Signer, ContractTransactionResponse} from "ethers";
import {SdtStakingPositionService} from "../../../../../../typechain-types/contracts/Staking/StakeDAO";
import {deploySdtStakingFixture, increaseCvgCycle, increaseCvgCycleWithoutTime} from "../../../../../fixtures/fixtures";
import {IContractsUser, IUsers} from "../../../../../../utils/contractInterface";
import {CvgControlTower, ERC20, ISdAssetGauge, SdtBlackHole, SdtBuffer, SdtFeeCollector, SdtRewardReceiver} from "../../../../../../typechain-types";

import {TokenAmount, getAllGaugeRewardsSdt} from "../../../../../../utils/stakeDao/getGaugeRewardsSdt";
import {expect} from "chai";
import {takesGaugeOwnershipAndSetDistributor} from "../../../../../../utils/stakeDao/takesGaugeOwnershipAndSetDistributor";
import {ethers} from "hardhat";
import {distributeGaugeRewards} from "../../../../../../utils/stakeDao/distributeGaugeRewards";
import {Balances, getBalances} from "../../../../../../utils/erc20/getBalances";
import {CLAIMER_REWARDS_PERCENTAGE, CYCLE_2, DENOMINATOR, TOKEN_1} from "../../../../../../resources/constant";
import {ICommonStruct} from "../../../../../../typechain-types/contracts/Staking/StakeDAO/SdtBuffer";

describe("sdAssetStaking - SD_CRV - process SDT rewards without bribes & bonus asset", () => {
    let contractsUsers: IContractsUser, users: IUsers;
    let owner: Signer, user1: Signer;
    let sdtFeeCollector: SdtFeeCollector, sdtBlackHole: SdtBlackHole, sdCrvStakingBuffer: SdtBuffer, sdtRewardReceiver: SdtRewardReceiver;
    let sdt: ERC20, crv: ERC20, _3crv: ERC20;
    let sdCRVStaking: SdtStakingPositionService, sdCrvGauge: ISdAssetGauge;
    let rootFees: bigint;

    before(async () => {
        contractsUsers = await loadFixture(deploySdtStakingFixture);
        const tokens = contractsUsers.contracts.tokens;
        const tokensStakeDao = contractsUsers.contracts.tokensStakeDao;

        users = contractsUsers.users;
        owner = users.owner;
        user1 = users.user1;
        sdtBlackHole = contractsUsers.contracts.stakeDao.sdtBlackHole;
        sdtFeeCollector = contractsUsers.contracts.stakeDao.sdtFeeCollector;

        sdCRVStaking = contractsUsers.contracts.stakeDao.sdAssetsStaking.sdCRVStaking;
        sdCrvStakingBuffer = await ethers.getContractAt("SdtBuffer", await sdCRVStaking.buffer());
        sdtRewardReceiver = contractsUsers.contracts.stakeDao.sdtRewardReceiver;
        sdCrvGauge = tokensStakeDao.sdCrvGauge;

        sdt = tokens.sdt;
        _3crv = tokens._3crv;
        crv = tokens.crv;

        rootFees = await sdtFeeCollector.rootFees();
    });

    it("Success : Desposit 10M more sdCRV to have a better ROI", async () => {
        const amount10M = ethers.parseEther("10000000");
        const depositTx = sdCRVStaking.connect(user1).deposit(1, amount10M, ethers.ZeroAddress);

        await expect(depositTx).to.changeTokenBalances(sdCrvGauge, [user1, sdtBlackHole], [-amount10M, amount10M]);
    });

    it("Success : Takes the ownership of the gauge contract and set reward distributor", async () => {
        await takesGaugeOwnershipAndSetDistributor(sdCrvGauge, owner);
    });

    it("Fails : Try to claim SDT rewards before CVG processing ", async () => {
        await expect(sdCRVStaking.processSdtRewards()).to.be.rejectedWith("NO_STAKERS");
    });

    it("Success : Go to cycle 2", async () => {
        await increaseCvgCycle(contractsUsers, 1);
    });
    it("Fails : Try to claim SDT on the first cycle of the integration", async () => {
        await expect(sdCRVStaking.processSdtRewards()).to.be.rejectedWith("NO_STAKERS");
    });

    it("Success : Distributes gauges rewards in SDT, CRV & 3CRV ", async () => {
        await distributeGaugeRewards(
            sdCrvGauge,
            [
                {token: sdt, amount: ethers.parseEther("2000")},
                {token: crv, amount: ethers.parseEther("100000")},
                {token: _3crv, amount: ethers.parseEther("10")},
            ],
            owner
        );
    });

    it("Success : Go to cycle 3", async () => {
        await increaseCvgCycle(contractsUsers, 1);
    });

    let allClaimableRewards: TokenAmount[];
    let processSdtRewardsTx: Promise<ContractTransactionResponse>;

    it("Success : Process SDT rewards for cycle 2 in cycle 3", async () => {
        allClaimableRewards = await getAllGaugeRewardsSdt(sdCrvGauge, sdtBlackHole, rootFees);
        processSdtRewardsTx = sdCRVStaking.processSdtRewards();
    });

    let rewardsWritten: ICommonStruct.TokenAmountStruct[];
    it("Success : claimed amounts are the full amount", async () => {
        const claimSdtTx = sdCRVStaking.connect(user1).claimCvgSdtRewards(TOKEN_1, false, false);
        rewardsWritten = await sdCRVStaking.getProcessedSdtRewards(2);
        for (let index = 0; index < allClaimableRewards.length; index++) {
            await expect(claimSdtTx).to.changeTokenBalances(
                await ethers.getContractAt("ERC20", await rewardsWritten[index].token),
                [sdtRewardReceiver, user1],
                [-rewardsWritten[index].amount, rewardsWritten[index].amount]
            );
        }
    });

    it("Verify : Amounts in SDT sent to the SdtRewardReceiver & to the FeeCollector", async () => {
        const sdtClaimed = allClaimableRewards[0];
        // Verify amount of SDT, check that fees are distributed to FeeCollector
        await expect(processSdtRewardsTx).to.changeTokenBalances(
            allClaimableRewards[0].token,
            [sdCrvGauge, sdtRewardReceiver, sdtFeeCollector, owner],
            [-sdtClaimed.total, sdtClaimed.amount, sdtClaimed.feeAmount, sdtClaimed.claimerRewards]
        );

        expect(rewardsWritten[0].token).to.be.eq(await sdtClaimed.token.getAddress());
        expect(rewardsWritten[0].amount).to.be.eq(sdtClaimed.amount);
    });

    it("Verify : Amounts in other tokens are sent to SdtRewardReceiver contract", async () => {
        // Verify amount of other tokens
        for (let index = 1; index < allClaimableRewards.length; index++) {
            const claimableRewards = allClaimableRewards[index];
            await expect(processSdtRewardsTx).to.changeTokenBalances(
                claimableRewards.token,
                [sdCrvGauge, sdtRewardReceiver, owner],
                [-claimableRewards.total, claimableRewards.amount, claimableRewards.claimerRewards]
            );

            const rewardWritten = (await sdCRVStaking.getProcessedSdtRewards(2))[index];

            expect(rewardWritten.token).to.be.eq(await claimableRewards.token.getAddress());
            expect(rewardWritten.amount).to.be.eq(claimableRewards.amount);
        }
    });

    it("Fails : Try to process SDT rewards", async () => {
        await expect(sdCRVStaking.processSdtRewards()).to.be.rejectedWith("SDT_REWARDS_ALREADY_PROCESSED");
    });

    it("Success : Distributes SDT and stream rewards", async () => {
        await distributeGaugeRewards(
            sdCrvGauge,
            [
                {token: sdt, amount: ethers.parseEther("1000")},
                {token: _3crv, amount: ethers.parseEther("5000")},
                {token: crv, amount: ethers.parseEther("20000")},
            ],
            owner
        );
    });

    it("Success : Increase time and claim rewards on gauge", async () => {
        await time.increase(7 * 86_400);
        await sdCrvGauge.claim_rewards(sdtBlackHole);
    });

    it("Success : Go to cycle 4", async () => {
        await increaseCvgCycleWithoutTime(contractsUsers, 1);
    });

    let bufferBalances: Balances[];

    it("Success : Stream the rewards on the buffer and process rewards separately", async () => {
        await sdCrvGauge.claim_rewards(sdtBlackHole);
        bufferBalances = await getBalances([
            {
                token: await sdt.getAddress(),
                addresses: [await sdCrvStakingBuffer.getAddress()],
            },
            {
                token: await _3crv.getAddress(),
                addresses: [await sdCrvStakingBuffer.getAddress()],
            },
            {
                token: await crv.getAddress(),
                addresses: [await sdCrvStakingBuffer.getAddress()],
            },
        ]);
        processSdtRewardsTx = sdCRVStaking.processSdtRewards();
    });

    it("Verify : Amounts in SDT sent to the Staking contract & to the FeeCollector", async () => {
        const sdtAmountBalance = bufferBalances[0].balances[0].amount;
        const feeAmount = (rootFees * sdtAmountBalance) / 100_000n;
        const claimerRewards = (sdtAmountBalance * CLAIMER_REWARDS_PERCENTAGE) / DENOMINATOR;
        const rewardsAmount = sdtAmountBalance - feeAmount - claimerRewards;

        // Verify amount of SDT, check that fees are distributed to FeeCollector
        await expect(processSdtRewardsTx).to.changeTokenBalances(
            sdt,
            [sdCrvStakingBuffer, sdtRewardReceiver, sdtFeeCollector, owner],
            [-sdtAmountBalance, rewardsAmount, feeAmount, claimerRewards]
        );

        const sdtWritten = (await sdCRVStaking.getProcessedSdtRewards(3))[0];

        expect(sdtWritten.token).to.be.eq(await sdt.getAddress());
        expect(sdtWritten.amount).to.be.eq(rewardsAmount);
    });

    it("Verify : Amounts in other tokens are sent to SdAssetStaking contract", async () => {
        // Verify amount of other tokens
        for (let index = 1; index < allClaimableRewards.length; index++) {
            const claimableRewards = allClaimableRewards[index];
            const claimerRewards = (bufferBalances[index].balances[0].amount * CLAIMER_REWARDS_PERCENTAGE) / DENOMINATOR;

            await expect(processSdtRewardsTx).to.changeTokenBalances(
                claimableRewards.token,
                [sdCrvStakingBuffer, sdtRewardReceiver, owner],
                [-bufferBalances[index].balances[0].amount, bufferBalances[index].balances[0].amount - claimerRewards, claimerRewards]
            );

            const rewardWritten = (await sdCRVStaking.getProcessedSdtRewards(3))[index];

            expect(rewardWritten.token).to.be.eq(await claimableRewards.token.getAddress());
            expect(rewardWritten.amount).to.be.eq(bufferBalances[index].balances[0].amount - claimerRewards);
        }
    });
});
