import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {ethers} from "hardhat";
import {Signer} from "ethers";
import {expect} from "chai";

import {ERC20, LockingPositionService, Cvg, CvgSDT} from "../../../../../typechain-types";
import {deploySdtStakingFixture, increaseCvgCycle} from "../../../../fixtures/fixtures";
import {IContractsUser} from "../../../../../utils/contractInterface";
import {GaugeController} from "../../../../../typechain-types-vyper";
import {SdtStakingPositionService} from "../../../../../typechain-types";
import {CYCLE_3, CYCLE_4, CYCLE_5, MINT} from "../../../../../resources/constant";

describe("cvgSdtStaking - Process Sdt Rewards", () => {
    let contractsUsers: IContractsUser;
    let owner: Signer, user1: Signer, user2: Signer, veSdtMultisig: Signer;
    let cvgSdtStakingContract: SdtStakingPositionService, gaugeController: GaugeController, lockingPositionService: LockingPositionService;
    let sdt: ERC20, cvg: Cvg, cvgSdt: CvgSDT, sdFRAX3CRV: ERC20;

    let depositedAmountToken4 = ethers.parseEther("5000"),
        depositedAmountToken5 = ethers.parseEther("100000");

    before(async () => {
        contractsUsers = await loadFixture(deploySdtStakingFixture);

        const users = contractsUsers.users;
        const contracts = contractsUsers.contracts;
        const stakeDao = contracts.stakeDao;
        const tokens = contracts.tokens;
        const tokensStakeDao = contracts.tokensStakeDao;

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
        sdFRAX3CRV = tokensStakeDao.sdFrax3Crv;

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

        // deposit for user1 and user2
        await cvgSdtStakingContract.connect(user1).deposit(MINT, depositedAmountToken4, ethers.ZeroAddress);
        await cvgSdtStakingContract.connect(user2).deposit(MINT, depositedAmountToken5, ethers.ZeroAddress);
    });

    it("Success : Updating cvg cycle to 3", async () => {
        await increaseCvgCycle(contractsUsers, 2);
        expect(await cvgSdtStakingContract.stakingCycle()).to.be.equal(CYCLE_3);
    });

    it("Success : Processing Sdt rewards for cycle 2", async () => {
        //process
        await cvgSdtStakingContract.connect(veSdtMultisig).processSdtRewards();

        const [rewardForCycle] = await cvgSdtStakingContract.getProcessedSdtRewards(2);
        expect(rewardForCycle.token).to.be.equal(await sdFRAX3CRV.getAddress());
        expect(rewardForCycle.amount).to.be.gt(0); //=> amount of SdFRAX3CRV that cannot be determined
    });

    it("Success : Updating cvg cycle to 4", async () => {
        await increaseCvgCycle(contractsUsers, 1);
        expect(await cvgSdtStakingContract.stakingCycle()).to.be.equal(CYCLE_4);
    });

    it("Success : Processing Sdt rewards for cycle 3", async () => {
        //process
        await cvgSdtStakingContract.connect(veSdtMultisig).processSdtRewards();

        const [rewardForCycle] = await cvgSdtStakingContract.getProcessedSdtRewards(3);
        expect(rewardForCycle.token).to.be.equal(await sdFRAX3CRV.getAddress());
        expect(rewardForCycle.amount).to.be.gt(0); //=> amount of SdFRAX3CRV that cannot be determined
    });

    it("Success : Updating cvg cycle to 5", async () => {
        await increaseCvgCycle(contractsUsers, 1);
        expect(await cvgSdtStakingContract.stakingCycle()).to.be.equal(CYCLE_5);
    });

    it("Success : Processing Sdt rewards for cycle 4", async () => {
        //process
        await cvgSdtStakingContract.connect(veSdtMultisig).processSdtRewards();

        const [rewardForCycle] = await cvgSdtStakingContract.getProcessedSdtRewards(4);
        expect(rewardForCycle.token).to.be.equal(await sdFRAX3CRV.getAddress());
        expect(rewardForCycle.amount).to.be.gt(0); //=> amount of SdFRAX3CRV that cannot be determined
    });

    it("Success: No rewards for current cycle (5)", async () => {
        const rewardForCycle = await cvgSdtStakingContract.getProcessedSdtRewards(5);
        expect(rewardForCycle).to.be.empty;
    });
});
