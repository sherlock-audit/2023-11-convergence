import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {ethers} from "hardhat";
import {Signer} from "ethers";
import {expect} from "chai";
import {deploySdtStakingFixture, increaseCvgCycle} from "../../../../fixtures/fixtures";
import {IContractsUser, IUsers} from "../../../../../utils/contractInterface";
import {GaugeController} from "../../../../../typechain-types-vyper/GaugeController";
import {
    ERC20,
    ISdAssetGauge,
    SdtBlackHole,
    SdtBuffer,
    SdtRewardReceiver,
    SdtStakingPositionService,
    LockingPositionService,
    Cvg,
} from "../../../../../typechain-types";
import {CYCLE_2, CYCLE_3, CYCLE_4, CYCLE_5, TOKEN_1, TOKEN_4} from "../../../../../resources/constant";
import {takesGaugeOwnershipAndSetDistributor} from "../../../../../utils/stakeDao/takesGaugeOwnershipAndSetDistributor";
import {distributeGaugeRewards} from "../../../../../utils/stakeDao/distributeGaugeRewards";
import {getExpectedCvgSdtRewards} from "../../../../../utils/stakeDao/getStakingShareForCycle";

describe("SdtStaking - Claim  CvgSdt after a cycle triggered for CVG without processing SDT.", () => {
    let contractsUsers: IContractsUser, users: IUsers;
    let owner: Signer, user1: Signer, user2: Signer;
    let gaugeController: GaugeController, lockingPositionService: LockingPositionService;
    let cvg: Cvg, sdt: ERC20, crv: ERC20, _3crv: ERC20;
    let sdCRVStaking: SdtStakingPositionService, sdCrvGauge: ISdAssetGauge, sdCRVBuffer: SdtBuffer, sdtRewardReceiver: SdtRewardReceiver;
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
        sdtRewardReceiver = contractsUsers.contracts.stakeDao.sdtRewardReceiver;

        cvg = tokens.cvg;
        sdt = tokens.sdt;
        crv = tokens.crv;
        _3crv = tokens._3crv;

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

    it("Success : Takes the ownership of the gauge contract and set reward distributor", async () => {
        await takesGaugeOwnershipAndSetDistributor(sdCrvGauge, owner);
    });

    it("Success : Distributes gauges rewards for cycle 2", async () => {
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

    it("Succees : Go to Cycle 3", async () => {
        await increaseCvgCycle(contractsUsers, 2);
    });

    it("Succees : processSdt rewards for cycle 2.", async () => {
        await sdCRVStaking.processSdtRewards();
    });

    it("Succees : claimCvgSdt for cycle 2", async () => {
        const cycle2RewardsExpected = await getExpectedCvgSdtRewards(sdCRVStaking, TOKEN_4, CYCLE_2);

        const claimTx = sdCRVStaking.connect(user1).claimCvgSdtRewards(TOKEN_4, false, false);

        await expect(claimTx).changeTokenBalance(cvg, user1, cycle2RewardsExpected[0]);
        await expect(claimTx).changeTokenBalances(sdt, [sdtRewardReceiver, user1], [-cycle2RewardsExpected[1], cycle2RewardsExpected[1]]);
        await expect(claimTx).changeTokenBalances(_3crv, [sdtRewardReceiver, user1], [-cycle2RewardsExpected[2], cycle2RewardsExpected[2]]);
        await expect(claimTx).changeTokenBalances(crv, [sdtRewardReceiver, user1], [-cycle2RewardsExpected[3], cycle2RewardsExpected[3]]);
        expect(await sdCRVStaking.lastClaims(TOKEN_4)).to.be.deep.eq([CYCLE_3, CYCLE_3]);
    });

    it("Success : Distributes gauges rewards for cycle 3", async () => {
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

    it("Succees : Go to Cycle 4", async () => {
        await increaseCvgCycle(contractsUsers, 1);
    });
    it("Success : processSdt rewards for cycle 3.", async () => {
        await sdCRVStaking.processSdtRewards();
    });

    it("Success : Distributes gauges rewards for cycle 3", async () => {
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

    it("Success : Go to Cycle 5", async () => {
        await increaseCvgCycle(contractsUsers, 1);
        expect(await sdCRVStaking.stakingCycle()).to.be.equal(CYCLE_5);
    });
    it("Success : claimCvgSdt for cycle 3 on Sdt rewards & Cycle 3 & 4 on Cvg because processSdtRewards of cycle 4 is not done yet.", async () => {
        const cycle3RewardsExpected = await getExpectedCvgSdtRewards(sdCRVStaking, TOKEN_4, CYCLE_3);
        const cycle4RewardsExpected = await getExpectedCvgSdtRewards(sdCRVStaking, TOKEN_4, CYCLE_4);

        const claimTx = sdCRVStaking.connect(user1).claimCvgSdtRewards(TOKEN_4, false, false);

        await expect(claimTx).changeTokenBalance(cvg, user1, cycle3RewardsExpected[0] + cycle4RewardsExpected[0]);
        await expect(claimTx).changeTokenBalances(sdt, [sdtRewardReceiver, user1], [-cycle3RewardsExpected[1], cycle3RewardsExpected[1]]);
        await expect(claimTx).changeTokenBalances(_3crv, [sdtRewardReceiver, user1], [-cycle3RewardsExpected[2], cycle3RewardsExpected[2]]);
        await expect(claimTx).changeTokenBalances(crv, [sdtRewardReceiver, user1], [-cycle3RewardsExpected[3], cycle3RewardsExpected[3]]);
        expect(await sdCRVStaking.lastClaims(TOKEN_4)).to.be.deep.eq([CYCLE_5, CYCLE_4]);
    });

    it("Success : processSdt rewards for cycle 4.", async () => {
        await sdCRVStaking.processSdtRewards();
    });

    it("Success : claimCvgSdt for cycle 4 ONLY for Sdt rewards, Cycle 4 for CVG already claimed before", async () => {
        const cycle4RewardsExpected = await getExpectedCvgSdtRewards(sdCRVStaking, TOKEN_4, CYCLE_4);

        const claimTx = sdCRVStaking.connect(user1).claimCvgSdtRewards(TOKEN_4, false, false);

        await expect(claimTx).changeTokenBalance(cvg, user1, 0);
        await expect(claimTx).changeTokenBalances(sdt, [sdtRewardReceiver, user1], [-cycle4RewardsExpected[1], cycle4RewardsExpected[1]]);
        await expect(claimTx).changeTokenBalances(_3crv, [sdtRewardReceiver, user1], [-cycle4RewardsExpected[2], cycle4RewardsExpected[2]]);
        await expect(claimTx).changeTokenBalances(crv, [sdtRewardReceiver, user1], [-cycle4RewardsExpected[3], cycle4RewardsExpected[3]]);
        expect(await sdCRVStaking.lastClaims(TOKEN_4)).to.be.deep.eq([CYCLE_5, CYCLE_5]);
    });

    it("Fails : claimCvgSdt for cycle 4 only", async () => {
        await sdCRVStaking.connect(user1).claimCvgSdtRewards(TOKEN_4, false, false).should.be.revertedWith("ALL_SDT_CLAIMED_FOR_NOW");
    });

    it("Fails : Cvg has already being claimed for cycle 4.", async () => {
        await sdCRVStaking.connect(user1).claimCvgRewards(TOKEN_4).should.be.revertedWith("ALL_CVG_CLAIMED_FOR_NOW");
    });
});
