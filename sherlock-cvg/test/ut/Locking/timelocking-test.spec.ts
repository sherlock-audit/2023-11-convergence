import {expect} from "chai";
import {Signer, EventLog, ZeroAddress} from "ethers";

import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {deployYsDistributorFixture, increaseCvgCycle} from "../../fixtures/fixtures";
import {time} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import {ethers} from "hardhat";
import {
    LockingPositionManager,
    LockingPositionService,
    LockingPositionDelegate,
    Cvg,
    CvgControlTower,
    PositionLocker,
    YsDistributor,
} from "../../../typechain-types";
import {IContractsUser, IContracts, IUsers} from "../../../utils/contractInterface";
import {LOCKING_POSITIONS} from "./config/lockingTestConfig";
import {TOKEN_1} from "../../../resources/constant";

describe("LockingPositionManager  / timelocking", () => {
    let lockingPositionManagerContract: LockingPositionManager,
        lockingPositionServiceContract: LockingPositionService,
        cvgContract: Cvg,
        controlTowerContract: CvgControlTower,
        ysdistributor: YsDistributor;
    let contractUsers: IContractsUser, contracts: IContracts, users: IUsers;
    let user1: Signer, user2: Signer, user3: Signer, treasuryDao: Signer;

    before(async () => {
        contractUsers = await loadFixture(deployYsDistributorFixture);
        contracts = contractUsers.contracts;
        users = contractUsers.users;

        lockingPositionServiceContract = contracts.locking.lockingPositionService;
        lockingPositionManagerContract = contracts.locking.lockingPositionManager;
        cvgContract = contracts.tokens.cvg;
        controlTowerContract = contracts.base.cvgControlTower;

        user1 = users.user1;
        user2 = users.user2;
        user3 = users.user3;
        treasuryDao = users.treasuryDao;
        ysdistributor = contracts.rewards.ysDistributor;

        await (await cvgContract.transfer(user1, ethers.parseEther("100000"))).wait();
        await (await cvgContract.transfer(user2, ethers.parseEther("100000"))).wait();
        await (await cvgContract.transfer(user3, ethers.parseEther("100000"))).wait();
    });

    it("Fail : changing the max locking duration if not contract owner", async () => {
        const tx = await expect(lockingPositionManagerContract.setMaxLockingTime(25)).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Success : changing the max locking duration ", async () => {
        await lockingPositionManagerContract.connect(treasuryDao).setMaxLockingTime(12 * 86400);
        expect(await lockingPositionManagerContract.maxLockingTime()).to.be.eq(12 * 86400);
    });

    it("Success : increase staking cycle to 5", async () => {
        await increaseCvgCycle(contractUsers, LOCKING_POSITIONS[0].lockCycle - 1);

        const actualCycle = await controlTowerContract.cvgCycle();
        expect(actualCycle).to.be.eq(LOCKING_POSITIONS[0].lockCycle);
    });

    it("Success : mint position 1 at cycle 5", async () => {
        await (await cvgContract.connect(user1).approve(lockingPositionServiceContract, LOCKING_POSITIONS[0].cvgAmount)).wait();
        await (
            await lockingPositionServiceContract.connect(user1).mintPosition(LOCKING_POSITIONS[0].duration, LOCKING_POSITIONS[0].cvgAmount, 100, user1, true)
        ).wait(); // Lock 100 CVG for 43 cycles

        const totalSupplyYsCvg = await lockingPositionServiceContract.totalSupplyYsCvg();
        expect(totalSupplyYsCvg).to.be.eq(0);

        const token1Position = await lockingPositionServiceContract.lockingPositions(TOKEN_1);
        expect(token1Position.startCycle).to.be.eq(LOCKING_POSITIONS[0].lockCycle);
        expect(token1Position.lastEndCycle).to.be.eq(48);
        expect(token1Position.totalCvgLocked).to.be.eq(LOCKING_POSITIONS[0].cvgAmount);

        expect(await cvgContract.balanceOf(lockingPositionServiceContract)).to.be.eq(LOCKING_POSITIONS[0].cvgAmount);
        expect(await cvgContract.balanceOf(user1)).to.be.eq("99900000000000000000000");
    });

    it("Fail : Seting the timelock on a token not owned", async () => {
        const timestamp = await time.latest();
        const tx = await expect(lockingPositionManagerContract.setLock(TOKEN_1, timestamp + 5 * 86400)).to.be.revertedWith("TOKEN_NOT_OWNED");
    });

    it("Fail : Setting the timelock too early", async () => {
        const timestamp = await time.latest();
        const tx = await expect(lockingPositionManagerContract.connect(user1).setLock(TOKEN_1, timestamp + 890)).to.be.revertedWith("TIME_BUFFER");
    });

    it("Fail : Setting the timelock too far", async () => {
        const timestamp = await time.latest();
        const tx = await expect(lockingPositionManagerContract.connect(user1).setLock(TOKEN_1, timestamp + 15 * 86400)).to.be.revertedWith("MAX_TIME_LOCK");
    });

    it("Success : Timelock the token 1 in 10 days", async () => {
        const timestamp = await time.latest();
        const tx = await lockingPositionManagerContract.connect(user1).setLock(TOKEN_1, timestamp + 10 * 86400);
    });
    it("Fail : Timelock the token 1 before the current lock", async () => {
        const timestamp = await time.latest();
        const tx = await expect(lockingPositionManagerContract.connect(user1).setLock(TOKEN_1, timestamp + 5 * 86400)).to.be.revertedWith("ALREADY_LOCKED");
    });

    it("Fail : Augment the duration of a bond while it's timelocked", async () => {
        await expect(lockingPositionServiceContract.connect(user1).increaseLockTimeAndAmount(TOKEN_1, 10, 1, ZeroAddress)).to.be.revertedWith(
            "TOKEN_TIMELOCKED"
        );
    });

    it("Fail : Augment the duration of a bond while it's timelocked", async () => {
        await expect(lockingPositionServiceContract.connect(user1).increaseLockTime(TOKEN_1, 10)).to.be.revertedWith("TOKEN_TIMELOCKED");
    });

    it("Fail : Redeeming a bond when timelocked", async () => {
        await expect(ysdistributor.connect(user1).claimRewards(TOKEN_1, 1, user1, ZeroAddress)).to.be.revertedWith("TOKEN_TIMELOCKED");
    });

    it("Success : Transfer the token to simulate a sell and go 7 days in future", async () => {
        await lockingPositionManagerContract.connect(user1).transferFrom(user1, user2, TOKEN_1);
        await time.increase(9 * 86400);
    });

    it("Fail : Token is still time locked for 3 days", async () => {
        await expect(lockingPositionServiceContract.connect(user2).increaseLockTime(TOKEN_1, 12)).to.be.revertedWith("TOKEN_TIMELOCKED");
    });

    it("Success : increase a locking after the timelock", async () => {
        await time.increase(1 * 86400);
        await lockingPositionServiceContract.connect(user2).increaseLockTime(TOKEN_1, 12);
    });
});
