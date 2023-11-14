import {expect} from "chai";
import {MAX_INTEGER, zeroAddress} from "@nomicfoundation/ethereumjs-util";

import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {deployYsDistributorFixture} from "../../fixtures/fixtures";

describe.skip("LockingPositionManager / Stress test Lock at each cycle", () => {
    let lockingPositionManagerContract, lockingPositionServiceContract, cvgContract, controlTowerContract;
    let contractUsers, contracts, users;
    let user1, user2, user10;
    let amount;
    let tokenId;

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
        await cvgContract.connect(user1).approve(lockingPositionServiceContract, MAX_INTEGER);
        amount = LOCKING_POSITIONS[0].cvgAmount;
        tokenId = 1;
    });
    it("Mint position + Increase lockTime at cycle 1 to 24", async () => {
        let lockTime = 47;
        for (let i = 1; i <= 24; i++) {
            const tx_mint = await lockingPositionServiceContract.connect(user1).mintPosition(lockTime, amount, 50, user1, true);
            const receipt_mint = await tx_mint.wait();
            const tx_time = await lockingPositionServiceContract.connect(user1).increaseLockTime(tokenId, 12);
            const receipt_time = await tx_time.wait();
            const tx_amount = await lockingPositionServiceContract.connect(user1).increaseLockAmount(tokenId, 10, zeroAddress());
            const receipt_amount = await tx_amount.wait();
            // console.log(`Cycle ${i}`);
            // console.log(`Gas used for mint: ${receipt_mint.gasUsed.toString()}`);
            // console.log(`Gas used for time: ${receipt_time.gasUsed.toString()}`);
            // console.log(`Gas used for amount: ${receipt_amount.gasUsed.toString()}`);
            await TestHelper.increaseCvgCycle(contracts, users, 1);
            lockTime--;
            tokenId++;
        }
    });
    it("Mint position + Increase lockTime at cycle 25 to 48", async () => {
        let lockTime = 47;
        for (let i = 25; i <= 48; i++) {
            const tx_mint = await lockingPositionServiceContract.connect(user1).mintPosition(lockTime, amount, 50, user1, true);
            const receipt_mint = await tx_mint.wait();
            const tx_time = await lockingPositionServiceContract.connect(user1).increaseLockTime(tokenId, 12);
            const receipt_time = await tx_time.wait();
            const tx_amount = await lockingPositionServiceContract.connect(user1).increaseLockAmount(tokenId, 10, zeroAddress());
            const receipt_amount = await tx_amount.wait();
            // console.log(`Cycle ${i}`);
            // console.log(`Gas used for mint: ${receipt_mint.gasUsed.toString()}`);
            // console.log(`Gas used for time: ${receipt_time.gasUsed.toString()}`);
            // console.log(`Gas used for amount: ${receipt_amount.gasUsed.toString()}`);
            await TestHelper.increaseCvgCycle(contracts, users, 1);
            lockTime--;
            tokenId++;
        }
    });
    it("Mint position + Increase lockTime at cycle 49 to 72", async () => {
        let lockTime = 47;
        for (let i = 49; i <= 72; i++) {
            const tx_mint = await lockingPositionServiceContract.connect(user1).mintPosition(lockTime, amount, 50, user1, true);
            const receipt_mint = await tx_mint.wait();
            const tx_time = await lockingPositionServiceContract.connect(user1).increaseLockTime(tokenId, 12);
            const receipt_time = await tx_time.wait();
            const tx_amount = await lockingPositionServiceContract.connect(user1).increaseLockAmount(tokenId, 10, zeroAddress());
            const receipt_amount = await tx_amount.wait();
            // console.log(`Cycle ${i}`);
            // console.log(`Gas used for mint: ${receipt_mint.gasUsed.toString()}`);
            // console.log(`Gas used for time: ${receipt_time.gasUsed.toString()}`);
            // console.log(`Gas used for amount: ${receipt_amount.gasUsed.toString()}`);
            await TestHelper.increaseCvgCycle(contracts, users, 1);
            lockTime--;
            tokenId++;
        }
    });
    it("Mint position + Increase lockTime at cycle 73 to 96", async () => {
        let lockTime = 47;
        for (let i = 73; i <= 96; i++) {
            const tx_mint = await lockingPositionServiceContract.connect(user1).mintPosition(lockTime, amount, 50, user1, true);
            const receipt_mint = await tx_mint.wait();
            const tx_time = await lockingPositionServiceContract.connect(user1).increaseLockTime(tokenId, 12);
            const receipt_time = await tx_time.wait();
            const tx_amount = await lockingPositionServiceContract.connect(user1).increaseLockAmount(tokenId, 10, zeroAddress());
            const receipt_amount = await tx_amount.wait();
            // console.log(`Cycle ${i}`);
            // console.log(`Gas used for mint: ${receipt_mint.gasUsed.toString()}`);
            // console.log(`Gas used for time: ${receipt_time.gasUsed.toString()}`);
            // console.log(`Gas used for amount: ${receipt_amount.gasUsed.toString()}`);
            await TestHelper.increaseCvgCycle(contracts, users, 1);
            lockTime--;
            tokenId++;
        }
    });
    it("Mint position + Increase lockTime at cycle 97 to 120", async () => {
        let lockTime = 47;
        for (let i = 97; i <= 120; i++) {
            const tx_mint = await lockingPositionServiceContract.connect(user1).mintPosition(lockTime, amount, 50, user1, true);
            const receipt_mint = await tx_mint.wait();
            const tx_time = await lockingPositionServiceContract.connect(user1).increaseLockTime(tokenId, 12);
            const receipt_time = await tx_time.wait();
            const tx_amount = await lockingPositionServiceContract.connect(user1).increaseLockAmount(tokenId, 10, zeroAddress());
            const receipt_amount = await tx_amount.wait();
            // console.log(`Cycle ${i}`);
            // console.log(`Gas used for mint: ${receipt_mint.gasUsed.toString()}`);
            // console.log(`Gas used for time: ${receipt_time.gasUsed.toString()}`);
            // console.log(`Gas used for amount: ${receipt_amount.gasUsed.toString()}`);
            await TestHelper.increaseCvgCycle(contracts, users, 1);
            lockTime--;
            tokenId++;
        }
    });
    it("Mint position + Increase lockTime at cycle 121 to 144", async () => {
        let lockTime = 47;
        for (let i = 121; i <= 144; i++) {
            const tx_mint = await lockingPositionServiceContract.connect(user1).mintPosition(lockTime, amount, 50, user1, true);
            const receipt_mint = await tx_mint.wait();
            const tx_time = await lockingPositionServiceContract.connect(user1).increaseLockTime(tokenId, 12);
            const receipt_time = await tx_time.wait();
            const tx_amount = await lockingPositionServiceContract.connect(user1).increaseLockAmount(tokenId, 10, zeroAddress());
            const receipt_amount = await tx_amount.wait();
            // console.log(`Cycle ${i}`);
            // console.log(`Gas used for mint: ${receipt_mint.gasUsed.toString()}`);
            // console.log(`Gas used for time: ${receipt_time.gasUsed.toString()}`);
            // console.log(`Gas used for amount: ${receipt_amount.gasUsed.toString()}`);
            await TestHelper.increaseCvgCycle(contracts, users, 1);
            lockTime--;
            tokenId++;
        }
    });
    it("Mint position + Increase lockTime at cycle 145 to 168", async () => {
        let lockTime = 47;
        for (let i = 145; i <= 168; i++) {
            const tx_mint = await lockingPositionServiceContract.connect(user1).mintPosition(lockTime, amount, 50, user1, true);
            const receipt_mint = await tx_mint.wait();
            const tx_time = await lockingPositionServiceContract.connect(user1).increaseLockTime(tokenId, 12);
            const receipt_time = await tx_time.wait();
            const tx_amount = await lockingPositionServiceContract.connect(user1).increaseLockAmount(tokenId, 10, zeroAddress());
            const receipt_amount = await tx_amount.wait();
            // console.log(`Cycle ${i}`);
            // console.log(`Gas used for mint: ${receipt_mint.gasUsed.toString()}`);
            // console.log(`Gas used for time: ${receipt_time.gasUsed.toString()}`);
            // console.log(`Gas used for amount: ${receipt_amount.gasUsed.toString()}`);
            await TestHelper.increaseCvgCycle(contracts, users, 1);
            lockTime--;
            tokenId++;
        }
    });
    it("Mint position + Increase lockTime at cycle 169 to 192", async () => {
        let lockTime = 47;
        for (let i = 169; i <= 192; i++) {
            const tx_mint = await lockingPositionServiceContract.connect(user1).mintPosition(lockTime, amount, 50, user1, true);
            const receipt_mint = await tx_mint.wait();
            const tx_time = await lockingPositionServiceContract.connect(user1).increaseLockTime(tokenId, 12);
            const receipt_time = await tx_time.wait();
            const tx_amount = await lockingPositionServiceContract.connect(user1).increaseLockAmount(tokenId, 10, zeroAddress());
            const receipt_amount = await tx_amount.wait();
            // console.log(`Cycle ${i}`);
            // console.log(`Gas used for mint: ${receipt_mint.gasUsed.toString()}`);
            // console.log(`Gas used for time: ${receipt_time.gasUsed.toString()}`);
            // console.log(`Gas used for amount: ${receipt_amount.gasUsed.toString()}`);
            await TestHelper.increaseCvgCycle(contracts, users, 1);
            lockTime--;
            tokenId++;
        }
    });
    it("Mint position + Increase lockTime at cycle 193 to 216", async () => {
        let lockTime = 47;
        for (let i = 193; i <= 216; i++) {
            const tx_mint = await lockingPositionServiceContract.connect(user1).mintPosition(lockTime, amount, 50, user1, true);
            const receipt_mint = await tx_mint.wait();
            const tx_time = await lockingPositionServiceContract.connect(user1).increaseLockTime(tokenId, 12);
            const receipt_time = await tx_time.wait();
            const tx_amount = await lockingPositionServiceContract.connect(user1).increaseLockAmount(tokenId, 10, zeroAddress());
            const receipt_amount = await tx_amount.wait();
            // console.log(`Cycle ${i}`);
            // console.log(`Gas used for mint: ${receipt_mint.gasUsed.toString()}`);
            // console.log(`Gas used for time: ${receipt_time.gasUsed.toString()}`);
            // console.log(`Gas used for amount: ${receipt_amount.gasUsed.toString()}`);
            await TestHelper.increaseCvgCycle(contracts, users, 1);
            lockTime--;
            tokenId++;
        }
    });
    it("Mint position + Increase lockTime at cycle 217 to 240", async () => {
        let lockTime = 47;
        for (let i = 217; i <= 240; i++) {
            const tx_mint = await lockingPositionServiceContract.connect(user1).mintPosition(lockTime, amount, 50, user1, true);
            const receipt_mint = await tx_mint.wait();
            const tx_time = await lockingPositionServiceContract.connect(user1).increaseLockTime(tokenId, 12);
            const receipt_time = await tx_time.wait();
            const tx_amount = await lockingPositionServiceContract.connect(user1).increaseLockAmount(tokenId, 10, zeroAddress());
            const receipt_amount = await tx_amount.wait();
            // console.log(`Cycle ${i}`);
            // console.log(`Gas used for mint: ${receipt_mint.gasUsed.toString()}`);
            // console.log(`Gas used for time: ${receipt_time.gasUsed.toString()}`);
            // console.log(`Gas used for amount: ${receipt_amount.gasUsed.toString()}`);
            await TestHelper.increaseCvgCycle(contracts, users, 1);
            lockTime--;
            tokenId++;
        }
    });
    it("Mint position + Increase lockTime at cycle 241 to 264", async () => {
        let lockTime = 47;
        for (let i = 241; i <= 264; i++) {
            const tx_mint = await lockingPositionServiceContract.connect(user1).mintPosition(lockTime, amount, 50, user1, true);
            const receipt_mint = await tx_mint.wait();
            const tx_time = await lockingPositionServiceContract.connect(user1).increaseLockTime(tokenId, 12);
            const receipt_time = await tx_time.wait();
            const tx_amount = await lockingPositionServiceContract.connect(user1).increaseLockAmount(tokenId, 10, zeroAddress());
            const receipt_amount = await tx_amount.wait();
            // console.log(`Cycle ${i}`);
            // console.log(`Gas used for mint: ${receipt_mint.gasUsed.toString()}`);
            // console.log(`Gas used for time: ${receipt_time.gasUsed.toString()}`);
            // console.log(`Gas used for amount: ${receipt_amount.gasUsed.toString()}`);
            await TestHelper.increaseCvgCycle(contracts, users, 1);
            lockTime--;
            tokenId++;
        }
    });
});
