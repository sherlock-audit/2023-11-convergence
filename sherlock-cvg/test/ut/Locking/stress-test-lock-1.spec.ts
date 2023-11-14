import {expect} from "chai";
import {MAX_INTEGER, zeroAddress} from "@nomicfoundation/ethereumjs-util";

import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {deployYsDistributorFixture} from "../../fixtures/fixtures";

describe.skip("LockingPositionManager / Stress test Lock with large intervals", () => {
    let lockingPositionManagerContract, lockingPositionServiceContract, cvgContract, controlTowerContract;
    let contractUsers, contracts, users;
    let user1, user2, user10;

    before(async () => {
        contractUsers = await loadFixture(deployYsDistributorFixture);
        contracts = contractUsers.contracts;
        users = contractUsers.users;

        lockingPositionServiceContract = contracts.lockingPositionServiceContract;
        lockingPositionManagerContract = contracts.lockingPositionManagerContract;
        cvgContract = contracts.cvgContract;
        controlTowerContract = contracts.controlTowerContract;
        user1 = users.user1;
        user2 = users.user2;
        user10 = users.user10;

        await (await cvgContract.transfer(user1, ethers.parseEther("100000"))).wait();
        await (await cvgContract.transfer(user2, ethers.parseEther("100000"))).wait();
    });

    it("Mint position at cycle 1", async () => {
        await cvgContract.connect(user1).approve(lockingPositionServiceContract, MAX_INTEGER);
        const tx = await lockingPositionServiceContract.connect(user1).mintPosition(47, LOCKING_POSITIONS[0].cvgAmount, 50, user1, true); // Lock 100 CVG for 48 cycles
        const tokenId = 1;
        await lockingPositionServiceContract.connect(user1).increaseLockTime(tokenId, 12);
        const receipt = await tx.wait();
        // console.log("Gas used: ", receipt.gasUsed.toString());
        const veCvgBalance = await lockingPositionServiceContract.balanceOfVeCvg(tokenId);
        // console.log("VeCvg id:", veCvgBalance.toString());
    });
    it("Mint position at cycle 12", async () => {
        await TestHelper.increaseCvgCycle(contracts, users, 11);

        const actualCycle = await controlTowerContract.cvgCycle();
        // console.log("Cycle:", actualCycle.toString());
        const tx = await lockingPositionServiceContract.connect(user1).mintPosition(48, LOCKING_POSITIONS[0].cvgAmount, 50, user1, true);
        const tokenId = 2;
        await lockingPositionServiceContract.connect(user1).increaseLockTime(tokenId, 12);
        const receipt = await tx.wait();
        // console.log("Gas used: ", receipt.gasUsed.toString());
        const veCvgBalance = await lockingPositionServiceContract.balanceOfVeCvg(tokenId);
        // console.log(`VeCvg for tokenId ${tokenId}`, veCvgBalance.toString());
    });
    it("Mint position at cycle 24", async () => {
        await TestHelper.increaseCvgCycle(contracts, users, 12);
        const actualCycle = await controlTowerContract.cvgCycle();
        // console.log("Cycle:", actualCycle.toString());
        const tx = await lockingPositionServiceContract.connect(user1).mintPosition(48, LOCKING_POSITIONS[0].cvgAmount, 50, user1, true);
        const tokenId = 3;
        await lockingPositionServiceContract.connect(user1).increaseLockTime(tokenId, 12);
        const receipt = await tx.wait();
        // console.log("Gas used: ", receipt.gasUsed.toString());
        const veCvgBalance = await lockingPositionServiceContract.balanceOfVeCvg(tokenId);
        // console.log(`VeCvg for tokenId ${tokenId}`, veCvgBalance.toString());
    });
    it("Mint position at cycle 48", async () => {
        await TestHelper.increaseCvgCycle(contracts, users, 24);
        const actualCycle = await controlTowerContract.cvgCycle();
        // console.log("Cycle:", actualCycle.toString());
        const tx = await lockingPositionServiceContract.connect(user1).mintPosition(48, LOCKING_POSITIONS[0].cvgAmount, 50, user1, true);
        const tokenId = 4;
        await lockingPositionServiceContract.connect(user1).increaseLockTime(tokenId, 12);
        const receipt = await tx.wait();
        // console.log("Gas used: ", receipt.gasUsed.toString());
        const veCvgBalance = await lockingPositionServiceContract.balanceOfVeCvg(tokenId);
        // console.log(`VeCvg for tokenId ${tokenId}`, veCvgBalance.toString());
    });
    it("Mint position at cycle 96", async () => {
        await TestHelper.increaseCvgCycle(contracts, users, 48);

        const actualCycle = await controlTowerContract.cvgCycle();
        // console.log("Cycle:", actualCycle.toString());
        const tx = await lockingPositionServiceContract.connect(user1).mintPosition(48, LOCKING_POSITIONS[0].cvgAmount, 50, user1, true);
        const tokenId = 5;
        await lockingPositionServiceContract.connect(user1).increaseLockTime(tokenId, 12);
        const receipt = await tx.wait();
        // console.log("Gas used: ", receipt.gasUsed.toString());
        const veCvgBalance = await lockingPositionServiceContract.balanceOfVeCvg(tokenId);
        // console.log(`VeCvg for tokenId ${tokenId}`, veCvgBalance.toString());
    });
    it("Mint position at cycle 120", async () => {
        await TestHelper.increaseCvgCycle(contracts, users, 24);

        const actualCycle = await controlTowerContract.cvgCycle();
        // console.log("Cycle:", actualCycle.toString());
        const tx = await lockingPositionServiceContract.connect(user1).mintPosition(48, LOCKING_POSITIONS[0].cvgAmount, 50, user1, true);
        const tokenId = 6;
        await lockingPositionServiceContract.connect(user1).increaseLockTime(tokenId, 12);
        const receipt = await tx.wait();
        // console.log("Gas used: ", receipt.gasUsed.toString());
        const veCvgBalance = await lockingPositionServiceContract.balanceOfVeCvg(tokenId);
        // console.log(`VeCvg for tokenId ${tokenId}`, veCvgBalance.toString());
    });
    it("Mint position at cycle 144", async () => {
        await TestHelper.increaseCvgCycle(contracts, users, 24);

        const actualCycle = await controlTowerContract.cvgCycle();
        // console.log("Cycle:", actualCycle.toString());
        const tx = await lockingPositionServiceContract.connect(user1).mintPosition(48, LOCKING_POSITIONS[0].cvgAmount, 50, user1, true);
        const tokenId = 7;
        await lockingPositionServiceContract.connect(user1).increaseLockTime(tokenId, 12);
        const receipt = await tx.wait();
        // console.log("Gas used: ", receipt.gasUsed.toString());
        const veCvgBalance = await lockingPositionServiceContract.balanceOfVeCvg(tokenId);
        // console.log(`VeCvg for tokenId ${tokenId}`, veCvgBalance.toString());
    });
    it("Mint position at cycle 192", async () => {
        await TestHelper.increaseCvgCycle(contracts, users, 48);

        const actualCycle = await controlTowerContract.cvgCycle();
        // console.log("Cycle:", actualCycle.toString());
        const tx = await lockingPositionServiceContract.connect(user1).mintPosition(48, LOCKING_POSITIONS[0].cvgAmount, 50, user1, true);
        const tokenId = 8;
        await lockingPositionServiceContract.connect(user1).increaseLockTime(tokenId, 12);
        const receipt = await tx.wait();
        // console.log("Gas used: ", receipt.gasUsed.toString());
        const veCvgBalance = await lockingPositionServiceContract.balanceOfVeCvg(tokenId);
        // console.log(`VeCvg for tokenId ${tokenId}`, veCvgBalance.toString());
    });
    it("Mint position at cycle 240", async () => {
        await TestHelper.increaseCvgCycle(contracts, users, 48);

        const actualCycle = await controlTowerContract.cvgCycle();
        // console.log("Cycle:", actualCycle.toString());
        const tx = await lockingPositionServiceContract.connect(user1).mintPosition(48, LOCKING_POSITIONS[0].cvgAmount, 50, user1, true);
        const tokenId = 9;
        await lockingPositionServiceContract.connect(user1).increaseLockTime(tokenId, 12);
        const receipt = await tx.wait();
        // console.log("Gas used: ", receipt.gasUsed.toString());
        const veCvgBalance = await lockingPositionServiceContract.balanceOfVeCvg(tokenId);
        // console.log(`VeCvg for tokenId ${tokenId}`, veCvgBalance.toString());
    });
    it("Mint position at cycle 288", async () => {
        await TestHelper.increaseCvgCycle(contracts, users, 48);

        const actualCycle = await controlTowerContract.cvgCycle();
        // console.log("Cycle:", actualCycle.toString());
        const tx = await lockingPositionServiceContract.connect(user1).mintPosition(48, LOCKING_POSITIONS[0].cvgAmount, 50, user1, true);
        const tokenId = 10;
        await lockingPositionServiceContract.connect(user1).increaseLockTime(tokenId, 12);
        const receipt = await tx.wait();
        // console.log("Gas used: ", receipt.gasUsed.toString());
        const veCvgBalance = await lockingPositionServiceContract.balanceOfVeCvg(tokenId);
        // console.log(`VeCvg for tokenId ${tokenId}`, veCvgBalance.toString());
    });
});
