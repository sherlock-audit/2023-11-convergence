import {expect} from "chai";
import {ethers} from "hardhat";
import {loadFixture} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import {Signer} from "ethers";
import {MINT, TOKEN_4, TOKEN_6, TOKEN_5} from "../../../../../resources/constant";
import {SdtStakingPositionService, ERC20, CvgSDT} from "../../../../../typechain-types";
import {IContractsUser} from "../../../../../utils/contractInterface";
import {deploySdtStakingFixture, increaseCvgCycle} from "../../../../fixtures/fixtures";

describe("cvgSdtStaking - tokenTotalStaked", () => {
    let contractsUsers: IContractsUser;
    let owner: Signer, user1: Signer, user2: Signer;
    let cvgSdtStakingContract: SdtStakingPositionService;
    let sdt: ERC20, cvgSdt: CvgSDT;

    before(async () => {
        contractsUsers = await loadFixture(deploySdtStakingFixture);

        const contracts = contractsUsers.contracts;
        const users = contractsUsers.users;

        owner = users.owner;
        user1 = users.user1;
        user2 = users.user2;

        cvgSdtStakingContract = contracts.stakeDao.cvgSdtStaking;

        cvgSdt = contracts.tokens.cvgSdt;
        sdt = contracts.tokens.sdt;

        await sdt.approve(cvgSdt, ethers.MaxUint256);

        // mint cvgSdt
        await cvgSdt.mint(owner, ethers.parseEther("30000"));

        // transfer cvgSdt to users
        await cvgSdt.transfer(user1, ethers.parseEther("10000"));
        await cvgSdt.transfer(user2, ethers.parseEther("10000"));

        // approve toke spending from staking contract
        await cvgSdt.connect(user1).approve(cvgSdtStakingContract, ethers.MaxUint256);
        await cvgSdt.connect(user2).approve(cvgSdtStakingContract, ethers.MaxUint256);

        // deposit for user1 and user2
        await cvgSdtStakingContract.connect(user1).deposit(MINT, ethers.parseEther("5000"), ethers.ZeroAddress);
        await cvgSdtStakingContract.connect(user2).deposit(MINT, ethers.parseEther("5000"), ethers.ZeroAddress);
    });

    it("Success : Checking staked amount for user1", async () => {
        expect(await cvgSdtStakingContract.tokenTotalStaked(TOKEN_4)).to.be.equal(ethers.parseEther("5000"));
    });

    it("Success : Checking staked amount for non-user", async () => {
        expect(await cvgSdtStakingContract.tokenTotalStaked(TOKEN_6)).to.be.equal(0);
    });

    it("Success : Checking staked amount for user2", async () => {
        expect(await cvgSdtStakingContract.tokenTotalStaked(TOKEN_5)).to.be.equal(ethers.parseEther("5000"));
    });

    it("Success : Withdrawing and checking staked amount for user2", async () => {
        await cvgSdtStakingContract.connect(user2).withdraw(TOKEN_5, ethers.parseEther("2000"));
        expect(await cvgSdtStakingContract.tokenTotalStaked(TOKEN_5)).to.be.equal(ethers.parseEther("3000"));
    });

    it("Success : Updating staking cycle to 5", async () => {
        await increaseCvgCycle(contractsUsers, 4);
    });

    it("Success : Checking staked amount for users", async () => {
        expect(await cvgSdtStakingContract.tokenTotalStaked(TOKEN_4)).to.be.equal(ethers.parseEther("5000"));
        expect(await cvgSdtStakingContract.tokenTotalStaked(TOKEN_5)).to.be.equal(ethers.parseEther("3000"));
    });
});
