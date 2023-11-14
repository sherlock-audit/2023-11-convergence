import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {expect} from "chai";
import {ethers} from "hardhat";

import {Signer} from "ethers";
import {GaugeController, SdtStakingPositionService, Cvg, ISdAssetGauge} from "../../../../../typechain-types";
import {IContractsUser} from "../../../../../utils/contractInterface";
import {deploySdtStakingFixture, increaseCvgCycle} from "../../../../fixtures/fixtures";
import {CYCLE_2, CYCLE_4, CYCLE_5, TOKEN_1, TOKEN_4, TOKEN_5} from "../../../../../resources/constant";
import {getExpectedCvgSdtRewards} from "../../../../../utils/stakeDao/getStakingShareForCycle";

describe("sdAssetStaking - Claim CVG Rewards with several claimable cycle.", () => {
    let contractsUsers: IContractsUser;
    let owner: Signer, user1: Signer, user2: Signer;
    let gaugeController: GaugeController;
    let sdCRVStaking: SdtStakingPositionService;
    let cvg: Cvg, sdCrvGauge: ISdAssetGauge;

    before(async () => {
        contractsUsers = await loadFixture(deploySdtStakingFixture);
        const users = contractsUsers.users;
        const contracts = contractsUsers.contracts;
        const tokensStakeDao = contractsUsers.contracts.tokensStakeDao;

        owner = users.owner;
        user1 = users.user1;
        user2 = users.user2;

        sdCRVStaking = contractsUsers.contracts.stakeDao.sdAssetsStaking.sdCRVStaking;
        sdCrvGauge = contracts.tokensStakeDao.sdCrvGauge;

        sdCrvGauge = tokensStakeDao.sdCrvGauge;
        cvg = contracts.tokens.cvg;

        gaugeController = contracts.locking.gaugeController;

        // mint locking position and vote for cvgSdtStaking gauge
        await cvg.approve(contracts.locking.lockingPositionService, ethers.parseEther("300000"));
        await contracts.locking.lockingPositionService.mintPosition(47, ethers.parseEther("100000"), 0, owner, true);
        await gaugeController.simple_vote(5, sdCRVStaking, 1000);

        // approve weth spending from staking contract
        await sdCrvGauge.connect(user1).approve(sdCRVStaking, ethers.MaxUint256);
        await sdCrvGauge.connect(user2).approve(sdCRVStaking, ethers.MaxUint256);

        // deposit for user1 and user2
        await sdCRVStaking.connect(user1).deposit(0, ethers.parseEther("10"), ethers.ZeroAddress);
        await sdCRVStaking.connect(user2).deposit(0, ethers.parseEther("10"), ethers.ZeroAddress);
    });

    it("Fails : Claim Cvg too early (at cycle 1) should revert", async () => {
        sdCRVStaking.connect(user1).claimCvgRewards(TOKEN_1).should.be.revertedWith("CYCLE_NOT_CLAIMABLE");
    });

    it("Succees : Go to Cycle 2", async () => {
        await increaseCvgCycle(contractsUsers, 1);
        expect(await sdCRVStaking.stakingCycle()).to.be.equal(CYCLE_2);
    });

    it("Success : Withdraw user2 at cycle 2", async () => {
        await sdCRVStaking.connect(user2).withdraw(TOKEN_5, ethers.parseEther("8"));
    });

    it("Fails : Claim on token 4 & 5 should fail, rewards not yet available.", async () => {
        await sdCRVStaking.connect(user1).claimCvgRewards(TOKEN_4).should.be.revertedWith("ALL_CVG_CLAIMED_FOR_NOW");
        await sdCRVStaking.connect(user2).claimCvgRewards(TOKEN_5).should.be.revertedWith("ALL_CVG_CLAIMED_FOR_NOW");
    });

    it("Succees : Go to Cycle 3", async () => {
        await increaseCvgCycle(contractsUsers, 1);
        expect(await sdCRVStaking.stakingCycle()).to.be.equal(3);
    });

    it("Success : Verify getAllClaimableCvgAmount for token 4 & 5 on cycle 2", async () => {
        const [rewardsToken4Cycle2, rewardsToken5Cycle2] = await Promise.all([
            await getExpectedCvgSdtRewards(sdCRVStaking, TOKEN_4, CYCLE_2),
            await getExpectedCvgSdtRewards(sdCRVStaking, TOKEN_5, CYCLE_2),
        ]);
        expect(await sdCRVStaking.connect(user1).getAllClaimableCvgAmount(TOKEN_4)).to.be.eq(rewardsToken4Cycle2[0]);
        expect(await sdCRVStaking.connect(user1).getAllClaimableCvgAmount(TOKEN_5)).to.be.eq(rewardsToken5Cycle2[0]);
    });

    it("Success : Deposit with token 5 at cycle 3.", async () => {
        await sdCRVStaking.connect(user2).deposit(TOKEN_5, ethers.parseEther("6"), ethers.ZeroAddress);
    });

    it("Succees : Go to Cycle 5", async () => {
        await increaseCvgCycle(contractsUsers, 2);
        expect(await sdCRVStaking.stakingCycle()).to.be.equal(CYCLE_5);
    });

    it("Success : ClaimCvgRewards on Token 4 for cycle 2 / 3 / 4, Verify CVG mint", async () => {
        const claimTx = sdCRVStaking.connect(user1).claimCvgRewards(TOKEN_4);
        await expect(claimTx).to.changeTokenBalance(cvg, user1, "32994123988558766839");
    });

    it("Success : ClaimCvgRewards on Token 5 for cycle 2 / 3 / 4, Verify CVG mint", async () => {
        const claimTx = sdCRVStaking.connect(user2).claimCvgRewards(TOKEN_5);
        await expect(claimTx).to.changeTokenBalance(cvg, user2, "13202540737109599570");
    });

    it("reclaim should revert", async () => {
        await sdCRVStaking.connect(user1).claimCvgRewards(TOKEN_4).should.be.revertedWith("ALL_CVG_CLAIMED_FOR_NOW");
        await sdCRVStaking.connect(user2).claimCvgRewards(TOKEN_5).should.be.revertedWith("ALL_CVG_CLAIMED_FOR_NOW");
    });
});
