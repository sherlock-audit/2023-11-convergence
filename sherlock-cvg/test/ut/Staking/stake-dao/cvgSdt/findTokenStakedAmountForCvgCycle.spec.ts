import {expect} from "chai";
import {ethers} from "hardhat";
import {Signer} from "ethers";
import {loadFixture} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import {MINT, TOKEN_4, CYCLE_1, CYCLE_2, TOKEN_6, TOKEN_5, CYCLE_3, CYCLE_4, CYCLE_5, CYCLE_6} from "../../../../../resources/constant";
import {SdtStakingPositionService, CvgSDT, ERC20} from "../../../../../typechain-types";
import {IContracts, IUsers} from "../../../../../utils/contractInterface";
import {deploySdtStakingFixture, increaseCvgCycle} from "../../../../fixtures/fixtures";

describe("cvgSdtStaking - find NFT Staked Amount For CVG Cycle", () => {
    let owner: Signer, user1: Signer, user2: Signer;
    let cvgSdtStakingContract: SdtStakingPositionService;
    let cvgSdt: CvgSDT, sdt: ERC20;
    let veSdtMultisig: Signer;

    let contracts: IContracts, users: IUsers;

    before(async () => {
        const contractUsers = await loadFixture(deploySdtStakingFixture);

        contracts = contractUsers.contracts;
        users = contractUsers.users;

        owner = users.owner;
        user1 = users.user1;
        user2 = users.user2;
        veSdtMultisig = users.veSdtMultisig;

        cvgSdtStakingContract = contracts.stakeDao.cvgSdtStaking;

        cvgSdt = contracts.tokens.cvgSdt;
        sdt = contracts.tokens.sdt;
        await sdt.approve(cvgSdt, ethers.MaxUint256);
        // mint cvgSdt
        await cvgSdt.mint(owner, ethers.parseEther("30000"));

        // transfer sdt to users
        await cvgSdt.transfer(user1, ethers.parseEther("10000"));
        await cvgSdt.transfer(user2, ethers.parseEther("10000"));

        // approve sdt spending from staking contract
        await cvgSdt.connect(user1).approve(cvgSdtStakingContract, ethers.MaxUint256);
        await cvgSdt.connect(user2).approve(cvgSdtStakingContract, ethers.MaxUint256);

        const balanceOfSdtOwner = await sdt.balanceOf(owner);
        await sdt.approve(veSdtMultisig, balanceOfSdtOwner);
        await sdt.transfer(veSdtMultisig, balanceOfSdtOwner);

        // deposit for user1 and user2
        await cvgSdtStakingContract.connect(user1).deposit(MINT, ethers.parseEther("5000"), ethers.ZeroAddress);
        await cvgSdtStakingContract.connect(user2).deposit(MINT, ethers.parseEther("5000"), ethers.ZeroAddress);
    });

    it("Success : Returns 0 for cycle 0", async () => {
        expect(await cvgSdtStakingContract.stakedAmountEligibleAtCycle(0, TOKEN_4, CYCLE_1)).to.be.equal(0);
    });

    it("Success : Returns 0 for current cycle", async () => {
        expect(await cvgSdtStakingContract.stakedAmountEligibleAtCycle(CYCLE_1, TOKEN_4, CYCLE_1)).to.be.equal(0);
    });

    it("Success : Returns 0 for unreached cycle", async () => {
        expect(await cvgSdtStakingContract.stakedAmountEligibleAtCycle(CYCLE_2, TOKEN_4, CYCLE_1)).to.be.equal(0);
    });

    it("Success : Go to cycle 2 !", async () => {
        await increaseCvgCycle({contracts, users}, 1);
    });

    it("Success : Returns 0 for a non - existing position", async () => {
        expect(await cvgSdtStakingContract.stakedAmountEligibleAtCycle(CYCLE_1, TOKEN_6, CYCLE_2)).to.be.equal(0);
    });

    it("Success : Withdraw user2, Token 5 ", async () => {
        await cvgSdtStakingContract.connect(user2).withdraw(TOKEN_5, ethers.parseEther("2000"));
    });

    it("Success : Go to cycle 6 !", async () => {
        await increaseCvgCycle({contracts, users}, 4);
    });

    it("Success : Returns eligible amount for rewards.", async () => {
        expect(await cvgSdtStakingContract.stakedAmountEligibleAtCycle(CYCLE_2, TOKEN_4, CYCLE_5)).to.be.equal(ethers.parseEther("5000"));
        expect(await cvgSdtStakingContract.stakedAmountEligibleAtCycle(CYCLE_2, TOKEN_5, CYCLE_5)).to.be.equal(ethers.parseEther("3000"));
    });

    it("Success : Check eligible amount for all past cycles", async () => {
        const amount_user1 = ethers.parseEther("5000");
        const amount_user2 = ethers.parseEther("3000");

        // TOKEN 1
        expect(await cvgSdtStakingContract.stakedAmountEligibleAtCycle(CYCLE_1, TOKEN_4, CYCLE_6)).to.be.equal(0);
        expect(await cvgSdtStakingContract.stakedAmountEligibleAtCycle(CYCLE_2, TOKEN_4, CYCLE_6)).to.be.equal(amount_user1);
        expect(await cvgSdtStakingContract.stakedAmountEligibleAtCycle(CYCLE_3, TOKEN_4, CYCLE_6)).to.be.equal(amount_user1);
        expect(await cvgSdtStakingContract.stakedAmountEligibleAtCycle(CYCLE_4, TOKEN_4, CYCLE_6)).to.be.equal(amount_user1);
        expect(await cvgSdtStakingContract.stakedAmountEligibleAtCycle(CYCLE_5, TOKEN_4, CYCLE_6)).to.be.equal(amount_user1);
        expect(await cvgSdtStakingContract.stakedAmountEligibleAtCycle(CYCLE_6, TOKEN_4, CYCLE_6)).to.be.equal(0);

        // TOKEN 2
        expect(await cvgSdtStakingContract.stakedAmountEligibleAtCycle(CYCLE_1, TOKEN_5, CYCLE_6)).to.be.equal(0);
        expect(await cvgSdtStakingContract.stakedAmountEligibleAtCycle(CYCLE_2, TOKEN_5, CYCLE_6)).to.be.equal(amount_user2);
        expect(await cvgSdtStakingContract.stakedAmountEligibleAtCycle(CYCLE_3, TOKEN_5, CYCLE_6)).to.be.equal(amount_user2);
        expect(await cvgSdtStakingContract.stakedAmountEligibleAtCycle(CYCLE_4, TOKEN_5, CYCLE_6)).to.be.equal(amount_user2);
        expect(await cvgSdtStakingContract.stakedAmountEligibleAtCycle(CYCLE_5, TOKEN_5, CYCLE_6)).to.be.equal(amount_user2);
        expect(await cvgSdtStakingContract.stakedAmountEligibleAtCycle(CYCLE_6, TOKEN_5, CYCLE_6)).to.be.equal(0);
    });
});
