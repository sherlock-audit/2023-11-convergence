import {expect} from "chai";
import {zeroAddress} from "@nomicfoundation/ethereumjs-util";

import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {deployYsDistributorFixture, increaseCvgCycle} from "../../fixtures/fixtures";
import {Signer} from "ethers";
import {ethers} from "hardhat";
import {LockingPositionService, Cvg, CvgControlTower, YsDistributor} from "../../../typechain-types";
import {IContractsUser, IContracts, IUsers} from "../../../utils/contractInterface";

describe("LockingPositionManager / increaseLock time & amount", () => {
    let lockingPositionService: LockingPositionService, cvgContract: Cvg, controlTowerContract: CvgControlTower, ysdistributor: YsDistributor;
    let contractUsers: IContractsUser, contracts: IContracts, users: IUsers;
    let user1: Signer, user2: Signer;

    before(async () => {
        contractUsers = await loadFixture(deployYsDistributorFixture);
        contracts = contractUsers.contracts;
        users = contractUsers.users;

        lockingPositionService = contracts.locking.lockingPositionService;

        cvgContract = contracts.tokens.cvg;
        controlTowerContract = contracts.base.cvgControlTower;
        ysdistributor = contracts.rewards.ysDistributor;
        user1 = users.user1;
        user2 = users.user2;

        await (await cvgContract.transfer(user1, ethers.parseEther("100000"))).wait();
        await (await cvgContract.transfer(user2, ethers.parseEther("100000"))).wait();
    });

    it("increase staking cycle to 2", async () => {
        await increaseCvgCycle(contractUsers, 1);
        const actualCycle = await controlTowerContract.cvgCycle();
        expect(actualCycle).to.be.eq(2);
    });

    it("MINT token 1 10 - 10 cycles with 10k CVG", async () => {
        const balanceOfMgCvgBefore = await lockingPositionService.balanceOfMgCvg(1);
        expect(balanceOfMgCvgBefore).to.be.eq("0");

        await (await cvgContract.connect(user1).approve(lockingPositionService, ethers.parseEther("10000"))).wait();
        await lockingPositionService.connect(user1).mintPosition(10, ethers.parseEther("10000"), 40, user1, true);

        const balanceOfMgCvgAfter = await lockingPositionService.balanceOfMgCvg(1);
        expect(balanceOfMgCvgAfter).to.be.eq("625000000000000000000");

        const lockExtension = await lockingPositionService.lockExtensions(1, 0);
        expect(lockExtension.cycleId).to.be.eq(2);
        expect(lockExtension.endCycle).to.be.eq(12);
        expect(lockExtension.cvgLocked).to.be.eq(ethers.parseEther("10000"));
        expect(lockExtension.mgCvgAdded).to.be.eq("625000000000000000000"); // 625 mgCvg

        const token1Position = await lockingPositionService.lockingPositions(1);
        expect(token1Position.startCycle).to.be.eq(2);
        expect(token1Position.lastEndCycle).to.be.eq(12);
        expect(token1Position.totalCvgLocked).to.be.eq(ethers.parseEther("10000"));
        expect(token1Position.mgCvgAmount).to.be.eq("625000000000000000000"); // 625 mgCvg
        expect(token1Position.ysPercentage).to.be.eq(40);

        const totalSupplyYsCvg = await lockingPositionService.totalSupplyYsCvg();
        expect(totalSupplyYsCvg).to.be.eq("0");

        const ysCvgBalance1 = await lockingPositionService.balanceOfYsCvgAt(1, 1);
        expect(ysCvgBalance1).to.be.eq(0);

        const totalSupplyOfYsCvgAt1 = await lockingPositionService.totalSupplyOfYsCvgAt(1);
        expect(totalSupplyOfYsCvgAt1).to.be.eq(0);

        const ysCvgBalance2 = await lockingPositionService.balanceOfYsCvgAt(1, 2);
        expect(ysCvgBalance2).to.be.eq(0);

        const totalSupplyOfYsCvgAt2 = await lockingPositionService.totalSupplyOfYsCvgAt(2);
        expect(totalSupplyOfYsCvgAt2).to.be.eq(0);

        const totalSupplyOfYsCvgAt3 = await lockingPositionService.totalSupplyOfYsCvgAt(3);
        expect(totalSupplyOfYsCvgAt3).to.be.eq("347222222222222222221");

        const ysCvgBalance3 = await lockingPositionService.balanceOfYsCvgAt(1, 3);
        expect(ysCvgBalance3).to.be.eq("347222222222222222221");
    });

    it("increase staking cycle to 8 and INCREASE_AMOUNT on TOKEN 1", async () => {
        await increaseCvgCycle(contractUsers, 6);
        const actualCycle = await controlTowerContract.cvgCycle();
        expect(actualCycle).to.be.eq(8);

        const totalSupplyOfYsCvgAt3 = await lockingPositionService.totalSupplyOfYsCvgAt(3);
        expect(totalSupplyOfYsCvgAt3).to.be.eq("347222222222222222221");

        const balanceOfMgCvgBefore = await lockingPositionService.balanceOfMgCvg(1);
        expect(balanceOfMgCvgBefore).to.be.eq("625000000000000000000");

        await (await cvgContract.connect(user1).approve(lockingPositionService, ethers.parseEther("10000"))).wait();
        await lockingPositionService.connect(user1).increaseLockAmount(1, ethers.parseEther("10000"), zeroAddress());

        const balanceOfMgCvgAfter = await lockingPositionService.balanceOfMgCvg(1);
        expect(balanceOfMgCvgAfter).to.be.eq("875000000000000000000");

        const lockEntension = await lockingPositionService.lockExtensions(1, 1);
        expect(lockEntension.cycleId).to.be.eq(8);
        expect(lockEntension.endCycle).to.be.eq(12);
        expect(lockEntension.cvgLocked).to.be.eq(ethers.parseEther("10000"));
        expect(lockEntension.mgCvgAdded).to.be.eq("250000000000000000000"); // 250 mgCvg

        const token1Position = await lockingPositionService.lockingPositions(1);
        expect(token1Position.startCycle).to.be.eq(2);
        expect(token1Position.lastEndCycle).to.be.eq(12);
        expect(token1Position.totalCvgLocked).to.be.eq(ethers.parseEther("20000"));
        expect(token1Position.mgCvgAmount).to.be.eq("875000000000000000000"); // 625 + 250 mgCvg
        expect(token1Position.ysPercentage).to.be.eq(40);

        const totalSupplyYsCvg = await lockingPositionService.totalSupplyYsCvg();
        expect(totalSupplyYsCvg).to.be.eq("347222222222222222221");

        const ysCvgBalance8 = await lockingPositionService.balanceOfYsCvgAt(1, 8);
        expect(ysCvgBalance8).to.be.eq("347222222222222222221");

        const ysCvgBalance9 = await lockingPositionService.balanceOfYsCvgAt(1, 9);
        expect(ysCvgBalance9).to.be.eq("402777777777777777776");

        const totalSupplyOfYsCvgAt8 = await lockingPositionService.totalSupplyOfYsCvgAt(8);
        expect(totalSupplyOfYsCvgAt8).to.be.eq("347222222222222222221");

        const totalSupplyOfYsCvgAt9 = await lockingPositionService.totalSupplyOfYsCvgAt(9);
        expect(totalSupplyOfYsCvgAt9).to.be.eq("402777777777777777776");
    });

    it("increase staking cycle to 11 and INCREASE_TIME_AMOUNT on TOKEN 1", async () => {
        await increaseCvgCycle(contractUsers, 3);

        const actualCycle = await controlTowerContract.cvgCycle();
        expect(actualCycle).to.be.eq(11);

        const balanceOfMgCvgBefore = await lockingPositionService.balanceOfMgCvg(1);
        expect(balanceOfMgCvgBefore).to.be.eq("875000000000000000000");

        await (await cvgContract.connect(user1).approve(lockingPositionService, ethers.parseEther("10000"))).wait();
        await lockingPositionService.connect(user1).increaseLockTimeAndAmount(1, 48, ethers.parseEther("10000"), zeroAddress());

        const balanceOfMgCvgAfter = await lockingPositionService.balanceOfMgCvg(1);
        expect(balanceOfMgCvgAfter).to.be.eq("3937500000000000000000");

        const lockEntension = await lockingPositionService.lockExtensions(1, 2);
        expect(lockEntension.cycleId).to.be.eq(11);
        expect(lockEntension.endCycle).to.be.eq(60);
        expect(lockEntension.cvgLocked).to.be.eq(ethers.parseEther("10000"));
        expect(lockEntension.mgCvgAdded).to.be.eq("3062500000000000000000"); // 3062.5 mgCvg

        const token1Position = await lockingPositionService.lockingPositions(1);
        expect(token1Position.startCycle).to.be.eq(2);
        expect(token1Position.lastEndCycle).to.be.eq(60);
        expect(token1Position.totalCvgLocked).to.be.eq(ethers.parseEther("30000"));
        expect(token1Position.mgCvgAmount).to.be.eq("3937500000000000000000"); // 875 + 3062.5  mgCvg = 3937.5 mgCvg
        expect(token1Position.ysPercentage).to.be.eq(40);

        const totalSupplyYsCvg = await lockingPositionService.totalSupplyYsCvg();
        expect(totalSupplyYsCvg).to.be.eq("402777777777777777776");

        const totalSupplyOfYsCvgAt11 = await lockingPositionService.totalSupplyOfYsCvgAt(11);
        expect(totalSupplyOfYsCvgAt11).to.be.eq("402777777777777777776");

        const totalSupplyOfYsCvgAt12 = await lockingPositionService.totalSupplyOfYsCvgAt(12);
        expect(totalSupplyOfYsCvgAt12).to.be.eq("572916666666666666664");

        const totalSupplyOfYsCvgAt13 = await lockingPositionService.totalSupplyOfYsCvgAt(13);
        expect(totalSupplyOfYsCvgAt13).to.be.eq("2444444444444444444442");

        const totalSupplyOfYsCvgAt60 = await lockingPositionService.totalSupplyOfYsCvgAt(60);
        expect(totalSupplyOfYsCvgAt60).to.be.eq("2444444444444444444442");

        const totalSupplyOfYsCvgAt61 = await lockingPositionService.totalSupplyOfYsCvgAt(61);
        expect(totalSupplyOfYsCvgAt61).to.be.eq("0");

        const ysCvgBalance12 = await lockingPositionService.balanceOfYsCvgAt(1, 12);
        expect(ysCvgBalance12).to.be.eq("572916666666666666664");

        const ysCvgBalance13 = await lockingPositionService.balanceOfYsCvgAt(1, 13);
        expect(ysCvgBalance13).to.be.eq("2444444444444444444442");

        const ysCvgBalance60 = await lockingPositionService.balanceOfYsCvgAt(1, 60);
        expect(ysCvgBalance60).to.be.eq("2444444444444444444442");

        const ysCvgBalance61 = await lockingPositionService.balanceOfYsCvgAt(1, 61);
        expect(ysCvgBalance61).to.be.eq("0");
    });

    it("Check mgCvg balance on cycles", async () => {
        const balanceOfMgCvgAt1 = await lockingPositionService.balanceOfMgCvgAt(1, 1);
        expect(balanceOfMgCvgAt1).to.be.eq("0");

        const balanceOfMgCvgAt2 = await lockingPositionService.balanceOfMgCvgAt(1, 2);
        expect(balanceOfMgCvgAt2).to.be.eq("625000000000000000000");

        const balanceOfMgCvgAt3 = await lockingPositionService.balanceOfMgCvgAt(1, 3);
        expect(balanceOfMgCvgAt3).to.be.eq("625000000000000000000");

        const balanceOfMgCvgAt8 = await lockingPositionService.balanceOfMgCvgAt(1, 8);
        expect(balanceOfMgCvgAt8).to.be.eq("875000000000000000000");

        const balanceOfMgCvgAt11 = await lockingPositionService.balanceOfMgCvgAt(1, 11);
        expect(balanceOfMgCvgAt11).to.be.eq("3937500000000000000000");

        const balanceOfMgCvgAt12 = await lockingPositionService.balanceOfMgCvgAt(1, 12);
        expect(balanceOfMgCvgAt12).to.be.eq("3937500000000000000000");

        const balanceOfMgCvgAt13 = await lockingPositionService.balanceOfMgCvgAt(1, 13);
        expect(balanceOfMgCvgAt13).to.be.eq("3937500000000000000000");

        const balanceOfMgCvgAt60 = await lockingPositionService.balanceOfMgCvgAt(1, 60);
        expect(balanceOfMgCvgAt60).to.be.eq("3937500000000000000000");

        const balanceOfMgCvgAt61 = await lockingPositionService.balanceOfMgCvgAt(1, 61);
        expect(balanceOfMgCvgAt61).to.be.eq("0");
    });

    it("Mints position 2 at cycle 11 and increase lock time and amount (100% ysCVG)", async () => {
        // mint
        await (await cvgContract.connect(user1).approve(lockingPositionService, ethers.parseEther("1000"))).wait();
        await lockingPositionService.connect(user1).mintPosition(13, ethers.parseEther("1000"), 100, user1, true);

        let balanceOfMgCvg = await lockingPositionService.balanceOfMgCvg(2);
        expect(balanceOfMgCvg).to.be.eq(0);

        // increase lock time and amount
        await (await cvgContract.connect(user1).approve(lockingPositionService, ethers.parseEther("1000"))).wait();
        await lockingPositionService.connect(user1).increaseLockTimeAndAmount(2, 12, ethers.parseEther("1000"), zeroAddress());

        // balance should still be 0 after because the position is 100% ysCVG
        balanceOfMgCvg = await lockingPositionService.balanceOfMgCvg(2);
        expect(balanceOfMgCvg).to.be.eq(0);
    });
});
