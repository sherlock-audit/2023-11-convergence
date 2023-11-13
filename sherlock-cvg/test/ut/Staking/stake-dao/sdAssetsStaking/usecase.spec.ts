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
import {CYCLE_2, CYCLE_3, CYCLE_4, CYCLE_5, CYCLE_6, MINT, TOKEN_4, TOKEN_5} from "../../../../../resources/constant";

describe("CvgSdtStaking - Claim CvgSdt Rewards ", () => {
    let contractsUsers: IContractsUser;
    let owner: Signer, user1: Signer, user2: Signer, veSdtMultisig: Signer;
    let cvgSdtStakingContract: SdtStakingPositionService, gaugeController: GaugeController, lockingPositionService: LockingPositionService;
    let sdt: ERC20, cvg: Cvg, cvgSdt: CvgSDT;

    before(async () => {
        contractsUsers = await loadFixture(deploySdtStakingFixture);

        const users = contractsUsers.users;
        const contracts = contractsUsers.contracts;
        const stakeDao = contracts.stakeDao;
        const tokens = contracts.tokens;

        owner = users.owner;
        user1 = users.user1;
        user2 = users.user2;
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
        await cvgSdt.mint(owner, ethers.parseEther("3000000"));

        // transfer cvgSdt to users
        await cvgSdt.transfer(user1, ethers.parseEther("1000000"));
        await cvgSdt.transfer(user2, ethers.parseEther("1000000"));
        await cvgSdt.transfer(veSdtMultisig, ethers.parseEther("1000000"));
        // approve cvgSdt spending from staking contract
        await cvgSdt.connect(user1).approve(cvgSdtStakingContract, ethers.MaxUint256);
        await cvgSdt.connect(user2).approve(cvgSdtStakingContract, ethers.MaxUint256);
    });
    it("Success : Staking / Withdraw on cycle 1", async () => {
        //user1
        await cvgSdtStakingContract.connect(user1).deposit(MINT, ethers.parseEther("1000"), ethers.ZeroAddress); //Id 4
        await cvgSdtStakingContract.connect(user1).deposit(TOKEN_4, ethers.parseEther("500"), ethers.ZeroAddress);
        await cvgSdtStakingContract.connect(user1).deposit(TOKEN_4, ethers.parseEther("2000"), ethers.ZeroAddress);
        await cvgSdtStakingContract.connect(user1).withdraw(TOKEN_4, ethers.parseEther("400"));
        await cvgSdtStakingContract.connect(user1).withdraw(TOKEN_4, ethers.parseEther("600"));
        await cvgSdtStakingContract.connect(user1).deposit(TOKEN_4, ethers.parseEther("500"), ethers.ZeroAddress);
        // 3,000 Pending

        //user2
        await cvgSdtStakingContract.connect(user2).deposit(MINT, ethers.parseEther("2000"), ethers.ZeroAddress); //Id 5
        await cvgSdtStakingContract.connect(user2).withdraw(TOKEN_5, ethers.parseEther("300"));
        await cvgSdtStakingContract.connect(user2).withdraw(TOKEN_5, ethers.parseEther("450"));
        await cvgSdtStakingContract.connect(user2).deposit(TOKEN_5, ethers.parseEther("800"), ethers.ZeroAddress);
        await cvgSdtStakingContract.connect(user2).deposit(TOKEN_5, ethers.parseEther("800"), ethers.ZeroAddress);
        await cvgSdtStakingContract.connect(user2).withdraw(TOKEN_5, ethers.parseEther("1000"));

        // 1,850  Pending
    });
    it("Success : Go to cycle 2 !", async () => {
        await increaseCvgCycle(contractsUsers, 1);
        expect(await cvgSdtStakingContract.stakingCycle()).to.be.equal(CYCLE_2);
    });
    it("Success : Staking / Withdraw on cycle 2", async () => {
        //user1
        await cvgSdtStakingContract.connect(user1).deposit(TOKEN_4, ethers.parseEther("1000"), ethers.ZeroAddress);
        await cvgSdtStakingContract.connect(user1).withdraw(TOKEN_4, ethers.parseEther("2000"));
        // 1,000  Staked /  1,000 are pending

        //user2
        await cvgSdtStakingContract.connect(user2).withdraw(TOKEN_5, ethers.parseEther("500"));
        await cvgSdtStakingContract.connect(user2).withdraw(TOKEN_5, ethers.parseEther("600"));
        await cvgSdtStakingContract.connect(user2).deposit(TOKEN_5, ethers.parseEther("2000"), ethers.ZeroAddress);
        await cvgSdtStakingContract.connect(user2).deposit(TOKEN_5, ethers.parseEther("800"), ethers.ZeroAddress);
        // 750  Staked / 2,800 are pending
    });
    it("Success : Go to cycle 3 !", async () => {
        await increaseCvgCycle(contractsUsers, 1);
        expect(await cvgSdtStakingContract.stakingCycle()).to.be.equal(CYCLE_3);
    });
    it("Success : Staking / Withdraw on cycle 3", async () => {
        //user1
        await cvgSdtStakingContract.connect(user1).withdraw(TOKEN_4, ethers.parseEther("500"));
        await cvgSdtStakingContract.connect(user1).withdraw(TOKEN_4, ethers.parseEther("1500"));
        // 0 Staked / 0 Pending
        await cvgSdtStakingContract.connect(user1).deposit(TOKEN_4, ethers.parseEther("1000"), ethers.ZeroAddress);
        await cvgSdtStakingContract.connect(user1).deposit(TOKEN_4, ethers.parseEther("400"), ethers.ZeroAddress);
        await cvgSdtStakingContract.connect(user1).deposit(TOKEN_4, ethers.parseEther("1000"), ethers.ZeroAddress);
        await cvgSdtStakingContract.connect(user1).deposit(TOKEN_4, ethers.parseEther("200"), ethers.ZeroAddress);
        // 0 Staked / 2,600 Pending

        //user2
        await cvgSdtStakingContract.connect(user2).deposit(TOKEN_5, ethers.parseEther("200"), ethers.ZeroAddress);
        await cvgSdtStakingContract.connect(user2).withdraw(TOKEN_5, ethers.parseEther("1000"));
        await cvgSdtStakingContract.connect(user2).withdraw(TOKEN_5, ethers.parseEther("800"));
        await cvgSdtStakingContract.connect(user2).withdraw(TOKEN_5, ethers.parseEther("600"));
        await cvgSdtStakingContract.connect(user2).withdraw(TOKEN_5, ethers.parseEther("1000"));
        // 50 Staked / 0 Pending
    });

    it("Success : Claim in cycle 3 the cycle 2 for both positions & Verify balance change", async () => {
        await expect(cvgSdtStakingContract.connect(user1).claimCvgRewards(TOKEN_4)).to.changeTokenBalance(cvg, user1, "25964623611682434861826");
        await expect(cvgSdtStakingContract.connect(user2).claimCvgRewards(TOKEN_5)).to.changeTokenBalance(cvg, user2, "9736733854380913073185");
    });

    it("Success : Go to cycle 4 !", async () => {
        await increaseCvgCycle(contractsUsers, 1);
        expect(await cvgSdtStakingContract.stakingCycle()).to.be.equal(CYCLE_4);
    });

    it("Fails : Claim in cycle 4 the cycle 3 for Token 4 that was at 0 on cycle 3", async () => {
        await cvgSdtStakingContract.connect(user1).claimCvgRewards(TOKEN_4).should.be.revertedWith("NO_CVG_TO_CLAIM");
    });

    it("Success : Claim in cycle 4 the cycle 3 for Token 5", async () => {
        await expect(cvgSdtStakingContract.connect(user2).claimCvgRewards(TOKEN_5)).to.changeTokenBalance(cvg, user2, "35768357305071914750811");
    });

    it("Success : Go to cycle 5 !", async () => {
        await increaseCvgCycle(contractsUsers, 1);
        expect(await cvgSdtStakingContract.stakingCycle()).to.be.equal(CYCLE_5);
    });

    it("Success : Staking / Withdraw on cycle 5", async () => {
        //user1
        await cvgSdtStakingContract.connect(user1).withdraw(TOKEN_4, ethers.parseEther("500"));
        await cvgSdtStakingContract.connect(user1).deposit(TOKEN_4, ethers.parseEther("400"), ethers.ZeroAddress);
        await cvgSdtStakingContract.connect(user1).deposit(TOKEN_4, ethers.parseEther("1200"), ethers.ZeroAddress);
        await cvgSdtStakingContract.connect(user1).withdraw(TOKEN_4, ethers.parseEther("1400"));
        await cvgSdtStakingContract.connect(user1).withdraw(TOKEN_4, ethers.parseEther("200"));
        //user2
        await cvgSdtStakingContract.connect(user2).deposit(TOKEN_5, ethers.parseEther("100"), ethers.ZeroAddress);
        await cvgSdtStakingContract.connect(user2).deposit(TOKEN_5, ethers.parseEther("400"), ethers.ZeroAddress);
        await cvgSdtStakingContract.connect(user2).withdraw(TOKEN_5, ethers.parseEther("600"));
        await cvgSdtStakingContract.connect(user2).deposit(TOKEN_5, ethers.parseEther("1000"), ethers.ZeroAddress);
    });

    it("Success : Claim in cycle 5 the cycle 4 for both positions  & Verify balance change", async () => {
        await expect(cvgSdtStakingContract.connect(user1).claimCvgRewards(TOKEN_4)).to.changeTokenBalance(cvg, user1, "31585313118767617717433");
        await expect(cvgSdtStakingContract.connect(user2).claimCvgRewards(TOKEN_5)).to.changeTokenBalance(cvg, user2, "4251869073680256231192");
    });

    it("Success : Go to cycle 6 !", async () => {
        await increaseCvgCycle(contractsUsers, 1);
        expect(await cvgSdtStakingContract.stakingCycle()).to.be.equal(CYCLE_6);
    });

    it("Success : Claim in cycle 6 the cycle 5 for both positions & Verify balance change", async () => {
        await expect(cvgSdtStakingContract.connect(user1).claimCvgRewards(TOKEN_4)).to.changeTokenBalance(cvg, user1, "32087917544358865754182");
        await expect(cvgSdtStakingContract.connect(user2).claimCvgRewards(TOKEN_5)).to.changeTokenBalance(cvg, user2, "3819990183852245923116");
    });
});
