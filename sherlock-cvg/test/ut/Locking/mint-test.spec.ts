import {expect} from "chai";

import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {deployYsDistributorFixture, increaseCvgCycle} from "../../fixtures/fixtures";
import {ethers} from "hardhat";
import {IContracts, IContractsUser, IUsers} from "../../../utils/contractInterface";
import {PositionLocker} from "../../../typechain-types/contracts/mocks";
import {LockingPositionDelegate, LockingPositionService} from "../../../typechain-types/contracts/Locking";
import {Signer, EventLog, ZeroAddress} from "ethers";
import {Cvg} from "../../../typechain-types/contracts/Token";
import {CvgControlTower} from "../../../typechain-types/contracts";
import {YsDistributor} from "../../../typechain-types/contracts/Rewards";
import {LOCKING_POSITIONS} from "./config/lockingTestConfig";
import {TOKEN_1, TOKEN_2, TOKEN_3, TOKEN_4, TOKEN_5, TOKEN_6, TOKEN_7} from "../../../resources/constant";

describe("LockingPositionManager / mintPosition & claimRewards", () => {
    let lockingPositionServiceContract: LockingPositionService,
        lockingPositionDelegateContract: LockingPositionDelegate,
        cvgContract: Cvg,
        controlTowerContract: CvgControlTower,
        positionLocker: PositionLocker,
        ysdistributor: YsDistributor;
    let contractUsers: IContractsUser, contracts: IContracts, users: IUsers;
    let owner: Signer, user1: Signer, user2: Signer, user10: Signer, treasuryDao: Signer;

    before(async () => {
        contractUsers = await loadFixture(deployYsDistributorFixture);
        contracts = contractUsers.contracts;
        users = contractUsers.users;

        lockingPositionServiceContract = contracts.locking.lockingPositionService;
        lockingPositionDelegateContract = contracts.locking.lockingPositionDelegate;
        cvgContract = contracts.tokens.cvg;
        controlTowerContract = contracts.base.cvgControlTower;
        positionLocker = contracts.tests.positionLocker;
        ysdistributor = contracts.rewards.ysDistributor;

        owner = users.owner;
        user1 = users.user1;
        user2 = users.user2;
        user10 = users.user10;
        treasuryDao = users.treasuryDao;

        await (await cvgContract.transfer(user1, ethers.parseEther("100000"))).wait();
        await (await cvgContract.transfer(user2, ethers.parseEther("100000"))).wait();
        await (await cvgContract.transfer(positionLocker, ethers.parseEther("100000"))).wait();
    });

    it("increase staking cycle to 5", async () => {
        await increaseCvgCycle(contractUsers, LOCKING_POSITIONS[0].lockCycle - 1);

        const actualCycle = await controlTowerContract.cvgCycle();
        expect(actualCycle).to.be.eq(LOCKING_POSITIONS[0].lockCycle);
    });

    it("Tries to mint position with ysPercentage greater than 100", async () => {
        const txFail = lockingPositionServiceContract
            .connect(user1)
            .mintPosition(LOCKING_POSITIONS[0].duration, LOCKING_POSITIONS[0].cvgAmount, 130, user1, true);
        await expect(txFail).to.be.revertedWith("YS_%_OVER_100");
    });

    it("Tries to mint position with ysPercentage not multiple of 10", async () => {
        const txFail = lockingPositionServiceContract
            .connect(user1)
            .mintPosition(LOCKING_POSITIONS[0].duration, LOCKING_POSITIONS[0].cvgAmount, 25, user1, true);
        await expect(txFail).to.be.revertedWith("YS_%_10_MULTIPLE");
    });

    it("mint position 1 at cycle 5", async () => {
        await (await cvgContract.connect(user1).approve(lockingPositionServiceContract, LOCKING_POSITIONS[0].cvgAmount)).wait();

        await (
            await lockingPositionServiceContract.connect(user1).mintPosition(LOCKING_POSITIONS[0].duration, LOCKING_POSITIONS[0].cvgAmount, 100, user1, true)
        ).wait(); // Lock 100 CVG for 43 cycles

        const totalSupplyYsCvg = await lockingPositionServiceContract.totalSupplyYsCvg();
        expect(totalSupplyYsCvg).to.be.eq(0);

        const token1Position = await lockingPositionServiceContract.lockingPositions(1);
        expect(token1Position.startCycle).to.be.eq(LOCKING_POSITIONS[0].lockCycle);
        expect(token1Position.lastEndCycle).to.be.eq(48);
        expect(token1Position.totalCvgLocked).to.be.eq(LOCKING_POSITIONS[0].cvgAmount);
        expect(token1Position.mgCvgAmount).to.be.eq("0");
    });

    it("increase staking cycle to 9", async () => {
        await increaseCvgCycle(contractUsers, LOCKING_POSITIONS[1].lockCycle - LOCKING_POSITIONS[0].lockCycle);

        let actualCycle = await controlTowerContract.cvgCycle();
        expect(actualCycle).to.be.eq(9);

        const totalSupplyYsCvg = await lockingPositionServiceContract.totalSupplyYsCvg();
        expect(totalSupplyYsCvg).to.be.eq("26128472222222222221");
    });

    it("mint position 2 at cycle 9", async () => {
        await (await cvgContract.connect(user1).approve(lockingPositionServiceContract, LOCKING_POSITIONS[1].cvgAmount)).wait();
        await (
            await lockingPositionServiceContract.connect(user1).mintPosition(LOCKING_POSITIONS[1].duration, LOCKING_POSITIONS[1].cvgAmount, 100, user1, true)
        ).wait(); // Lock 4 000 CVG for 15 cycles

        const token2Position = await lockingPositionServiceContract.lockingPositions(2);
        expect(token2Position.startCycle).to.be.eq(LOCKING_POSITIONS[1].lockCycle);
        expect(token2Position.lastEndCycle).to.be.eq(48);
        expect(token2Position.totalCvgLocked).to.be.eq(LOCKING_POSITIONS[1].cvgAmount);
        expect(token2Position.mgCvgAmount).to.be.eq("0");

        let totalSupplyYsCvg = await lockingPositionServiceContract.totalSupplyYsCvg();
        expect(totalSupplyYsCvg).to.be.eq("26128472222222222221");
    });

    it("increase staking cycle to 12", async () => {
        await increaseCvgCycle(contractUsers, LOCKING_POSITIONS[2].lockCycle - LOCKING_POSITIONS[1].lockCycle);

        let actualCycle = await controlTowerContract.cvgCycle();
        expect(actualCycle).to.be.eq(12);

        const totalSupplyYsCvg = await lockingPositionServiceContract.totalSupplyYsCvg();
        expect(totalSupplyYsCvg).to.be.eq("36284722222222222221");
    });

    it("mint position 3 at cycle 12", async () => {
        await (await cvgContract.connect(user2).approve(lockingPositionServiceContract, LOCKING_POSITIONS[2].cvgAmount)).wait();
        await (
            await lockingPositionServiceContract.connect(user2).mintPosition(LOCKING_POSITIONS[2].duration, LOCKING_POSITIONS[2].cvgAmount, 100, user2, true)
        ).wait(); // Lock 4 000 CVG for 15 cycles

        const token3Position = await lockingPositionServiceContract.lockingPositions(3);
        expect(token3Position.startCycle).to.be.eq(LOCKING_POSITIONS[2].lockCycle);
        expect(token3Position.lastEndCycle).to.be.eq(48);
        expect(token3Position.totalCvgLocked).to.be.eq(LOCKING_POSITIONS[2].cvgAmount);
        expect(token3Position.mgCvgAmount).to.be.eq("0");

        let totalSupplyYsCvg = await lockingPositionServiceContract.totalSupplyYsCvg();
        expect(totalSupplyYsCvg).to.be.eq("36284722222222222221");
    });

    it("increase staking cycle to 13 => first TDE", async () => {
        await increaseCvgCycle(contractUsers, 1);

        let actualCycle = await controlTowerContract.cvgCycle();
        expect(actualCycle).to.be.eq(13);

        const totalSupplyYsCvg = await lockingPositionServiceContract.totalSupplyYsCvg();
        expect(totalSupplyYsCvg).to.be.eq("104166666666666666666");
    });

    it("success trigger rewards for token 1 on TDE 1", async () => {
        const txSuccess = await (await ysdistributor.connect(user1).claimRewards(TOKEN_1, 1, user1, ZeroAddress)).wait();

        const logs = txSuccess?.logs as EventLog[];
        const ev = logs[0].args;
        expect(ev.tokenId).to.be.eq(TOKEN_1);
        expect(ev.cycle).to.be.eq(1);
        expect(ev.share).to.be.eq("72009569377990430621"); // 72% share
    });

    it("increase staking cycle to 27 => first TDE", async () => {
        await increaseCvgCycle(contractUsers, 14);

        let actualCycle = await controlTowerContract.cvgCycle();
        expect(actualCycle).to.be.eq(27);

        const totalSupplyYsCvg = await lockingPositionServiceContract.totalSupplyYsCvg();
        expect(totalSupplyYsCvg).to.be.eq("104166666666666666666");
    });

    it("mint position 4 at cycle 27", async () => {
        await (await cvgContract.connect(user2).approve(lockingPositionServiceContract, LOCKING_POSITIONS[3].cvgAmount)).wait();
        await (
            await lockingPositionServiceContract.connect(user2).mintPosition(LOCKING_POSITIONS[3].duration, LOCKING_POSITIONS[3].cvgAmount, 100, user2, true)
        ).wait(); // Lock 4 000 CVG for 15 cycles

        const token4Position = await lockingPositionServiceContract.lockingPositions(TOKEN_4);
        expect(token4Position.startCycle).to.be.eq(LOCKING_POSITIONS[3].lockCycle);
        expect(token4Position.lastEndCycle).to.be.eq(48);
        expect(token4Position.totalCvgLocked).to.be.eq(LOCKING_POSITIONS[3].cvgAmount);
        expect(token4Position.mgCvgAmount).to.be.eq("0");

        let totalSupplyYsCvg = await lockingPositionServiceContract.totalSupplyYsCvg();
        expect(totalSupplyYsCvg).to.be.eq("104166666666666666666");
    });

    it("increase staking cycle to 30", async () => {
        await increaseCvgCycle(contractUsers, 3);

        let actualCycle = await controlTowerContract.cvgCycle();
        expect(actualCycle).to.be.eq(30);

        const totalSupplyYsCvg = await lockingPositionServiceContract.totalSupplyYsCvg();
        expect(totalSupplyYsCvg).to.be.eq("116471354166666666666");
    });

    it("increase staking cycle to 41", async () => {
        await increaseCvgCycle(contractUsers, 11);

        let actualCycle = await controlTowerContract.cvgCycle();
        expect(actualCycle).to.be.eq(41);

        const totalSupplyYsCvg = await lockingPositionServiceContract.totalSupplyYsCvg();
        expect(totalSupplyYsCvg).to.be.eq("120572916666666666666");
    });

    it("success trigger rewards for token 1 on TDE 2", async () => {
        const txSuccess = await (await ysdistributor.connect(user1).claimRewards(TOKEN_1, 2, user1, ZeroAddress)).wait();

        const eventArgs = (txSuccess!.logs[0] as EventLog).args;
        expect(eventArgs.tokenId).to.be.eq(TOKEN_1);
        expect(eventArgs.cycle).to.be.eq(2);
        expect(eventArgs.share).to.be.eq("42999999999999999999"); // 43% share
    });

    it("success trigger rewards for token 2 on TDE 1", async () => {
        const txSuccess = await (await ysdistributor.connect(user1).claimRewards(TOKEN_2, 1, user1, ZeroAddress)).wait();

        const eventArgs = (txSuccess!.logs[0] as EventLog).args;
        expect(eventArgs.tokenId).to.be.eq(TOKEN_2);
        expect(eventArgs.cycle).to.be.eq(1);
        expect(eventArgs.share).to.be.eq("27990430622009569378"); // 27% share
    });

    it("success trigger rewards for token 2 on TDE 2", async () => {
        const txSuccess = await (await ysdistributor.connect(user1).claimRewards(TOKEN_2, 2, user1, ZeroAddress)).wait();

        const eventArgs = (txSuccess!.logs[0] as EventLog).args;
        expect(eventArgs.tokenId).to.be.eq(TOKEN_2);
        expect(eventArgs.cycle).to.be.eq(2);
        expect(eventArgs.share).to.be.eq("39000000000000000000"); // 39% share
    });

    it("fails claim rewards when NFT not owned", async () => {
        const txFail = ysdistributor.connect(user1).claimRewards(TOKEN_3, 2, user1, ZeroAddress);
        await expect(txFail).to.be.revertedWith("NOT_OWNED_OR_DELEGATEE");
    });

    it("success trigger rewards for token 3 on TDE 2", async () => {
        const txSuccess = await (await ysdistributor.connect(user2).claimRewards(TOKEN_3, 2, user1, ZeroAddress)).wait();

        const eventArgs = (txSuccess!.logs[0] as EventLog).args;
        expect(eventArgs.tokenId).to.be.eq(TOKEN_3);
        expect(eventArgs.cycle).to.be.eq(2);
        expect(eventArgs.share).to.be.eq("18000000000000000000"); // 18% share
    });

    it("success trigger rewards for token 3 on TDE 3", async () => {
        const txSuccess = await (await ysdistributor.connect(user2).claimRewards(TOKEN_3, 3, user1, ZeroAddress)).wait();

        const eventArgs = (txSuccess!.logs[0] as EventLog).args;
        expect(eventArgs.tokenId).to.be.eq(TOKEN_3);
        expect(eventArgs.cycle).to.be.eq(3);
        expect(eventArgs.share).to.be.eq("16098378982671883734"); // 18% share
    });

    it("success trigger rewards for token 3 on TDE 4", async () => {
        const txFail = ysdistributor.connect(user2).claimRewards(TOKEN_3, 4, user1, ZeroAddress);

        await expect(txFail).to.be.revertedWith("NOT_AVAILABLE");
    });

    it("mint position 5 at cycle 41", async () => {
        await (await cvgContract.connect(user2).approve(lockingPositionServiceContract, LOCKING_POSITIONS[4].cvgAmount)).wait();
        await (
            await lockingPositionServiceContract.connect(user2).mintPosition(LOCKING_POSITIONS[4].duration, LOCKING_POSITIONS[4].cvgAmount, 100, user2, true)
        ).wait(); // Lock 4 000 CVG for 15 cycles

        const token5Position = await lockingPositionServiceContract.lockingPositions(TOKEN_5);
        expect(token5Position.startCycle).to.be.eq(LOCKING_POSITIONS[4].lockCycle);
        expect(token5Position.lastEndCycle).to.be.eq(48);
        expect(token5Position.totalCvgLocked).to.be.eq(LOCKING_POSITIONS[4].cvgAmount);
        expect(token5Position.mgCvgAmount).to.be.eq("0");

        let totalSupplyYsCvg = await lockingPositionServiceContract.totalSupplyYsCvg();
        expect(totalSupplyYsCvg).to.be.eq("120572916666666666666");
    });

    it("Mints position 6 at cycle 41", async () => {
        await (await cvgContract.connect(user2).approve(lockingPositionServiceContract, LOCKING_POSITIONS[5].cvgAmount)).wait();
        await (
            await lockingPositionServiceContract.connect(user2).mintPosition(LOCKING_POSITIONS[5].duration, LOCKING_POSITIONS[5].cvgAmount, 0, user2, true)
        ).wait();
    });

    it("increase staking cycle to 49", async () => {
        await increaseCvgCycle(contractUsers, 8);

        let actualCycle = await controlTowerContract.cvgCycle();
        expect(actualCycle).to.be.eq(49);

        const totalSupplyYsCvg = await lockingPositionServiceContract.totalSupplyYsCvg();
        expect(totalSupplyYsCvg).to.be.eq("0");
    });

    it("increase staking cycle to 61 ", async () => {
        await increaseCvgCycle(contractUsers, 12);

        let actualCycle = await controlTowerContract.cvgCycle();
        expect(actualCycle).to.be.eq(61);

        const totalSupplyYsCvg = await lockingPositionServiceContract.totalSupplyYsCvg();
        expect(totalSupplyYsCvg).to.be.eq(0);
    });

    it("success trigger rewards for token 3 on TDE 4", async () => {
        const txSuccess = await (await ysdistributor.connect(user2).claimRewards(TOKEN_3, 4, user1, ZeroAddress)).wait();

        const eventArgs = (txSuccess!.logs[0] as EventLog).args;
        expect(eventArgs.tokenId).to.be.eq(TOKEN_3);
        expect(eventArgs.cycle).to.be.eq(4);
        expect(eventArgs.share).to.be.eq("15020862308762169680"); // 15% share
    });

    it("success trigger rewards for token 4 on TDE 3", async () => {
        const txSuccess = await (await ysdistributor.connect(user2).claimRewards(TOKEN_4, 3, user1, ZeroAddress)).wait();

        const eventArgs = (txSuccess!.logs[0] as EventLog).args;
        expect(eventArgs.tokenId).to.be.eq(TOKEN_4);
        expect(eventArgs.cycle).to.be.eq(3);
        expect(eventArgs.share).to.be.eq("10564561207378423700"); // 10% share
    });

    it("Delegates share and success trigger rewards for token 4 on TDE 4 from delegatee user1", async () => {
        await (await lockingPositionDelegateContract.connect(user2).delegateYsCvg(TOKEN_4, user1)).wait();

        const txSuccess = await (await ysdistributor.connect(user1).claimRewards(TOKEN_4, 4, user1, ZeroAddress)).wait();

        const eventArgs = (txSuccess!.logs[0] as EventLog).args;
        expect(eventArgs.tokenId).to.be.eq(TOKEN_4);
        expect(eventArgs.cycle).to.be.eq(4);
        expect(eventArgs.share).to.be.eq("13143254520166898470"); // 13% share
    });

    it("success trigger rewards for token 5 on TDE 4", async () => {
        const txSuccess = await (await ysdistributor.connect(user2).claimRewards(TOKEN_5, 4, user1, ZeroAddress)).wait();

        const eventArgs = (txSuccess!.logs[0] as EventLog).args;
        expect(eventArgs.tokenId).to.be.eq(TOKEN_5);
        expect(eventArgs.cycle).to.be.eq(4);
        expect(eventArgs.share).to.be.eq("3407510431154381083"); // 3.4% share
    });

    it("Fails to claim rewards for token 6 on TDE 4 (0% ysCVG)", async () => {
        const txFail = ysdistributor.connect(user2).claimRewards(TOKEN_6, 4, user2, ZeroAddress);
        await expect(txFail).to.be.revertedWith("NO_SHARES");
    });

    it("Fails to claim rewards for token 1 on TDE 5", async () => {
        const txFail = ysdistributor.connect(user1).claimRewards(TOKEN_1, 5, user1, ZeroAddress);
        await expect(txFail).to.be.revertedWith("LOCK_OVER");
    });

    it("Fails to delegate vote from user1 to user10 with non-owner of token", async () => {
        const txFail = lockingPositionDelegateContract.connect(user2).delegateVeCvg(TOKEN_1, user10);
        await expect(txFail).to.be.revertedWith("TOKEN_NOT_OWNED");
    });

    it("Delegates vote from user1 to user10", async () => {
        expect(await lockingPositionDelegateContract.connect(user1).delegateVeCvg(TOKEN_1, user10))
            .to.emit(lockingPositionDelegateContract, "DelegateVeCvg")
            .withArgs(1, await user10.getAddress());
        expect(await lockingPositionDelegateContract.delegatedVeCvg(TOKEN_1)).to.be.equal(await user10.getAddress());
    });

    it("Delegates vote from user1 to user2", async () => {
        await lockingPositionDelegateContract.connect(user1).delegateVeCvg(TOKEN_1, user2);

        const delegatees = await lockingPositionDelegateContract.getVeCvgDelegatees(user2);
        expect(delegatees).to.deep.equal([1]);
    });

    it("Checks token position infos for token 1", async () => {
        const lockingPosition = LOCKING_POSITIONS[0];
        const tokenInfos = await lockingPositionServiceContract.tokenInfos(TOKEN_1);

        expect(tokenInfos.tokenId).to.be.equal(TOKEN_1);
        expect(tokenInfos.startCycle).to.be.equal(lockingPosition.lockCycle);
        expect(tokenInfos.endCycle).to.be.equal(48);
        expect(tokenInfos.cvgLocked).to.be.equal(lockingPosition.cvgAmount);
        expect(tokenInfos.ysActual).to.be.equal(0);
        expect(tokenInfos.ysTotal).to.be.equal("44791666666666666666");
        expect(tokenInfos.veCvgActual).to.be.equal(0);
        expect(tokenInfos.mgCvg).to.be.equal(0);
        expect(tokenInfos.ysPercentage).to.be.equal(100);
    });

    it("Fails to mint position with not allowed locker", async () => {
        const txFail = positionLocker.mintPosition("7", ethers.parseEther("100"), "10", owner, true);
        await expect(txFail).to.be.revertedWith("NOT_CONTRACT_OR_WL");
    });

    it("Fails to toggle contract locker from not owner", async () => {
        const txFail = lockingPositionServiceContract.toggleContractLocker(positionLocker);
        await expect(txFail).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Toggles contract locker", async () => {
        await lockingPositionServiceContract.connect(treasuryDao).toggleContractLocker(positionLocker);
        expect(await lockingPositionServiceContract.isContractLocker(positionLocker)).to.be.true;
    });

    it("Mints position with allowed locker contract (0% ysCVG)", async () => {
        await (await positionLocker.approveCvg(lockingPositionServiceContract, LOCKING_POSITIONS[6].cvgAmount)).wait();
        await (await positionLocker.mintPosition(LOCKING_POSITIONS[6].duration, LOCKING_POSITIONS[6].cvgAmount, 0, positionLocker, true)).wait();
    });

    it("Increases lock position amount with allowed locker contract", async () => {
        await (await positionLocker.approveCvg(lockingPositionServiceContract, LOCKING_POSITIONS[6].cvgAmount)).wait();
        await (await positionLocker.increaseLockAmount(TOKEN_7, LOCKING_POSITIONS[6].cvgAmount, ZeroAddress)).wait();
    });

    it("Fails to increase lock position time with lock time over", async () => {
        const txFail = lockingPositionServiceContract.connect(user2).increaseLockTime(TOKEN_3, 12);
        await expect(txFail).to.be.revertedWith("LOCK_TIME_OVER");
    });

    it("Increases lock position time with allowed locker contract", async () => {
        await (await positionLocker.increaseLockTime(TOKEN_7, 12)).wait();
    });

    it("Fails to increase lock position time and amount with amount of 0", async () => {
        const txFail = positionLocker.increaseLockTimeAndAmount(TOKEN_7, 12, 0, ZeroAddress);
        await expect(txFail).to.be.revertedWith("LTE");
    });

    it("Fails to increase lock position time and amount with not owner", async () => {
        const txFail = lockingPositionServiceContract.connect(user1).increaseLockTimeAndAmount(TOKEN_3, 12, 100, ZeroAddress);
        await expect(txFail).to.be.revertedWith("TOKEN_NOT_OWNED");
    });

    it("Fails to increase lock position time and amount with lock over", async () => {
        const txFail = lockingPositionServiceContract.connect(user2).increaseLockTimeAndAmount(TOKEN_3, 12, 100, ZeroAddress);
        await expect(txFail).to.be.revertedWith("LOCK_OVER");
    });

    it("Fails to increase lock position time and amount with duration too big", async () => {
        const txFail = positionLocker.increaseLockTimeAndAmount(TOKEN_7, 96, 100, ZeroAddress);
        await expect(txFail).to.be.revertedWith("MAX_LOCK_96_CYCLES");
    });

    it("Fails to increase lock position time and amount with duration not TDE", async () => {
        const txFail = positionLocker.increaseLockTimeAndAmount(TOKEN_7, 10, 100, ZeroAddress);
        await expect(txFail).to.be.revertedWith("END_MUST_BE_TDE_MULTIPLE");
    });

    it("Increases lock position time and amount with allowed locker contract", async () => {
        await (await positionLocker.approveCvg(lockingPositionServiceContract, LOCKING_POSITIONS[6].cvgAmount)).wait();
        await (await positionLocker.increaseLockTimeAndAmount(TOKEN_7, 12, LOCKING_POSITIONS[6].cvgAmount, ZeroAddress)).wait();
    });

    it("Removes position locker from allowed contract", async () => {
        await lockingPositionServiceContract.connect(treasuryDao).toggleContractLocker(positionLocker);
        expect(await lockingPositionServiceContract.isContractLocker(positionLocker)).to.be.false;
    });

    it("Fails to increase lock position time with not allowed locker contract", async () => {
        const txFail = positionLocker.increaseLockTime(TOKEN_7, 12);
        await expect(txFail).to.be.revertedWith("NOT_CONTRACT_OR_WL");
    });

    it("Fails to increase lock position amount with not allowed locker contract", async () => {
        const txFail = positionLocker.increaseLockAmount(TOKEN_7, LOCKING_POSITIONS[6].cvgAmount, ZeroAddress);
        await expect(txFail).to.be.revertedWith("NOT_CONTRACT_OR_WL");
    });

    it("Fails to increase lock position amount and time with not allowed contract", async () => {
        const txFail = positionLocker.increaseLockTimeAndAmount(TOKEN_7, 12, LOCKING_POSITIONS[6].cvgAmount, ZeroAddress);
        await expect(txFail).to.be.revertedWith("NOT_CONTRACT_OR_WL");
    });
});
