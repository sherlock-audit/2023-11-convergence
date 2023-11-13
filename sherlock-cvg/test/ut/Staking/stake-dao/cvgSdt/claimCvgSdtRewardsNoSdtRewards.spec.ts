import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {ethers} from "hardhat";
import {Signer} from "ethers";
import {expect} from "chai";

import {ERC20} from "../../../../../typechain-types/@openzeppelin/contracts/token/ERC20";
import {Cvg, CvgSDT} from "../../../../../typechain-types/contracts/Token";
import {deploySdtStakingFixture, increaseCvgCycle} from "../../../../fixtures/fixtures";
import {LockingPositionService} from "../../../../../typechain-types/contracts/Locking";
import {IContractsUser} from "../../../../../utils/contractInterface";
import {GaugeController} from "../../../../../typechain-types-vyper/GaugeController";
import {SdtStakingPositionService} from "../../../../../typechain-types";
import {CYCLE_2, CYCLE_3, MINT, TOKEN_4, TOKEN_5} from "../../../../../resources/constant";

describe("cvgSdtStaking - Claim CvgSdt Rewards without Sdt rewards ", () => {
    let contractsUsers: IContractsUser;
    let owner: Signer, user1: Signer, user2: Signer, user3: Signer, veSdtMultisig: Signer;
    let cvgSdtStakingContract: SdtStakingPositionService, gaugeController: GaugeController, lockingPositionService: LockingPositionService;
    let sdt: ERC20, cvg: Cvg, cvgSdt: CvgSDT;

    let depositedAmountToken4 = ethers.parseEther("5000"),
        depositedAmountToken5 = ethers.parseEther("100000"),
        withdrawAmount = ethers.parseEther("4000");
    before(async () => {
        contractsUsers = await loadFixture(deploySdtStakingFixture);

        const users = contractsUsers.users;
        const contracts = contractsUsers.contracts;
        const stakeDao = contracts.stakeDao;
        const tokens = contracts.tokens;

        owner = users.owner;
        user1 = users.user1;
        user2 = users.user2;
        user3 = users.user3;
        veSdtMultisig = users.veSdtMultisig;

        cvgSdtStakingContract = stakeDao.cvgSdtStaking;

        gaugeController = contracts.locking.gaugeController;
        lockingPositionService = contracts.locking.lockingPositionService;
        cvg = tokens.cvg;
        cvgSdt = tokens.cvgSdt;
        sdt = tokens.sdt;

        // mint locking position and vote for cvgSdtStaking gauge
        await cvg.approve(lockingPositionService, ethers.parseEther("300000"));
        await lockingPositionService.mintPosition(47, ethers.parseEther("100000"), 0, owner, true);
        await gaugeController.simple_vote(5, cvgSdtStakingContract, 1000);
        await sdt.approve(cvgSdt, ethers.MaxUint256);

        // mint cvgSdt
        await cvgSdt.mint(owner, ethers.parseEther("4000000"));

        // transfer cvgSdt to users
        await cvgSdt.transfer(user1, ethers.parseEther("1000000"));
        await cvgSdt.transfer(user2, ethers.parseEther("1000000"));
        await cvgSdt.transfer(user3, ethers.parseEther("1000000"));
        await cvgSdt.transfer(veSdtMultisig, ethers.parseEther("1000000"));
        // approve cvgSdt spending from staking contract
        await cvgSdt.connect(user1).approve(cvgSdtStakingContract, ethers.MaxUint256);
        await cvgSdt.connect(user2).approve(cvgSdtStakingContract, ethers.MaxUint256);
        await cvgSdt.connect(user3).approve(cvgSdtStakingContract, ethers.MaxUint256);

        // deposit for user1 and user2
        await cvgSdtStakingContract.connect(user1).deposit(MINT, depositedAmountToken4, ethers.ZeroAddress);
        await cvgSdtStakingContract.connect(user2).deposit(MINT, depositedAmountToken5, ethers.ZeroAddress);
        await cvgSdtStakingContract.connect(user3).deposit(MINT, depositedAmountToken5, ethers.ZeroAddress);
        await cvgSdtStakingContract.connect(user3).withdraw(6, depositedAmountToken5);
    });

    it("Success : Processing rewards & Updating cvg cycle to 1", async () => {
        await increaseCvgCycle(contractsUsers, 1);
        expect(await cvgSdtStakingContract.stakingCycle()).to.be.equal(CYCLE_2);
    });

    it("Success : Withdrawing user2 at cycle 2", async () => {
        await cvgSdtStakingContract.connect(user2).withdraw(TOKEN_5, withdrawAmount);
        expect(await cvgSdtStakingContract.stakingHistoryByToken(TOKEN_5, 0)).to.be.eq(CYCLE_2);
        expect(await cvgSdtStakingContract.tokenInfoByCycle(CYCLE_2, TOKEN_5)).to.be.deep.eq([depositedAmountToken5 - withdrawAmount, depositedAmountToken5]);
        expect(await cvgSdtStakingContract.tokenInfoByCycle(CYCLE_3, TOKEN_5)).to.be.deep.eq([depositedAmountToken5 - withdrawAmount, 0]);
        expect(await cvgSdtStakingContract.cycleInfo(CYCLE_2)).to.be.deep.eq([0, depositedAmountToken4 + depositedAmountToken5 - withdrawAmount, false, false]);
        expect(await cvgSdtStakingContract.cycleInfo(CYCLE_3)).to.be.deep.eq([0, depositedAmountToken4 + depositedAmountToken5 - withdrawAmount, false, false]);
    });

    it("Success : Processing rewards & update cvg cycle to 3 should compute right infos", async () => {
        await increaseCvgCycle(contractsUsers, 1);
        expect(await cvgSdtStakingContract.stakingCycle()).to.be.equal(CYCLE_3);
    });

    it("Fails : claimMultipleCvgRewards cycle 2 without sdt rewards should revert ", async () => {
        await cvgSdtStakingContract.connect(user1).claimCvgSdtRewards(TOKEN_4, false, false).should.be.revertedWith("NO_SDT_REWARDS_CLAIMABLE");
        await cvgSdtStakingContract.connect(user2).claimCvgSdtRewards(TOKEN_5, false, false).should.be.revertedWith("NO_SDT_REWARDS_CLAIMABLE");
    });
});
