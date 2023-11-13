import {expect} from "chai";

import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {deployYsDistributorFixture, increaseCvgCycle} from "../../fixtures/fixtures";
import {ethers} from "hardhat";
import {Signer, EventLog, ZeroAddress} from "ethers";
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
import {TOKEN_1, TOKEN_2, TOKEN_3, TOKEN_4} from "../../../resources/constant";

describe("LockingPositionManager  / unlock", () => {
    let lockingPositionManager: LockingPositionManager,
        lockingPositionService: LockingPositionService,
        cvgContract: Cvg,
        controlTowerContract: CvgControlTower,
        ysdistributor: YsDistributor;
    let contractUsers: IContractsUser, contracts: IContracts, users: IUsers;
    let user1: Signer, user2: Signer, user3: Signer;

    before(async () => {
        contractUsers = await loadFixture(deployYsDistributorFixture);
        contracts = contractUsers.contracts;
        users = contractUsers.users;

        lockingPositionService = contracts.locking.lockingPositionService;
        lockingPositionManager = contracts.locking.lockingPositionManager;
        cvgContract = contracts.tokens.cvg;
        controlTowerContract = contracts.base.cvgControlTower;
        ysdistributor = contracts.rewards.ysDistributor;
        user1 = users.user1;
        user2 = users.user2;
        user3 = users.user3;

        await (await cvgContract.transfer(user1, ethers.parseEther("100000"))).wait();
        await (await cvgContract.transfer(user2, ethers.parseEther("100000"))).wait();
        await (await cvgContract.transfer(user3, ethers.parseEther("100000"))).wait();
    });

    it("increase staking cycle to 5", async () => {
        await increaseCvgCycle(contractUsers, LOCKING_POSITIONS[0].lockCycle - 1);

        const actualCycle = await controlTowerContract.cvgCycle();
        expect(actualCycle).to.be.eq(LOCKING_POSITIONS[0].lockCycle);
    });

    it("mint position 1 at cycle 5", async () => {
        await (await cvgContract.connect(user1).approve(lockingPositionService, LOCKING_POSITIONS[0].cvgAmount)).wait();
        await (
            await lockingPositionService.connect(user1).mintPosition(LOCKING_POSITIONS[0].duration, LOCKING_POSITIONS[0].cvgAmount, 100, user1, true)
        ).wait(); // Lock 100 CVG for 43 cycles

        const totalSupplyYsCvg = await lockingPositionService.totalSupplyYsCvg();
        expect(totalSupplyYsCvg).to.be.eq(0);

        const token1Position = await lockingPositionService.lockingPositions(TOKEN_1);
        expect(token1Position.startCycle).to.be.eq(LOCKING_POSITIONS[0].lockCycle);
        expect(token1Position.lastEndCycle).to.be.eq(48);
        expect(token1Position.totalCvgLocked).to.be.eq(LOCKING_POSITIONS[0].cvgAmount);

        expect(await cvgContract.balanceOf(lockingPositionService)).to.be.eq(LOCKING_POSITIONS[0].cvgAmount);
        expect(await cvgContract.balanceOf(user1)).to.be.eq("99900000000000000000000");
    });

    it("increase staking cycle to 13 ", async () => {
        await increaseCvgCycle(contractUsers, 8);

        const actualCycle = await controlTowerContract.cvgCycle();
        expect(actualCycle).to.be.eq(13);
    });

    it("mint position 2 at cycle 13 with user2", async () => {
        await (await cvgContract.connect(user2).approve(lockingPositionService, ethers.parseEther("200"))).wait();
        await (await lockingPositionService.connect(user2).mintPosition("23", ethers.parseEther("200"), 100, user2, true)).wait(); // Lock 100 CVG for 43 cycles

        const totalSupplyYsCvg = await lockingPositionService.totalSupplyYsCvg();
        expect(totalSupplyYsCvg).to.be.eq("44791666666666666666");

        const token1Position = await lockingPositionService.lockingPositions(TOKEN_2);
        expect(token1Position.startCycle).to.be.eq(13);
        expect(token1Position.lastEndCycle).to.be.eq(36);
        expect(token1Position.totalCvgLocked).to.be.eq(ethers.parseEther("200"));
    });

    it("mint position 3 at cycle 13 with user3", async () => {
        await (await cvgContract.connect(user3).approve(lockingPositionService, ethers.parseEther("1500"))).wait();
        await (await lockingPositionService.connect(user3).mintPosition("23", ethers.parseEther("1500"), 100, user3, true)).wait(); // Lock 100 CVG for 43 cycles

        const totalSupplyYsCvg = await lockingPositionService.totalSupplyYsCvg();
        expect(totalSupplyYsCvg).to.be.eq("44791666666666666666");

        const token1Position = await lockingPositionService.lockingPositions(TOKEN_3);
        expect(token1Position.startCycle).to.be.eq(13);
        expect(token1Position.lastEndCycle).to.be.eq(36);
        expect(token1Position.totalCvgLocked).to.be.eq(ethers.parseEther("1500"));
    });

    it("increase staking cycle to 24, TDE 2 not claimable because not ready ", async () => {
        await increaseCvgCycle(contractUsers, 11);
        const actualCycle = await controlTowerContract.cvgCycle();
        expect(actualCycle).to.be.eq(24);

        const txFail = ysdistributor.connect(user2).claimRewards(TOKEN_2, 2, user1, ZeroAddress);
        await expect(txFail).to.be.reverted;
    });

    it("fails burn position not owned", async () => {
        const txFail = lockingPositionService.connect(user1).burnPosition(TOKEN_2);

        await expect(txFail).to.be.revertedWith("TOKEN_NOT_OWNED");
    });

    it("fails burn position not unlocked", async () => {
        const txFail = lockingPositionService.connect(user1).burnPosition(TOKEN_1);

        await expect(txFail).to.be.revertedWith("LOCKED");
    });

    it("increase staking cycle to 49, claim rewards", async () => {
        await increaseCvgCycle(contractUsers, 25);
        const actualCycle = await controlTowerContract.cvgCycle();
        expect(actualCycle).to.be.eq(49);

        const txClaim_1_4 = await (await ysdistributor.connect(user1).claimRewards(TOKEN_1, 4, user1, ZeroAddress)).wait();
        let eventArgs = (txClaim_1_4!.logs[0] as EventLog).args;
        expect(eventArgs.tokenId).to.be.eq(TOKEN_1);
        expect(eventArgs.cycle).to.be.eq(4);
        expect(eventArgs.share).to.be.eq("100000000000000000000");

        const txClaim_2_3 = await (await ysdistributor.connect(user2).claimRewards(TOKEN_2, 3, user1, ZeroAddress)).wait();
        eventArgs = (txClaim_2_3!.logs[0] as EventLog).args;
        expect(eventArgs.tokenId).to.be.eq(TOKEN_2);
        expect(eventArgs.cycle).to.be.eq(3);
        expect(eventArgs.share).to.be.eq("10599078341013824884");

        const txClaim_1_1 = await (await ysdistributor.connect(user1).claimRewards(TOKEN_1, 1, user1, ZeroAddress)).wait();
        eventArgs = (txClaim_1_1!.logs[0] as EventLog).args;
        expect(eventArgs.tokenId).to.be.eq(TOKEN_1);
        expect(eventArgs.cycle).to.be.eq(1);
        expect(eventArgs.share).to.be.eq("100000000000000000000");

        const txClaim_1_3 = await (await ysdistributor.connect(user1).claimRewards(TOKEN_1, 3, user2, ZeroAddress)).wait();
        eventArgs = (txClaim_1_3!.logs[0] as EventLog).args;
        expect(eventArgs.tokenId).to.be.eq(TOKEN_1);
        expect(eventArgs.cycle).to.be.eq(3);
        expect(eventArgs.share).to.be.eq("9907834101382488479");

        const txClaim_1_2 = await (await ysdistributor.connect(user1).claimRewards(TOKEN_1, 2, user1, ZeroAddress)).wait();
        eventArgs = (txClaim_1_2!.logs[0] as EventLog).args;
        expect(eventArgs.tokenId).to.be.eq(TOKEN_1);
        expect(eventArgs.cycle).to.be.eq(2);
        expect(eventArgs.share).to.be.eq("10712061449034668880");

        const txClaim_2_2 = await (await ysdistributor.connect(user2).claimRewards(TOKEN_2, 2, user1, ZeroAddress)).wait();
        eventArgs = (txClaim_2_2!.logs[0] as EventLog).args;
        expect(eventArgs.tokenId).to.be.eq(TOKEN_2);
        expect(eventArgs.cycle).to.be.eq(2);
        expect(eventArgs.share).to.be.eq("10504463358937097778");

        const txClaim_3_3 = await (await ysdistributor.connect(user3).claimRewards(TOKEN_3, 3, user1, ZeroAddress)).wait();
        eventArgs = (txClaim_3_3!.logs[0] as EventLog).args;
        expect(eventArgs.tokenId).to.be.eq(TOKEN_3);
        expect(eventArgs.cycle).to.be.eq(3);
        expect(eventArgs.share).to.be.eq("79493087557603686636");

        const txClaim_3_2 = await (await ysdistributor.connect(user3).claimRewards(TOKEN_3, 2, user1, ZeroAddress)).wait();
        eventArgs = (txClaim_3_2!.logs[0] as EventLog).args;
        expect(eventArgs.tokenId).to.be.eq(TOKEN_3);
        expect(eventArgs.cycle).to.be.eq(2);
        expect(eventArgs.share).to.be.eq("78783475192028233340");
    });

    it("success burn positions", async () => {
        const burnPosition1Tx = await (await lockingPositionService.connect(user1).burnPosition(TOKEN_1)).wait();

        const burnPosition2Tx = await (await lockingPositionService.connect(user2).burnPosition(TOKEN_2)).wait();
    });

    it("Mints position 4 with 0% ysCVG at cycle 49, increases cycle to 61 and burns position", async () => {
        await (await cvgContract.connect(user1).approve(lockingPositionService, LOCKING_POSITIONS[0].cvgAmount)).wait();
        await (await lockingPositionService.connect(user1).mintPosition(11, LOCKING_POSITIONS[0].cvgAmount, 0, user1, true)).wait();

        await increaseCvgCycle(contractUsers, 12);

        await (await lockingPositionService.connect(user1).burnPosition(TOKEN_4)).wait();
    });

    it("success ERC721 burnt ", async () => {
        const user1NFTBalance = await lockingPositionManager.balanceOf(user1);
        expect(user1NFTBalance).to.be.eq(0);

        const user2NFTBalance = await lockingPositionManager.balanceOf(user2);
        expect(user2NFTBalance).to.be.eq(0);
    });

    it("success CVG sent back after unlocking", async () => {
        const user1CVGBalance = await cvgContract.balanceOf(user1);
        expect(user1CVGBalance).to.be.eq(ethers.parseEther("100000"));

        const user2CVGBalance = await cvgContract.balanceOf(user2);
        expect(user2CVGBalance).to.be.eq(ethers.parseEther("100000"));
    });
});
