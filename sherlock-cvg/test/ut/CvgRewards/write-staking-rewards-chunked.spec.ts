import chai from "chai";
import chaiAsPromised from "chai-as-promised";
chai.use(chaiAsPromised).should();
const expect = chai.expect;
import {zeroAddress} from "@nomicfoundation/ethereumjs-util";
import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {deploySdtStakingFixture, deployYsDistributorFixture, increaseCvgCycle, increaseCvgCycleWithoutTime} from "../../fixtures/fixtures";
import {time} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import {Signer, AddressLike, BigNumberish, parseEther} from "ethers";
import {ethers} from "hardhat";
import {
    SdtStakingPositionService,
    CvgSdtBuffer,
    MockFeeDistributor,
    LockingPositionService,
    ERC20,
    Cvg,
    CvgSDT,
    contracts,
    CvgRewards,
    TestStaking,
    CvgControlTower,
    LockingPositionManager,
} from "../../../typechain-types";
import {IContracts, IContractsUser, IUsers} from "../../../utils/contractInterface";
import {GaugeController} from "../../../typechain-types-vyper/GaugeController";
import {generateRandomMintParams, generateRandomNumbers} from "../../../utils/global/generateRandomNumbers";
import {getGaugeControllerVotes} from "../../../utils/gaugeController/getGaugeControllerState";
import {calcStakingInflation} from "../../../utils/global/computeCvgStakingInflation";

