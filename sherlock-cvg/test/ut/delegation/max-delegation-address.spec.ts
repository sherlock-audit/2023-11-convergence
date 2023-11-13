import chai from "chai";
import chaiAsPromised from "chai-as-promised";
chai.use(chaiAsPromised).should();
const expect = chai.expect;
import {ethers} from "hardhat";

import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {deployYsDistributorFixture, increaseCvgCycle} from "../../fixtures/fixtures";
import {Signer} from "ethers";
import {LockingPositionDelegate, LockingPositionService, Cvg} from "../../../typechain-types";
import {IContractsUser} from "../../../utils/contractInterface";
import {LOCKING_POSITIONS} from "../Locking/config/lockingTestConfig";

describe("LockingPositionManager max delegation per address", () => {
    let lockingPositionDelegate: LockingPositionDelegate, lockingPositionService: LockingPositionService, cvgContract: Cvg;
    let user1: Signer, user2: Signer, user9: Signer, user10: Signer;
    let treasuryDao: Signer;

    let contractsUsers: IContractsUser;
    before(async () => {
        contractsUsers = await loadFixture(deployYsDistributorFixture);
        const contracts = contractsUsers.contracts;
        const users = contractsUsers.users;

        lockingPositionService = contracts.locking.lockingPositionService;
        lockingPositionDelegate = contracts.locking.lockingPositionDelegate;
        cvgContract = contracts.tokens.cvg;
        user1 = users.user1;
        user2 = users.user2;
        user9 = users.user9;
        user10 = users.user10;
        treasuryDao = users.treasuryDao;

        await (await cvgContract.transfer(user1, ethers.parseEther("100000"))).wait();
        await (await cvgContract.transfer(user2, ethers.parseEther("100000"))).wait();

        await (await cvgContract.connect(user1).approve(lockingPositionService, ethers.parseEther("100000"))).wait();
        await (await cvgContract.connect(user2).approve(lockingPositionService, ethers.parseEther("100000"))).wait();

        // increase staking cycle to 5
        await increaseCvgCycle(contractsUsers, LOCKING_POSITIONS[0].lockCycle - 1);

        // MINT POSITION 1
        await (await lockingPositionService.connect(user1).mintPosition(LOCKING_POSITIONS[0].duration, LOCKING_POSITIONS[0].cvgAmount, 60, user1, true)).wait(); // Lock 100 CVG for 43 cycles
        // MINT POSITION 2
        await (await lockingPositionService.connect(user1).mintPosition(LOCKING_POSITIONS[0].duration, LOCKING_POSITIONS[0].cvgAmount, 60, user1, true)).wait(); // Lock 100 CVG for 43 cycles

        // increase staking cycle to 12
        await increaseCvgCycle(contractsUsers, LOCKING_POSITIONS[2].lockCycle - LOCKING_POSITIONS[0].lockCycle);
        // MINT POSITION 3
        await (await lockingPositionService.connect(user2).mintPosition(LOCKING_POSITIONS[2].duration, LOCKING_POSITIONS[2].cvgAmount, 60, user2, true)).wait(); // Lock 50 CVG for 15 cycles
    });
    it("Set max mg delegatees should revert if not owner of lockingPositionManager", async function () {
        await lockingPositionDelegate.connect(user1).setMaxTokenIdsDelegated(4).should.be.revertedWith("NOT_OWNER");
    });
    it("Set max token Ids delegated ", async () => {
        (await lockingPositionDelegate.maxTokenIdsDelegated()).should.be.equal(25);
        await lockingPositionDelegate.connect(treasuryDao).setMaxTokenIdsDelegated(2);
        (await lockingPositionDelegate.maxTokenIdsDelegated()).should.be.equal(2);
    });
    it("Delegates mgCvg of tokenId 1 and 2 to user9 should compute right infos", async () => {
        await lockingPositionDelegate.connect(user1).delegateMgCvg(1, user9, 40);
        await lockingPositionDelegate.connect(user1).delegateMgCvg(2, user9, 20);
        const tokenIdsMgDelegatedToUser9 = await lockingPositionDelegate.getMgCvgDelegatees(user9);
        tokenIdsMgDelegatedToUser9.length.should.be.equal(2);
    });
    it("Delegate mgCvg tokenId 3 to user9 should revert because max tokenIds delegated is reached", async () => {
        await lockingPositionDelegate.connect(user2).delegateMgCvg(3, user9, 60).should.be.revertedWith("TOO_MUCH_MG_TOKEN_ID_DELEGATED");
    });
    it("Delegates veCvg of tokenId 1 and 2 to user9 should compute right infos", async () => {
        await lockingPositionDelegate.connect(user1).delegateVeCvg(1, user9);
        await lockingPositionDelegate.connect(user1).delegateVeCvg(2, user9);
        const tokenIdsVeDelegatedToUser9 = await lockingPositionDelegate.getVeCvgDelegatees(user9);
        tokenIdsVeDelegatedToUser9.length.should.be.equal(2);
    });
    it("Delegate veCvg tokenId 3 to user9 should revert because max tokenIds delegated is reached", async () => {
        await lockingPositionDelegate.connect(user2).delegateVeCvg(3, user9).should.be.revertedWith("TOO_MUCH_VE_TOKEN_ID_DELEGATED");
    });
    it("Clean tokenId with random user not delegatee should revert", async () => {
        await lockingPositionDelegate.connect(user10).removeTokenIdDelegated(1, true, false).should.be.revertedWith("NOT_VE_DELEGATEE");
        await lockingPositionDelegate.connect(user10).removeTokenIdDelegated(1, false, true).should.be.revertedWith("NOT_MG_DELEGATEE");
    });
    it("Clean tokenId with owner of tokenId should revert", async () => {
        await lockingPositionDelegate.connect(user1).removeTokenIdDelegated(1, true, false).should.be.revertedWith("NOT_VE_DELEGATEE");
        await lockingPositionDelegate.connect(user1).removeTokenIdDelegated(1, false, true).should.be.revertedWith("NOT_MG_DELEGATEE");
    });
    it("Asserts nothing changes when cleaning tokenId with false values", async () => {
        await lockingPositionDelegate.connect(user9).removeTokenIdDelegated(1, false, false);

        const tokenIdsMgDelegatedToUser9 = await lockingPositionDelegate.getMgCvgDelegatees(user9);
        const tokenIdsVeDelegatedToUser9 = await lockingPositionDelegate.getVeCvgDelegatees(user9);

        // assert nothing has been executed (therefore changed)
        expect(tokenIdsMgDelegatedToUser9.length).to.be.equal(2);
        expect(tokenIdsVeDelegatedToUser9.length).to.be.equal(2);
    });

    it("Checks delegatee user9 indexes for veCVG and mgCVG", async () => {
        expect(await lockingPositionDelegate.getIndexForVeDelegatee(user9, 1)).to.be.equal(0);
        expect(await lockingPositionDelegate.getIndexForVeDelegatee(user9, 2)).to.be.equal(1);

        expect(await lockingPositionDelegate.getIndexForMgCvgDelegatee(user9, 1)).to.be.equal(0);
        expect(await lockingPositionDelegate.getIndexForMgCvgDelegatee(user9, 2)).to.be.equal(1);
    });

    it("Clean tokenId (by delegatee himself) should compute right infos", async () => {
        await lockingPositionDelegate.connect(user9).removeTokenIdDelegated(1, true, true);
        await lockingPositionDelegate.connect(user9).removeTokenIdDelegated(2, true, true);
        const tokenIdsMgDelegatedToUser9 = await lockingPositionDelegate.getMgCvgDelegatees(user9);
        const tokenIdsVeDelegatedToUser9 = await lockingPositionDelegate.getVeCvgDelegatees(user9);
        tokenIdsMgDelegatedToUser9.length.should.be.equal(0);
        tokenIdsVeDelegatedToUser9.length.should.be.equal(0);
    });
    it("Delegate mgCvg tokenId 3 to user9 should work because delegated tokens are cleaned", async () => {
        await lockingPositionDelegate.connect(user2).delegateVeCvg(3, user9);
        const tokenIdsVeDelegatedToUser9 = await lockingPositionDelegate.getVeCvgDelegatees(user9);
        tokenIdsVeDelegatedToUser9.length.should.be.equal(1);
    });
});
