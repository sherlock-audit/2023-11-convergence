import {expect} from "chai";
import {MAX_INTEGER, zeroAddress} from "@nomicfoundation/ethereumjs-util";

import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {deployYsDistributorFixture, increaseCvgCycle} from "../../fixtures/fixtures";
import {Signer} from "ethers";
import {ethers} from "hardhat";
import {CvgControlTower} from "../../../typechain-types/contracts";
import {LockingPositionService} from "../../../typechain-types/contracts/Locking";

import {Cvg} from "../../../typechain-types/contracts/Token";
import {IContractsUser, IContracts, IUsers} from "../../../utils/contractInterface";
import {TOKEN_3} from "../../../resources/constant";

describe("LockingPositionManager / max time locking", () => {
    let lockingPositionServiceContract: LockingPositionService, cvgContract: Cvg, controlTowerContract: CvgControlTower;
    let contractUsers: IContractsUser, contracts: IContracts, users: IUsers;
    let owner: Signer, user1: Signer, user2: Signer, user10: Signer, treasuryDao: Signer;

    before(async () => {
        contractUsers = await loadFixture(deployYsDistributorFixture);
        contracts = contractUsers.contracts;
        users = contractUsers.users;

        lockingPositionServiceContract = contracts.locking.lockingPositionService;
        cvgContract = contracts.tokens.cvg;
        controlTowerContract = contracts.base.cvgControlTower;
        user1 = users.user1;
        user2 = users.user2;

        await (await cvgContract.transfer(user1, ethers.parseEther("100000"))).wait();
        await (await cvgContract.transfer(user2, ethers.parseEther("100000"))).wait();
        await (await cvgContract.connect(user1).approve(lockingPositionServiceContract, MAX_INTEGER)).wait();
        await (await cvgContract.connect(user2).approve(lockingPositionServiceContract, MAX_INTEGER)).wait();
    });

    it("increase staking cycle to 12", async () => {
        await increaseCvgCycle(contractUsers, 11);
        const actualCycle = await controlTowerContract.cvgCycle();
        expect(actualCycle).to.be.eq(12);
    });

    it("mint position 1 at cycle 12 for a MAX_LOCK", async () => {
        await (await lockingPositionServiceContract.connect(user1).mintPosition(96, ethers.parseEther("10000"), 40, user1, true)).wait();

        const token1Position = await lockingPositionServiceContract.lockingPositions(1);
        expect(token1Position.startCycle).to.be.eq(12);
        expect(token1Position.lastEndCycle).to.be.eq(108);
        expect(token1Position.totalCvgLocked).to.be.eq(ethers.parseEther("10000"));
        expect(token1Position.mgCvgAmount).to.be.eq(ethers.parseEther("6000"));

        const veCvgBalance = await lockingPositionServiceContract.balanceOfVeCvg(1);
        expect(veCvgBalance).to.be.closeTo("5994885350188168540379", "100000000000000000000"); // 6K modulo 100
    });

    it("increase staking cycle to 100 & 108 & 109 to check veCvgBalance", async () => {
        await increaseCvgCycle(contractUsers, 88);

        let actualCycle = await controlTowerContract.cvgCycle();
        expect(actualCycle).to.be.eq(100);

        let veCvgBalance = await lockingPositionServiceContract.balanceOfVeCvg(1);
        expect(veCvgBalance).to.be.closeTo("556000000000000000000", "70000000000000000000"); // 556 modulo 50

        await increaseCvgCycle(contractUsers, 8);

        actualCycle = await controlTowerContract.cvgCycle();
        expect(actualCycle).to.be.eq(108);

        veCvgBalance = await lockingPositionServiceContract.balanceOfVeCvg(1);
        expect(veCvgBalance).to.be.closeTo("62000000000000000000", "62000000000000000000"); // 62 modulo 60 => block.number that makes the value diverging on localnetwork

        await increaseCvgCycle(contractUsers, 1);

        actualCycle = await controlTowerContract.cvgCycle();
        expect(actualCycle).to.be.eq(109);

        veCvgBalance = await lockingPositionServiceContract.balanceOfVeCvg(1);
        expect(veCvgBalance).to.be.eq("0"); // No more veCvg
    });

    it("increase staking cycle to 120", async () => {
        await increaseCvgCycle(contractUsers, 11);
        const actualCycle = await controlTowerContract.cvgCycle();
        expect(actualCycle).to.be.eq(120);
    });

    it("mint position 2 at cycle 120 for a 84 cycles", async () => {
        await (await lockingPositionServiceContract.connect(user2).mintPosition(84, ethers.parseEther("100"), 50, user2, true)).wait();

        const totalSupplyYsCvg = await lockingPositionServiceContract.totalSupplyYsCvg();
        expect(totalSupplyYsCvg).to.be.eq(0);

        const token2Position = await lockingPositionServiceContract.lockingPositions(2);
        expect(token2Position.startCycle).to.be.eq(120);
        expect(token2Position.lastEndCycle).to.be.eq(204);
        expect(token2Position.totalCvgLocked).to.be.eq(ethers.parseEther("100"));
        expect(token2Position.mgCvgAmount).to.be.eq("43750000000000000000");

        const veCvgBalance = await lockingPositionServiceContract.balanceOfVeCvg(2);
        expect(veCvgBalance).to.be.closeTo(ethers.parseEther("44"), ethers.parseEther("2")); // 44 modulo 2
    });

    it("increase position 2 in time at cycle 120 for 12 cycles => MAX_LOCK", async () => {
        await (await lockingPositionServiceContract.connect(user2).increaseLockTime(2, 12)).wait();

        const totalSupplyYsCvg = await lockingPositionServiceContract.totalSupplyYsCvg();
        expect(totalSupplyYsCvg).to.be.eq(0);

        const token2Position = await lockingPositionServiceContract.lockingPositions(2);
        expect(token2Position.startCycle).to.be.eq(120);
        expect(token2Position.lastEndCycle).to.be.eq(216);
        expect(token2Position.totalCvgLocked).to.be.eq(ethers.parseEther("100"));
        expect(token2Position.mgCvgAmount).to.be.eq("43750000000000000000");

        const veCvgBalance = await lockingPositionServiceContract.balanceOfVeCvg(2);
        expect(veCvgBalance).to.be.closeTo(ethers.parseEther("50"), ethers.parseEther("2")); // 50 modulo 2
    });

    it("mint position 3 at cycle 120 for 72 cycles", async () => {
        await (await lockingPositionServiceContract.connect(user2).mintPosition(72, ethers.parseEther("100"), 50, user2, true)).wait();

        const totalSupplyYsCvg = await lockingPositionServiceContract.totalSupplyYsCvg();
        expect(totalSupplyYsCvg).to.be.eq(0);

        const token3Position = await lockingPositionServiceContract.lockingPositions(3);
        expect(token3Position.startCycle).to.be.eq(120);
        expect(token3Position.lastEndCycle).to.be.eq(192);
        expect(token3Position.totalCvgLocked).to.be.eq(ethers.parseEther("100"));
        expect(token3Position.mgCvgAmount).to.be.eq("37500000000000000000");

        const veCvgBalance = await lockingPositionServiceContract.balanceOfVeCvg(3);
        expect(veCvgBalance).to.be.closeTo(ethers.parseEther("38"), ethers.parseEther("1")); // 38 modulo 1
    });

    it("increase position 3 in time & amount at cycle 120 for 24 cycles => MAX_LOCK", async () => {
        await (await lockingPositionServiceContract.connect(user2).increaseLockTimeAndAmount(TOKEN_3, 24, ethers.parseEther("100"), zeroAddress())).wait();

        const totalSupplyYsCvg = await lockingPositionServiceContract.totalSupplyYsCvg();
        expect(totalSupplyYsCvg).to.be.eq(0);

        const token3Position = await lockingPositionServiceContract.lockingPositions(3);
        expect(token3Position.startCycle).to.be.eq(120);
        expect(token3Position.lastEndCycle).to.be.eq(216);
        expect(token3Position.totalCvgLocked).to.be.eq(ethers.parseEther("200"));
        expect(token3Position.mgCvgAmount).to.be.eq("87500000000000000000"); // 38 modulo 1

        const veCvgBalance = await lockingPositionServiceContract.balanceOfVeCvg(3);
        expect(veCvgBalance).to.be.closeTo(ethers.parseEther("100"), ethers.parseEther("2")); // 100 modulo 1
    });

    it("increase staking cycle to 150 & 200 & 216 & 217 to check veCvgBalance", async () => {
        await increaseCvgCycle(contractUsers, 30);

        let actualCycle = await controlTowerContract.cvgCycle();
        expect(actualCycle).to.be.eq(150);

        let veCvgBalance2 = await lockingPositionServiceContract.balanceOfVeCvg(2);

        expect(veCvgBalance2).to.be.closeTo(ethers.parseEther("34"), ethers.parseEther("2")); // 34 modulo 2
        let veCvgBalance3 = await lockingPositionServiceContract.balanceOfVeCvg(3);
        expect(veCvgBalance3).to.be.closeTo(ethers.parseEther("68"), ethers.parseEther("2")); // 68 modulo 2

        await increaseCvgCycle(contractUsers, 50);

        actualCycle = await controlTowerContract.cvgCycle();
        expect(actualCycle).to.be.eq(200);

        veCvgBalance2 = await lockingPositionServiceContract.balanceOfVeCvg(2);
        expect(veCvgBalance2).to.be.closeTo(ethers.parseEther("9"), ethers.parseEther("1")); // 9 modulo 1
        veCvgBalance3 = await lockingPositionServiceContract.balanceOfVeCvg(3);
        expect(veCvgBalance3).to.be.closeTo(ethers.parseEther("18"), ethers.parseEther("2")); // 18 modulo 2

        await increaseCvgCycle(contractUsers, 16);

        actualCycle = await controlTowerContract.cvgCycle();
        expect(actualCycle).to.be.eq(216);

        veCvgBalance2 = await lockingPositionServiceContract.balanceOfVeCvg(2);
        expect(veCvgBalance2).to.be.closeTo("469561378388563524", "500000000000000000"); // 0.5 modulo 0.35
        veCvgBalance3 = await lockingPositionServiceContract.balanceOfVeCvg(3);

        expect(veCvgBalance3).to.be.closeTo("939027300496103784", "800000000000000000"); // 0.93 modulo 0.2

        await increaseCvgCycle(contractUsers, 1);

        actualCycle = await controlTowerContract.cvgCycle();
        expect(actualCycle).to.be.eq(217);

        veCvgBalance2 = await lockingPositionServiceContract.balanceOfVeCvg(2);
        expect(veCvgBalance2).to.be.eq("0"); // 0
        veCvgBalance3 = await lockingPositionServiceContract.balanceOfVeCvg(3);
        expect(veCvgBalance3).to.be.eq("0"); // 0
    });
});
