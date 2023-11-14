import {expect} from "chai";
import {Signer} from "ethers";

import {loadFixture} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import {ethers} from "hardhat";
import {ISdAssetGauge, SdtStakingPositionService} from "../../../../../typechain-types";
import {IContractsUser} from "../../../../../utils/contractInterface";
import {deploySdtStakingFixture, increaseCvgCycle} from "../../../../fixtures/fixtures";
import {CYCLE_1, CYCLE_2, CYCLE_3, CYCLE_4, CYCLE_5, CYCLE_6, TOKEN_1, TOKEN_2, TOKEN_4, TOKEN_5} from "../../../../../resources/constant";

describe("sdAssetStaking - find NFT Staked Amount For CVG Cycle", () => {
    let contractsUsers: IContractsUser;
    let user1: Signer, user2: Signer;
    let sdCrvGauge: ISdAssetGauge;

    let sdCRVStaking: SdtStakingPositionService;

    before(async () => {
        contractsUsers = await loadFixture(deploySdtStakingFixture);
        const users = contractsUsers.users;
        const contracts = contractsUsers.contracts;
        user1 = users.user1;
        user2 = users.user2;
        sdCRVStaking = contractsUsers.contracts.stakeDao.sdAssetsStaking.sdCRVStaking;
        sdCrvGauge = contracts.tokensStakeDao.sdCrvGauge;

        // approve weth spending from staking contract
        await sdCrvGauge.connect(user1).approve(sdCRVStaking, ethers.MaxUint256);
        await sdCrvGauge.connect(user2).approve(sdCRVStaking, ethers.MaxUint256);
        // deposit for user1 and user2
        await sdCRVStaking.connect(user1).deposit(0, ethers.parseEther("10"), ethers.ZeroAddress);
        await sdCRVStaking.connect(user2).deposit(0, ethers.parseEther("20"), ethers.ZeroAddress);
    });

    it("Returns 0 for cycle 0", async () => {
        expect(await sdCRVStaking.stakedAmountEligibleAtCycle(0, TOKEN_1, CYCLE_1)).to.be.equal(0);
    });

    it("Returns 0 for current cycle", async () => {
        expect(await sdCRVStaking.stakedAmountEligibleAtCycle(CYCLE_1, TOKEN_1, CYCLE_1)).to.be.equal(0);
    });

    it("Returns 0 for unreached cycle", async () => {
        expect(await sdCRVStaking.stakedAmountEligibleAtCycle(CYCLE_1, TOKEN_2, CYCLE_1)).to.be.equal(0);
    });

    it("Update staking cycles to 2 and processRewards", async () => {
        await increaseCvgCycle(contractsUsers, 1);
    });

    it("Returns 0 for non-user", async () => {
        expect(await sdCRVStaking.stakedAmountEligibleAtCycle(CYCLE_3, TOKEN_1, CYCLE_2)).to.be.equal(0);
    });

    it("Withdraw user2", async () => {
        await sdCRVStaking.connect(user2).withdraw(5, ethers.parseEther("5"));
    });

    it("Update staking cycles to 5 and processRewards", async () => {
        await increaseCvgCycle(contractsUsers, 4);
    });

    it("Returns deposited amount for users", async () => {
        expect(await sdCRVStaking.stakedAmountEligibleAtCycle(CYCLE_2, TOKEN_4, CYCLE_5)).to.be.equal(ethers.parseEther("10"));
        expect(await sdCRVStaking.stakedAmountEligibleAtCycle(CYCLE_2, TOKEN_5, CYCLE_5)).to.be.equal(ethers.parseEther("15"));
    });

    it("Check staked amount for 5 cycles", async () => {
        const amount_user1 = ethers.parseEther("10");
        const amount_user2 = ethers.parseEther("15");

        // TOKEN 1
        expect(await sdCRVStaking.stakedAmountEligibleAtCycle(CYCLE_2, TOKEN_4, CYCLE_6)).to.be.equal(amount_user1);
        expect(await sdCRVStaking.stakedAmountEligibleAtCycle(CYCLE_3, TOKEN_4, CYCLE_6)).to.be.equal(amount_user1);
        expect(await sdCRVStaking.stakedAmountEligibleAtCycle(CYCLE_4, TOKEN_4, CYCLE_6)).to.be.equal(amount_user1);
        expect(await sdCRVStaking.stakedAmountEligibleAtCycle(CYCLE_5, TOKEN_4, CYCLE_6)).to.be.equal(amount_user1);
        expect(await sdCRVStaking.stakedAmountEligibleAtCycle(CYCLE_6, TOKEN_4, CYCLE_6)).to.be.equal(0);

        // TOKEN 2, CYCLE_5
        expect(await sdCRVStaking.stakedAmountEligibleAtCycle(CYCLE_2, TOKEN_5, CYCLE_6)).to.be.equal(amount_user2);
        expect(await sdCRVStaking.stakedAmountEligibleAtCycle(CYCLE_3, TOKEN_5, CYCLE_6)).to.be.equal(amount_user2);
        expect(await sdCRVStaking.stakedAmountEligibleAtCycle(CYCLE_4, TOKEN_5, CYCLE_6)).to.be.equal(amount_user2);
        expect(await sdCRVStaking.stakedAmountEligibleAtCycle(CYCLE_5, TOKEN_5, CYCLE_6)).to.be.equal(amount_user2);
        expect(await sdCRVStaking.stakedAmountEligibleAtCycle(CYCLE_6, TOKEN_5, CYCLE_6)).to.be.equal(0);
    });
});
