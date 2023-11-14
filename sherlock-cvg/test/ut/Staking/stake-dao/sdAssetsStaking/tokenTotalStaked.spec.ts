import {expect} from "chai";

import {ethers} from "hardhat";
import {loadFixture} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import {Signer} from "ethers";
import {ISdAssetGauge, SdtStakingPositionService} from "../../../../../typechain-types";
import {IContractsUser} from "../../../../../utils/contractInterface";
import {deploySdtStakingFixture, increaseCvgCycle} from "../../../../fixtures/fixtures";

describe("sdAssetStaking - tokenTotalStaked", () => {
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
        await sdCRVStaking.connect(user2).deposit(0, ethers.parseEther("30"), ethers.ZeroAddress);
    });

    it("Check staked amount for user1", async () => {
        expect(await sdCRVStaking.tokenTotalStaked(4)).to.be.equal(ethers.parseEther("10"));
    });

    it("Check staked amount for non-user", async () => {
        expect(await sdCRVStaking.tokenTotalStaked(6)).to.be.equal(0);
    });

    it("Check staked amount for user2", async () => {
        expect(await sdCRVStaking.tokenTotalStaked(5)).to.be.equal(ethers.parseEther("30"));
    });

    it("Withdraw and check staked amount for user2", async () => {
        await sdCRVStaking.connect(user2).withdraw(5, ethers.parseEther("20"));
        expect(await sdCRVStaking.tokenTotalStaked(5)).to.be.equal(ethers.parseEther("10"));
    });

    it("Update staking cycle to 5", async () => {
        await increaseCvgCycle(contractsUsers, 4);
    });

    it("Check staked amount for users", async () => {
        expect(await sdCRVStaking.tokenTotalStaked(4)).to.be.equal(ethers.parseEther("10"));
        expect(await sdCRVStaking.tokenTotalStaked(5)).to.be.equal(ethers.parseEther("10"));
    });
});
