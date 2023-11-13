import chai from "chai";
import {ethers} from "hardhat";
import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {deployYsDistributorFixture} from "../../fixtures/fixtures";

const expect = chai.expect;
import {time} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import {LockingPositionDelegate, LockingPositionManager, LockingPositionService} from "../../../typechain-types/contracts/Locking";
import {Cvg} from "../../../typechain-types/contracts/Token";

import {PositionLocker} from "../../../typechain-types/contracts/mocks";
import {formatEther, parseEther, Signer} from "ethers";
import {GaugeController} from "../../../typechain-types-vyper/GaugeController";
import {CvgRewards} from "../../../typechain-types";

describe("GaugeController / integration", () => {
    let lockingPositionManagerContract: LockingPositionManager,
        lockingPositionServiceContract: LockingPositionService,
        lockingPositionDelegateContract: LockingPositionDelegate,
        cvgContract: Cvg,
        gaugeControllerContract: GaugeController,
        cvgRewards: CvgRewards,
        positionLocker: PositionLocker,
        getVotingPower: (stakingAddress: string) => Promise<number>;

    let owner: Signer, user1: Signer, user2: Signer, treasuryDao: Signer, veSdtMultisig: Signer;

    const staking1 = "0x385080Bbc63b8D84d579bAEfE6b9677032c5CCac";
    const staking2 = "0x4D85Ccb6284d85f136820287A3737cF10586B825";
    const staking3 = "0xA86Be651E41531a61e10ceE04d1EE93F0Ef962fe";

    const ownerLockAmount = ethers.parseEther("100000");

    getVotingPower = async (stakingAddress: string) => {
        const votingPower = await gaugeControllerContract.get_gauge_weight(stakingAddress);
        return parseFloat(formatEther(votingPower));
    };

    beforeEach(async () => {
        const {contracts, users} = await loadFixture(deployYsDistributorFixture);

        lockingPositionServiceContract = contracts.locking.lockingPositionService;
        lockingPositionManagerContract = contracts.locking.lockingPositionManager;
        lockingPositionDelegateContract = contracts.locking.lockingPositionDelegate;
        cvgContract = contracts.tokens.cvg;
        gaugeControllerContract = contracts.locking.gaugeController;
        positionLocker = contracts.tests.positionLocker;
        cvgRewards = contracts.rewards.cvgRewards;

        owner = users.owner;
        user1 = users.user1;
        user2 = users.user2;
        treasuryDao = users.treasuryDao;
        veSdtMultisig = users.veSdtMultisig;

        // activate the address as Staking contract in the cvgControlTower
        await Promise.all(
            [staking1, staking2, staking3].map(async (staking) => {
                await contracts.base.cvgControlTower.connect(treasuryDao).toggleStakingContract(staking);
            })
        );

        await (await cvgContract.approve(lockingPositionServiceContract, ownerLockAmount * 100n)).wait();
        await (await lockingPositionServiceContract.mintPosition(47, ownerLockAmount, 0, owner, true)).wait(); // VP = 50k
        await (await lockingPositionServiceContract.mintPosition(95, ownerLockAmount, 0, owner, true)).wait(); // VP = 100k
        await (await lockingPositionServiceContract.mintPosition(23, ownerLockAmount * 2n, 0, owner, true)).wait(); // VP = 50k
        await (await cvgContract.transfer(user1, ethers.parseEther("100000"))).wait();
        await (await cvgContract.transfer(user2, ethers.parseEther("100000"))).wait();

        await (await gaugeControllerContract.connect(treasuryDao).add_type("A", "2")).wait();
        await (await gaugeControllerContract.connect(treasuryDao).add_type("B", "1")).wait();
        await (await gaugeControllerContract.connect(treasuryDao).add_type("C", "1")).wait();
    });

    async function createAndActivateGauge(address: string, weight = "10000", type = 0): Promise<void> {
        await (await gaugeControllerContract.connect(treasuryDao).add_gauge(address, type, weight)).wait();
        await (await gaugeControllerContract.connect(treasuryDao).toggle_vote_pause(address)).wait();
    }

    it("FAIL  : adding twice the same gauge should be reverted with GAUGE_ALREADY_ADDED", async () => {
        await (await gaugeControllerContract.connect(treasuryDao).add_gauge(staking1, 0, "10000")).wait();
        await expect(gaugeControllerContract.connect(treasuryDao).add_gauge(staking1, 0, "10000")).to.be.revertedWith("GAUGE_ALREADY_ADDED");
    });

    it("FAIL  : adding a non staking contract should be reverted with NOT_A_STAKING_CONTRACT ", async () => {
        await expect(gaugeControllerContract.connect(treasuryDao).add_gauge(await user2.getAddress(), 0, "10000")).to.be.revertedWith("NOT_A_STAKING_CONTRACT");
    });

    it("FAIL  : set_lock from a non locker  should be reverted with NOT_LOCKER ", async () => {
        await expect(gaugeControllerContract.connect(owner).set_lock(true)).to.be.revertedWith("NOT_LOCKER");
    });

    it("FAIL  : vote on a initial/paused gauged ", async () => {
        await (await gaugeControllerContract.connect(treasuryDao).add_gauge(staking1, 0, "10000")).wait();
        await expect(gaugeControllerContract.simple_vote(1, staking1, "1000")).to.be.revertedWith("VOTE_GAUGE_PAUSED");

        await (await gaugeControllerContract.connect(treasuryDao).toggle_vote_pause(staking1)).wait();
        await expect(gaugeControllerContract.simple_vote(1, staking1, "1000")).not.be.reverted;

        await (await gaugeControllerContract.connect(treasuryDao).toggle_vote_pause(staking1)).wait();
        await expect(gaugeControllerContract.simple_vote(1, staking1, "1000")).to.be.revertedWith("VOTE_GAUGE_PAUSED");
    });

    it("Success : vote : 1 gauge  / equal vote / 1 token   should be equal to 1 ", async () => {
        await createAndActivateGauge(staking1);
        await createAndActivateGauge(staking2);

        await (await gaugeControllerContract.simple_vote(1, staking1, "1000")).wait();
        await (await gaugeControllerContract.simple_vote(1, staking2, "1000")).wait();
        const votingPower1 = await getVotingPower(staking1);
        const votingPower2 = await getVotingPower(staking2);
        expect(Number(votingPower1)).to.be.eq(Number(votingPower2));
    });

    it("Success : vote : 1 gauge  / equal vote / 2 token[1,1] : should be equal to 1", async () => {
        await createAndActivateGauge(staking1);
        await createAndActivateGauge(staking2);

        await (await gaugeControllerContract.simple_vote(1, staking1, "1000")).wait();
        await (await gaugeControllerContract.simple_vote(3, staking2, "1000")).wait();
        const votingPower1 = await getVotingPower(staking1);
        const votingPower2 = await getVotingPower(staking2);
        expect(Number(votingPower1)).to.be.closeTo(Number(votingPower2), 250);
    });

    it("Success : vote : 2 gauge[2,1]  / equal vote / 1 token :  should be equal to 2", async () => {
        await createAndActivateGauge(staking1);
        await createAndActivateGauge(staking2, "10000", 1);

        await (await gaugeControllerContract.simple_vote(1, staking1, "1000")).wait();
        await (await gaugeControllerContract.simple_vote(1, staking2, "1000")).wait();
        const votingPower1 = await getVotingPower(staking1);
        const votingPower2 = await getVotingPower(staking2);

        expect(Number(votingPower1)).to.be.eq(Number(votingPower2) * 2);
    });

    it("Success : vote : 1 gauge  / equal vote / 2 token[2,1] : should be equal to 2", async () => {
        await createAndActivateGauge(staking1);
        await createAndActivateGauge(staking2);

        await (await gaugeControllerContract.simple_vote(2, staking1, "1000")).wait();
        await (await gaugeControllerContract.simple_vote(1, staking2, "1000")).wait();
        const votingPower1 = await getVotingPower(staking1);
        const votingPower2 = await getVotingPower(staking2);
        expect(Number(votingPower1)).to.be.closeTo(Number(votingPower2) * 2, 250);
    });

    it("Success : vote : 2 gauge[2,1]  / equal vote / 2 token[2,1] : should be equal to 4", async () => {
        await createAndActivateGauge(staking1);
        await createAndActivateGauge(staking2, "10000", 1);

        await (await gaugeControllerContract.simple_vote(2, staking1, "1000")).wait();
        await (await gaugeControllerContract.simple_vote(1, staking2, "1000")).wait();
        const votingPower1 = await getVotingPower(staking1);
        const votingPower2 = await getVotingPower(staking2);
        expect(Number(votingPower1)).to.be.closeTo(Number(votingPower2) * 4, 250);
    });

    it("Success : vote : 3 gauge[2,1,1]  / equal vote / 1 token : should be equal to 2 ", async () => {
        await createAndActivateGauge(staking1);
        await createAndActivateGauge(staking2, "10000", 1);
        await createAndActivateGauge(staking3, "10000", 2);

        await (await gaugeControllerContract.simple_vote(1, staking1, "1000")).wait();
        await (await gaugeControllerContract.simple_vote(1, staking2, "1000")).wait();
        await (await gaugeControllerContract.simple_vote(1, staking3, "1000")).wait();

        const votingPower1 = await getVotingPower(staking1);
        const votingPower2 = await getVotingPower(staking2);
        const votingPower3 = await getVotingPower(staking3);
        expect(Number(votingPower1)).to.be.eq(Number(votingPower2) * 2);
        expect(Number(votingPower1)).to.be.eq(Number(votingPower3) * 2);
    });
    it("Success : vote : 1 gauge  / vote[2,1,1] / 1 token : should be equal to 2", async () => {
        await createAndActivateGauge(staking1);
        await createAndActivateGauge(staking2);
        await createAndActivateGauge(staking3);

        await (await gaugeControllerContract.simple_vote(1, staking1, "2000")).wait();
        await (await gaugeControllerContract.simple_vote(1, staking2, "1000")).wait();
        await (await gaugeControllerContract.simple_vote(1, staking3, "1000")).wait();

        const votingPower1 = await getVotingPower(staking1);
        const votingPower2 = await getVotingPower(staking2);
        const votingPower3 = await getVotingPower(staking3);

        expect(Number(votingPower1)).to.be.closeTo(Number(votingPower2) * 2, 0.03);
        expect(Number(votingPower1)).to.be.closeTo(Number(votingPower3) * 2, 0.03);
    });

    it("sucess :  add gauge type", async () => {
        const type1 = await gaugeControllerContract.gauge_type_names(0);
        const type2 = await gaugeControllerContract.gauge_type_names(1);
        const type3 = await gaugeControllerContract.gauge_type_names(2);

        expect(type1).to.be.eq("A");
        expect(type2).to.be.eq("B");
        expect(type3).to.be.eq("C");
    });

    it("Success :  re-voting for same gauge with same params after 10 days should not change gauge weight", async () => {
        await createAndActivateGauge(staking1);
        await createAndActivateGauge(staking2);
        await createAndActivateGauge(staking3);

        await gaugeControllerContract.simple_vote(1, staking1, "5000");
        await gaugeControllerContract.simple_vote(1, staking2, "3000");
        await gaugeControllerContract.simple_vote(1, staking3, "2000");

        await time.increase(10 * 86400);

        await gaugeControllerContract.gauge_relative_weight_write(staking1);

        const weightBeforeVote = await gaugeControllerContract.get_gauge_weight(staking1);
        await gaugeControllerContract.simple_vote(1, staking1, "5000");
        await gaugeControllerContract.simple_vote(1, staking2, "3000");
        await gaugeControllerContract.simple_vote(1, staking3, "2000");

        const weightAfterVote = await gaugeControllerContract.get_gauge_weight(staking1);
        expect(weightBeforeVote).to.be.equal(weightAfterVote);
    });

    it("Fail : re-vote after 10 days with more than 100% in total should revert", async () => {
        await createAndActivateGauge(staking1);
        await createAndActivateGauge(staking3);
        await gaugeControllerContract.simple_vote(1, staking3, "1000");
        await time.increase(10 * 86400);
        await gaugeControllerContract.simple_vote(1, staking3, "1000");
        await expect(gaugeControllerContract.simple_vote(1, staking1, "10000")).to.be.revertedWith("Used too much power");
    });

    it("Fail : re-vote after 10 days with more than 100% in one gauge should revert", async () => {
        await createAndActivateGauge(staking1);
        await createAndActivateGauge(staking3);
        await time.increase(10 * 86400);
        await gaugeControllerContract.simple_vote(1, staking3, "0");
        await expect(gaugeControllerContract.simple_vote(1, staking1, "11000")).to.be.revertedWith("You used all your voting power");
    });

    it("Fail : Tries to vote for gauge with non-owned or non-delegated NFT", async () => {
        await createAndActivateGauge(staking1);
        await expect(gaugeControllerContract.connect(user1).simple_vote(1, staking1, 100)).to.be.revertedWith("TOKEN_NOT_OWNED");
    });

    it("Success : Delegates vote from owner to user2 and votes", async () => {
        await createAndActivateGauge(staking1);
        await lockingPositionDelegateContract.delegateVeCvg(1, user2);
        expect(await gaugeControllerContract.connect(user2).simple_vote(1, staking1, "100")).to.not.throw;
    });

    it("Fail : Kill a gauge if not owner", async () => {
        await createAndActivateGauge(staking1);
        await expect(gaugeControllerContract.connect(user1).kill_gauge(staking1)).to.be.revertedWith("NOT_ADMIN");
    });

    it("Success : Kill a gauge", async () => {
        await createAndActivateGauge(staking1);
        await createAndActivateGauge(staking2);
        await createAndActivateGauge(staking3);
        expect(await gaugeControllerContract.killed_gauges(staking2)).to.be.false;
        expect(await gaugeControllerContract.get_gauge_weight(staking2)).to.be.eq(20000n);
        await gaugeControllerContract.connect(treasuryDao).kill_gauge(staking2);
        expect(await gaugeControllerContract.killed_gauges(staking2)).to.be.true;
        expect(await gaugeControllerContract.get_gauge_weight(staking2)).to.be.eq(0);

        expect(await cvgRewards.gauges(0)).to.be.eq(staking1);
        expect(await cvgRewards.gauges(1)).to.be.eq(staking3);
        await expect(cvgRewards.gauges(2)).to.be.rejected;

        expect(await cvgRewards.gaugesId(staking1)).to.be.eq(0);
        expect(await cvgRewards.gaugesId(staking2)).to.be.eq(0);
        expect(await cvgRewards.gaugesId(staking3)).to.be.eq(1);
    });

    it("Fail : cannot vote with a Timelock token", async () => {
        await createAndActivateGauge(staking2);
        const timestamp = (await ethers.provider.getBlock("latest"))?.timestamp;
        await lockingPositionManagerContract.connect(owner).setLock(1, (timestamp || 0) + 5 * 86400);
        await expect(gaugeControllerContract.connect(owner).simple_vote(1, staking2, "100")).to.be.revertedWith("TOKEN_TIMELOCKED");
    });

    it("Success : Vote  is possible after end of timelock", async () => {
        await createAndActivateGauge(staking2);
        const timestamp = (await ethers.provider.getBlock("latest"))?.timestamp;
        await lockingPositionManagerContract.connect(owner).setLock(1, (timestamp || 0) + 5 * 86400);
        await expect(gaugeControllerContract.connect(owner).simple_vote(1, staking2, "100")).to.be.revertedWith("TOKEN_TIMELOCKED");
        await time.increase(5 * 86400);
        expect(await gaugeControllerContract.connect(owner).simple_vote(1, staking2, "100")).not.throw;
    });

    it("Fail : Vote on a killed gauge", async () => {
        await createAndActivateGauge(staking1);
        await gaugeControllerContract.connect(treasuryDao).kill_gauge(staking1);
        await expect(gaugeControllerContract.simple_vote(1, staking1, "100")).to.be.revertedWith("KILLED_GAUGE");
    });

    it("Success : could Remove votes on a killed gauge", async () => {
        await createAndActivateGauge(staking1);
        expect(gaugeControllerContract.simple_vote(1, staking1, "100")).not.throw;
        await gaugeControllerContract.connect(treasuryDao).kill_gauge(staking1);
        expect(gaugeControllerContract.simple_vote(1, staking1, "0")).not.throw;
    });

    it("Success : Checkpoint on a killed gauge", async () => {
        await createAndActivateGauge(staking1);
        expect(gaugeControllerContract.simple_vote(1, staking1, "100")).not.throw;
        await gaugeControllerContract.connect(treasuryDao).kill_gauge(staking1);
        expect(gaugeControllerContract.gauge_relative_weight_write(staking1)).not.throw;
        expect(await gaugeControllerContract.get_gauge_weight(staking1)).to.be.eq(0);
    });

    it("Success : Vote multiple", async () => {
        await createAndActivateGauge(staking1, "1000");
        await createAndActivateGauge(staking2, "1000");
        await createAndActivateGauge(staking3, "1000");

        await gaugeControllerContract.multi_vote([
            {
                tokenId: "1",
                votes: [
                    {
                        gauge_address: staking2,
                        weight: "1000",
                    },
                    {
                        gauge_address: staking3,
                        weight: "2000",
                    },
                ],
            },
        ]);
        {
            const votingPower1 = await gaugeControllerContract.get_gauge_weight(staking1);
            const votingPower2 = await gaugeControllerContract.get_gauge_weight(staking2);
            const votingPower3 = await gaugeControllerContract.get_gauge_weight(staking3);
            expect(votingPower1).to.be.eq(2000n);
            expect(votingPower3 / votingPower2).to.be.eq(2n);
        }
    });

    it("Fails : Voting on gauge controller if not WL contract NOT_ALLOWED", async () => {
        await createAndActivateGauge(staking2);

        await lockingPositionManagerContract.transferFrom(owner, positionLocker, 3);
        const txFail = positionLocker.voteGauge(3, staking2, 500);
        await expect(txFail).to.be.revertedWith("NOT_ALLOWED");
    });

    it("Success : Voting on gauge controller if WL contract", async () => {
        await createAndActivateGauge(staking2);
        await lockingPositionServiceContract.connect(treasuryDao).toggleContractLocker(positionLocker);
        await lockingPositionManagerContract.transferFrom(owner, positionLocker, 3);
        await expect(positionLocker.voteGauge(3, staking2, 500)).not.to.be.reverted;
    });
});