describe("CvgRewards / write staking chunk", function () {
    let contractsUsers: IContractsUser, contracts: IContracts, users: IUsers;
    let owner: Signer, user1: Signer, user2: Signer, veSdtMultisig: Signer, treasuryDao: Signer;
    let cvgSdtStakingContract: SdtStakingPositionService,
        cvgSdtBuffer: CvgSdtBuffer,
        cvgRewards: CvgRewards,
        gaugeController: GaugeController,
        lockingPositionService: LockingPositionService,
        lockingPositionManager: LockingPositionManager,
        cvgControlTower: CvgControlTower;
    let sdt: ERC20, cvg: Cvg, cvgSdt: CvgSDT, sdFRAX3CRV: ERC20;
    let gauges: TestStaking[];

    before(async () => {
        contractsUsers = await loadFixture(deployYsDistributorFixture);
        contracts = contractsUsers.contracts;
        users = contractsUsers.users;

        owner = users.owner;
        user1 = users.user1;
        user2 = users.user2;
        treasuryDao = users.treasuryDao;

        cvgRewards = contracts.rewards.cvgRewards;
        gaugeController = contracts.locking.gaugeController;
        cvgControlTower = contracts.base.cvgControlTower;
        lockingPositionService = contracts.locking.lockingPositionService;
        lockingPositionManager = contracts.locking.lockingPositionManager;

        cvg = contracts.tokens.cvg;

        const TestStakingFactory = await ethers.getContractFactory("TestStaking");
        gauges = [
            await TestStakingFactory.deploy(),
            await TestStakingFactory.deploy(),
            await TestStakingFactory.deploy(),
            await TestStakingFactory.deploy(),
            await TestStakingFactory.deploy(),
            await TestStakingFactory.deploy(),
            await TestStakingFactory.deploy(),
        ];

        await cvg.connect(owner).transfer(user1, parseEther("10000000"));
        await cvg.connect(owner).transfer(user2, parseEther("10000000"));

        await cvg.connect(user1).approve(lockingPositionService, ethers.MaxUint256);
        await cvg.connect(user2).approve(lockingPositionService, ethers.MaxUint256);
    });
    it("Fail: add gauge with random user", async () => {
        await cvgRewards.addGauge(user1).should.be.revertedWith("NOT_GAUGE_CONTROLLER");
    });
    it("Fail: remove gauge with random user", async () => {
        await cvgRewards.removeGauge(user1).should.be.revertedWith("NOT_GAUGE_CONTROLLER");
    });
    it("Fail: initialize ysDistributor", async () => {
        await cvgRewards.initialize(user1).should.be.revertedWith("Initializable: contract is already initialized");
    });

    it("Success : Adding gauge type", async () => {
        const txAddTypeA = await (await gaugeController.connect(treasuryDao).add_type("A", "10")).wait();
        const txAddTypeB = await (await gaugeController.connect(treasuryDao).add_type("B", "15")).wait();
    });

    it("Success : Adding gauges in the Control tower", async () => {
        for (let index = 0; index < gauges.length - 3; index++) {
            const gauge = gauges[index];
            await cvgControlTower.connect(treasuryDao).toggleStakingContract(gauge);
            await gaugeController.connect(treasuryDao).add_gauge(gauge, 0, 0);
            await gaugeController.connect(treasuryDao).toggle_vote_pause(gauge);
            expect(await cvgRewards.gauges(index)).to.be.eq(await gauge.getAddress());
            expect(await cvgRewards.gaugesId(gauge)).to.be.eq(index);
        }

        for (let index = gauges.length - 3; index < gauges.length; index++) {
            const gauge = gauges[index];
            await cvgControlTower.connect(treasuryDao).toggleStakingContract(gauge);
            await gaugeController.connect(treasuryDao).add_gauge(gauge, 1, 0);
            await gaugeController.connect(treasuryDao).toggle_vote_pause(gauge);
            expect(await gaugeController.gauges(index)).to.be.eq(await gauge.getAddress());
            expect(await cvgRewards.gaugesId(gauge)).to.be.eq(index);
        }
    });

    it("Success: Create locking tokens", async () => {
        const CYCLE_1 = 1;
        const lock1 = generateRandomMintParams(CYCLE_1);
        await lockingPositionService.connect(user1).mintPosition(lock1.lockDuration, lock1.amount, lock1.ysPercentage, user1, true);

        const lock2 = generateRandomMintParams(CYCLE_1);
        await lockingPositionService.connect(user1).mintPosition(lock2.lockDuration, lock2.amount, lock2.ysPercentage, user1, true);

        const lock3 = generateRandomMintParams(CYCLE_1);
        await lockingPositionService.connect(user2).mintPosition(lock3.lockDuration, lock3.amount, lock3.ysPercentage, user2, true);

        const lock4 = generateRandomMintParams(CYCLE_1);
        await lockingPositionService.connect(user2).mintPosition(lock4.lockDuration, lock4.amount, lock4.ysPercentage, user2, true);
    });
    const CHUNK_CHECKPOINT = 3;
    const CHUNK_TOTAL_WEIGHT = 6;
    const CHUNK_DISTRIBUTE = 4;

    it("Success: Random voting on gauge sucess voting", async () => {
        for (let i = 1; i < 4; i++) {
            const votesGenerated = generateRandomNumbers(gauges.length);
            const listVotes: {
                gauge_address: AddressLike;
                weight: BigNumberish;
            }[] = [];

            for (let j = 0; j < gauges.length; j++) {
                const gaugeAddress = gauges[j];
                listVotes.push({
                    gauge_address: gaugeAddress,
                    weight: votesGenerated[j],
                });
            }

            await gaugeController.connect(await ethers.getSigner(await lockingPositionManager.ownerOf(i))).multi_vote([{tokenId: i, votes: listVotes}]);
        }
    });

    it("Fails : Changing gauges chunk max size with a random account", async () => {
        await cvgRewards
            .connect(user1)
            .setMaxChunkConfigs({maxChunkCheckpoint: CHUNK_CHECKPOINT, maxLoopSetTotalWeight: CHUNK_TOTAL_WEIGHT, maxChunkDistribute: CHUNK_DISTRIBUTE})
            .should.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Success : Changing gauges chunk max size with treasury DAO multisig", async () => {
        await (
            await cvgRewards
                .connect(treasuryDao)
                .setMaxChunkConfigs({maxChunkCheckpoint: CHUNK_CHECKPOINT, maxLoopSetTotalWeight: CHUNK_TOTAL_WEIGHT, maxChunkDistribute: CHUNK_DISTRIBUTE})
        ).wait();
        const config = await cvgRewards.cvgRewardsConfig();
        expect(config.maxChunkCheckpoint).to.be.equal(CHUNK_CHECKPOINT);
        expect(config.maxLoopSetTotalWeight).to.be.equal(CHUNK_TOTAL_WEIGHT);
        expect(config.maxChunkDistribute).to.be.equal(CHUNK_DISTRIBUTE);
    });

    it("Success : Checks init state of CvgRewards", async () => {
        expect(await cvgRewards.state()).to.be.eq(0);
    });

    it("Fails : Need to wait 7 days to be able to trigger Cvg distribution", async () => {
        await expect(cvgRewards.writeStakingRewards()).to.be.revertedWith("NEED_WAIT_7_DAYS");
    });

    it("Success : Updating first chunk of gauge Weights on CHECKPOINT state", async () => {
        let votesBefore = await getGaugeControllerVotes(gaugeController);

        await time.increase(7 * 86_400);
        await cvgRewards.writeStakingRewards();

        let votesAfter = await getGaugeControllerVotes(gaugeController);

        // Verify that gauges weight are smaller after the checkpoint than before
        for (let index = 0; index < CHUNK_CHECKPOINT; index++) {
            expect(votesBefore.gaugeVotes[index].veCvgAmount).to.be.gt(votesAfter.gaugeVotes[index].veCvgAmount);
        }
        // Verify that gauges weight not checkpointed didn't moove
        for (let index = CHUNK_CHECKPOINT; index < votesAfter.gaugeVotes.length; index++) {
            expect(votesBefore.gaugeVotes[index].veCvgAmount).to.be.eq(votesAfter.gaugeVotes[index].veCvgAmount);
        }

        expect(await cvgRewards.cursor()).to.be.eq(CHUNK_CHECKPOINT);
        expect(await cvgRewards.state()).to.be.eq(0);
        expect(await gaugeController.isLock()).to.be.eq(true);
    });

    it("Success : Updating second chunk of gauge Weights on CHECKPOINT state", async () => {
        let votesBefore = await getGaugeControllerVotes(gaugeController);

        await cvgRewards.writeStakingRewards();

        let votesAfter = await getGaugeControllerVotes(gaugeController);

        // Verify that gauges weight are smaller after the checkpoint than before
        for (let index = CHUNK_CHECKPOINT; index < CHUNK_CHECKPOINT * 2; index++) {
            expect(votesBefore.gaugeVotes[index].veCvgAmount).to.be.gt(votesAfter.gaugeVotes[index].veCvgAmount);
        }
        for (let index = CHUNK_CHECKPOINT * 2; index < votesAfter.gaugeVotes.length; index++) {
            expect(votesBefore.gaugeVotes[index].veCvgAmount).to.be.eq(votesAfter.gaugeVotes[index].veCvgAmount);
        }

        expect(await cvgRewards.cursor()).to.be.eq(CHUNK_CHECKPOINT * 2);
        expect(await cvgRewards.state()).to.be.eq(0);
    });

    it("Success : Updating last chunk of gauge Weights on CHECKPOINT state", async () => {
        let votesBefore = await getGaugeControllerVotes(gaugeController);

        await cvgRewards.writeStakingRewards();

        let votesAfter = await getGaugeControllerVotes(gaugeController);

        // Verify that gauges weight are smaller after the checkpoint than before
        for (let index = CHUNK_CHECKPOINT * 2; index < votesAfter.gaugeVotes.length; index++) {
            expect(votesBefore.gaugeVotes[index].veCvgAmount).to.be.gt(votesAfter.gaugeVotes[index].veCvgAmount);
        }

        expect(await cvgRewards.cursor()).to.be.eq(0);
        expect(await cvgRewards.state()).to.be.eq(1);
    });

    it("Success : Computing TOTAL_WEIGHTS first chunk", async () => {
        await cvgRewards.writeStakingRewards();

        const votes = await getGaugeControllerVotes(gaugeController);

        expect(await cvgRewards.totalWeightLocked()).to.be.eq(votes.gaugeVotes.splice(0, CHUNK_TOTAL_WEIGHT).reduce((acc, val) => acc + val.veCvgAmount, 0n));
        expect(await cvgRewards.cursor()).to.be.eq(CHUNK_TOTAL_WEIGHT);
        expect(await cvgRewards.state()).to.be.eq(1);
        expect(await gaugeController.isLock()).to.be.eq(true);
    });

    it("Success : Computing TOTAL_WEIGHTS last chunk", async () => {
        await cvgRewards.writeStakingRewards();

        const votes = await getGaugeControllerVotes(gaugeController);

        expect(await cvgRewards.totalWeightLocked()).to.be.eq(votes.totalVeCvg);
        expect(await cvgRewards.cursor()).to.be.eq(0);
        expect(await cvgRewards.state()).to.be.eq(2);
        expect(await gaugeController.isLock()).to.be.eq(true);
    });
    const CYCLE_1 = 1;

    it("Success : Performing the DISTRIBUTE for cycle 1 first chunk", async () => {
        await cvgRewards.writeStakingRewards();

        const votes = await getGaugeControllerVotes(gaugeController);

        const cvgInflation = calcStakingInflation(CYCLE_1);
        for (let index = 0; index < CHUNK_DISTRIBUTE; index++) {
            expect(await gauges[index].cvgStakingCycle()).to.be.eq(CYCLE_1 + 1);
            const cycleInfo = await gauges[index].cvgCycleInfo(CYCLE_1);
            expect(cycleInfo.isCvgProcessed).to.be.eq(1);
            expect(cycleInfo.cvgRewardsAmount).to.be.eq((cvgInflation * votes.gaugeVotes[index].veCvgAmount) / votes.totalVeCvg);
        }
        expect(await cvgRewards.cursor()).to.be.eq(CHUNK_DISTRIBUTE);
        expect(await cvgRewards.state()).to.be.eq(2);
        expect(await gaugeController.isLock()).to.be.eq(true);
    });

    it("Success : Performing the DISTRIBUTE for last chunk", async () => {
        await cvgRewards.writeStakingRewards();

        const votes = await getGaugeControllerVotes(gaugeController);

        const cvgInflation = calcStakingInflation(CYCLE_1);
        for (let index = CHUNK_DISTRIBUTE; index < votes.gaugeVotes.length; index++) {
            expect(await gauges[index].cvgStakingCycle()).to.be.eq(CYCLE_1 + 1);
            const cycleInfo = await gauges[index].cvgCycleInfo(CYCLE_1);
            expect(cycleInfo.isCvgProcessed).to.be.eq(1);
            expect(cycleInfo.cvgRewardsAmount).to.be.eq((cvgInflation * votes.gaugeVotes[index].veCvgAmount) / votes.totalVeCvg);
        }
        expect(await cvgRewards.totalWeightLocked()).to.be.eq(0);
        expect(await cvgRewards.cursor()).to.be.eq(0);
        expect(await cvgRewards.state()).to.be.eq(3);
        expect(await gaugeController.isLock()).to.be.eq(true);
    });

    it("Success : Performing the CONTROL_TOWER_SYNC for last chunk", async () => {
        await cvgRewards.writeStakingRewards();

        expect(await cvgControlTower.cvgCycle()).to.be.eq(2);
        expect(await cvgRewards.totalWeightLocked()).to.be.eq(0);
        expect(await cvgRewards.cursor()).to.be.eq(0);
        expect(await cvgRewards.state()).to.be.eq(0);
        expect(await gaugeController.isLock()).to.be.eq(false);
    });

    const CYCLE_2 = 2;
    it("Success : Cycle 2 - Updating first chunk of gauge Weights on CHECKPOINT state", async () => {
        let votesBefore = await getGaugeControllerVotes(gaugeController);

        await time.increase(7 * 86_400);
        await cvgRewards.writeStakingRewards();

        let votesAfter = await getGaugeControllerVotes(gaugeController);

        // Verify that gauges weight are smaller after the checkpoint than before
        for (let index = 0; index < CHUNK_CHECKPOINT; index++) {
            expect(votesBefore.gaugeVotes[index].veCvgAmount).to.be.gt(votesAfter.gaugeVotes[index].veCvgAmount);
        }
        // Verify that gauges weight not checkpointed didn't moove
        for (let index = CHUNK_CHECKPOINT; index < votesAfter.gaugeVotes.length; index++) {
            expect(votesBefore.gaugeVotes[index].veCvgAmount).to.be.eq(votesAfter.gaugeVotes[index].veCvgAmount);
        }

        expect(await cvgRewards.cursor()).to.be.eq(CHUNK_CHECKPOINT);
        expect(await cvgRewards.state()).to.be.eq(0);
        expect(await gaugeController.isLock()).to.be.eq(true);
    });

    it("Success : Cycle 2 - Updating second chunk of gauge Weights on CHECKPOINT state", async () => {
        let votesBefore = await getGaugeControllerVotes(gaugeController);

        await cvgRewards.writeStakingRewards();

        let votesAfter = await getGaugeControllerVotes(gaugeController);

        // Verify that gauges weight are smaller after the checkpoint than before
        for (let index = CHUNK_CHECKPOINT; index < CHUNK_CHECKPOINT * 2; index++) {
            expect(votesBefore.gaugeVotes[index].veCvgAmount).to.be.gt(votesAfter.gaugeVotes[index].veCvgAmount);
        }
        for (let index = CHUNK_CHECKPOINT * 2; index < votesAfter.gaugeVotes.length; index++) {
            expect(votesBefore.gaugeVotes[index].veCvgAmount).to.be.eq(votesAfter.gaugeVotes[index].veCvgAmount);
        }

        expect(await cvgRewards.cursor()).to.be.eq(CHUNK_CHECKPOINT * 2);
        expect(await cvgRewards.state()).to.be.eq(0);
    });

    it("Success : Cycle 2 - Updating last chunk of gauge Weights on CHECKPOINT state", async () => {
        let votesBefore = await getGaugeControllerVotes(gaugeController);

        await cvgRewards.writeStakingRewards();

        let votesAfter = await getGaugeControllerVotes(gaugeController);

        // Verify that gauges weight are smaller after the checkpoint than before
        for (let index = CHUNK_CHECKPOINT * 2; index < votesAfter.gaugeVotes.length; index++) {
            expect(votesBefore.gaugeVotes[index].veCvgAmount).to.be.gt(votesAfter.gaugeVotes[index].veCvgAmount);
        }

        expect(await cvgRewards.cursor()).to.be.eq(0);
        expect(await cvgRewards.state()).to.be.eq(1);
    });

    it("Success : Cycle 2 - Computing TOTAL_WEIGHTS first chunk", async () => {
        await cvgRewards.writeStakingRewards();

        const votes = await getGaugeControllerVotes(gaugeController);

        expect(await cvgRewards.totalWeightLocked()).to.be.eq(votes.gaugeVotes.splice(0, CHUNK_TOTAL_WEIGHT).reduce((acc, val) => acc + val.veCvgAmount, 0n));
        expect(await cvgRewards.cursor()).to.be.eq(CHUNK_TOTAL_WEIGHT);
        expect(await cvgRewards.state()).to.be.eq(1);
        expect(await gaugeController.isLock()).to.be.eq(true);
    });

    it("Success : Cycle 2 - Computing TOTAL_WEIGHTS last chunk", async () => {
        await cvgRewards.writeStakingRewards();

        const votes = await getGaugeControllerVotes(gaugeController);

        expect(await cvgRewards.totalWeightLocked()).to.be.eq(votes.totalVeCvg);
        expect(await cvgRewards.cursor()).to.be.eq(0);
        expect(await cvgRewards.state()).to.be.eq(2);
        expect(await gaugeController.isLock()).to.be.eq(true);
    });

    it("Success : Cycle 2 - Performing the DISTRIBUTE for cycle 1 first chunk", async () => {
        await cvgRewards.writeStakingRewards();

        const votes = await getGaugeControllerVotes(gaugeController);

        const cvgInflation = calcStakingInflation(CYCLE_2);
        for (let index = 0; index < CHUNK_DISTRIBUTE; index++) {
            expect(await gauges[index].cvgStakingCycle()).to.be.eq(CYCLE_2 + 1);
            const cycleInfo = await gauges[index].cvgCycleInfo(CYCLE_2);
            expect(cycleInfo.isCvgProcessed).to.be.eq(1);
            expect(cycleInfo.cvgRewardsAmount).to.be.eq((cvgInflation * votes.gaugeVotes[index].veCvgAmount) / votes.totalVeCvg);
        }
        expect(await cvgRewards.totalWeightLocked()).to.be.eq(votes.totalVeCvg);
        expect(await cvgRewards.cursor()).to.be.eq(CHUNK_DISTRIBUTE);
        expect(await cvgRewards.state()).to.be.eq(2);
        expect(await gaugeController.isLock()).to.be.eq(true);
    });

    it("Success : Cycle 2 - Performing the DISTRIBUTE for last chunk", async () => {
        await cvgRewards.writeStakingRewards();

        const votes = await getGaugeControllerVotes(gaugeController);

        const cvgInflation = calcStakingInflation(CYCLE_2);
        for (let index = CHUNK_DISTRIBUTE; index < votes.gaugeVotes.length; index++) {
            expect(await gauges[index].cvgStakingCycle()).to.be.eq(CYCLE_2 + 1);
            const cycleInfo = await gauges[index].cvgCycleInfo(CYCLE_2);
            expect(cycleInfo.isCvgProcessed).to.be.eq(1);
            expect(cycleInfo.cvgRewardsAmount).to.be.eq((cvgInflation * votes.gaugeVotes[index].veCvgAmount) / votes.totalVeCvg);
        }
        expect(await cvgRewards.totalWeightLocked()).to.be.eq(0);
        expect(await cvgRewards.cursor()).to.be.eq(0);
        expect(await cvgRewards.state()).to.be.eq(3);
        expect(await gaugeController.isLock()).to.be.eq(true);
    });

    it("Success : Cycle 2 - Performing the CONTROL_TOWER SYNC", async () => {
        await cvgRewards.writeStakingRewards();

        expect(await cvgRewards.totalWeightLocked()).to.be.eq(0);
        expect(await cvgRewards.cursor()).to.be.eq(0);
        expect(await cvgRewards.state()).to.be.eq(0);
        expect(await gaugeController.isLock()).to.be.eq(false);
    });
});
