import chai from "chai";
import chaiAsPromised from "chai-as-promised";
chai.use(chaiAsPromised).should();
const expect = chai.expect;
import {ethers} from "hardhat";

import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {deployYsDistributorFixture, increaseCvgCycle} from "../../fixtures/fixtures";
import {LockingPositionDelegate, LockingPositionManager, LockingPositionService} from "../../../typechain-types";
import {Signer} from "ethers";
import {IContractsUser} from "../../../utils/contractInterface";
import {LOCKING_POSITIONS} from "../Locking/config/lockingTestConfig";

describe("LockingPositionManager / mgCVG balance delegation", () => {
    let lockingPositionDelegate: LockingPositionDelegate,
        lockingPositionService: LockingPositionService,
        lockingPositionManager: LockingPositionManager,
        cvgContract,
        controlTowerContract;
    let user1: Signer, user2: Signer, user3: Signer, user10: Signer;
    let treasuryDao: Signer;

    let contractsUsers: IContractsUser;

    before(async () => {
        contractsUsers = await loadFixture(deployYsDistributorFixture);
        const contracts = contractsUsers.contracts;
        const users = contractsUsers.users;

        lockingPositionService = contracts.locking.lockingPositionService;
        lockingPositionManager = contracts.locking.lockingPositionManager;
        lockingPositionDelegate = contracts.locking.lockingPositionDelegate;
        cvgContract = contracts.tokens.cvg;
        controlTowerContract = contracts.base.cvgControlTower;
        user1 = users.user1;
        user2 = users.user2;
        user3 = users.user3;
        user10 = users.user10;
        treasuryDao = users.treasuryDao;

        await (await cvgContract.transfer(user1, ethers.parseEther("100000"))).wait();
        await (await cvgContract.transfer(user2, ethers.parseEther("100000"))).wait();

        await (await cvgContract.connect(user1).approve(lockingPositionService, LOCKING_POSITIONS[0].cvgAmount)).wait();
        await (await cvgContract.connect(user2).approve(lockingPositionService, LOCKING_POSITIONS[2].cvgAmount)).wait();

        // increase staking cycle to 5
        await increaseCvgCycle(contractsUsers, LOCKING_POSITIONS[0].lockCycle - 1);

        // MINT POSITION 1
        await (await lockingPositionService.connect(user1).mintPosition(LOCKING_POSITIONS[0].duration, LOCKING_POSITIONS[0].cvgAmount, 60, user1, true)).wait(); // Lock 100 CVG for 43 cycles

        // increase staking cycle to 12
        await increaseCvgCycle(contractsUsers, LOCKING_POSITIONS[2].lockCycle - LOCKING_POSITIONS[0].lockCycle);

        // MINT POSITION 2
        await (await lockingPositionService.connect(user2).mintPosition(LOCKING_POSITIONS[2].duration, LOCKING_POSITIONS[2].cvgAmount, 60, user2, true)).wait(); // Lock 4 000 CVG for 15 cycles
    });
    it("Set max mg delegatees should revert if not owner of lockingPositionManager", async function () {
        await lockingPositionDelegate.connect(user1).setMaxMgDelegatees(4).should.be.revertedWith("NOT_OWNER");
    });
    it("Set max mg delegatees with owner of lockingPositionManager should compute right info", async function () {
        (await lockingPositionDelegate.maxMgDelegatees()).should.be.equal(5);
        await lockingPositionDelegate.connect(treasuryDao).setMaxMgDelegatees(4);
        (await lockingPositionDelegate.maxMgDelegatees()).should.be.equal(4);
    });

    it("Tries to delegate mgCVG with 150% power to user10", async () => {
        const txFail = lockingPositionDelegate.connect(user1).delegateMgCvg(1, user10, 150);
        await expect(txFail).to.be.revertedWith("INVALID_PERCENTAGE");
    });

    it("Tries to delegate mgCVG from non-owner of token", async () => {
        const txFail = lockingPositionDelegate.connect(user2).delegateMgCvg(1, user10, 150);
        await expect(txFail).to.be.revertedWith("TOKEN_NOT_OWNED");
    });

    it("Tries to remove non-delegated mgCVG user10", async () => {
        const txFail = lockingPositionDelegate.connect(user1).delegateMgCvg(1, user10, 0);
        await expect(txFail).to.be.revertedWith("CANNOT_REMOVE_NOT_DELEGATEE");
    });

    it("Delegates mgCVG with 70% power to user10 and 10% to user2", async () => {
        await expect(lockingPositionDelegate.connect(user1).delegateMgCvg(1, user10, 70))
            .to.emit(lockingPositionDelegate, "DelegateMetagovernance")
            .withArgs(1, await user10.getAddress(), 70);

        await lockingPositionDelegate.connect(user1).delegateMgCvg(1, user2, 10);

        const [delegateeUser10, delegateeUser2] = await lockingPositionDelegate.getDelegatedMgCvg(1);

        expect(delegateeUser10.delegatee).to.be.equal(await user10.getAddress());
        expect(delegateeUser10.percentage).to.be.equal(70);
        expect(delegateeUser2.delegatee).to.be.equal(await user2.getAddress());
        expect(delegateeUser2.percentage).to.be.equal(10);
    });

    it("Checks delegatee info user2 and user10 for tokenId 1", async () => {
        const delegateeInfo = await lockingPositionDelegate.getMgDelegateeInfoPerTokenAndAddress(1, user10);

        const expectedValues = [
            70n, // 70% toPercentage
            80n, // 80% totalPercentage
            0n, // 0 index for user10
        ];

        expect(delegateeInfo).to.deep.equal(expectedValues);

        const tokenIdIndex = await lockingPositionDelegate.getIndexForMgCvgDelegatee(user2, 1);
        expect(tokenIdIndex).to.be.equal(0);
    });

    it("Checks mgCVG delegatee tokenId index for non-delegatee user", async () => {
        const tokenIdIndex = await lockingPositionDelegate.getIndexForMgCvgDelegatee(user3, 1);
        expect(tokenIdIndex).to.be.equal(0);
    });

    it("Checks delegatee info for non-delegated user3 for tokendId 1", async () => {
        const delegateeInfo = await lockingPositionDelegate.getMgDelegateeInfoPerTokenAndAddress(1, user3);
        expect(delegateeInfo).to.deep.equal([0n, 80n, 999n]);
    });

    it("Tries to add user3 as delegatee with 50% power for tokenId 1", async () => {
        const txFail = lockingPositionDelegate.connect(user1).delegateMgCvg(1, user3, 50);
        await expect(txFail).to.be.revertedWith("TOO_MUCH_PERCENTAGE");
    });

    it("Tries to update delegatee user2 with too much percentage for tokenId 1", async () => {
        const txFail = lockingPositionDelegate.connect(user1).delegateMgCvg(1, user2, 35);
        await expect(txFail).to.be.revertedWith("TOO_MUCH_PERCENTAGE");
    });
    it("Manage tokenIds for user1", async () => {
        let tokenIds = {owneds: [1], mgDelegateds: [], veDelegateds: []};
        await lockingPositionDelegate.connect(user1).manageOwnedAndDelegated(tokenIds);
    });

    it("Checks mgCVG balance of owner of tokenId 1", async () => {
        const tokenBalance = await lockingPositionService.balanceOfMgCvg(1);

        const delegatedPercentage = 80n;
        const expectedVotingPower = tokenBalance - (tokenBalance * delegatedPercentage) / 100n;
        const votingPower = await lockingPositionService.mgCvgVotingPowerPerAddress(user1);

        // take solidity rounding down into account
        expect(votingPower).to.be.approximately(expectedVotingPower, 1);
    });
    it("Manage tokenIds for user10", async () => {
        let tokenIds = {owneds: [], mgDelegateds: [1], veDelegateds: []};
        await lockingPositionDelegate.connect(user10).manageOwnedAndDelegated(tokenIds);
    });

    it("Checks mgCVG balances of user10 (delegatee)", async () => {
        const tokenBalance = await lockingPositionService.balanceOfMgCvg(1);

        // USER 10
        const delegatedPercentage = 70n;
        const expectedVotingPower = (tokenBalance * delegatedPercentage) / 100n;
        const votingPower = await lockingPositionService.mgCvgVotingPowerPerAddress(user10);

        // take solidity rounding down into account
        expect(votingPower).to.be.approximately(expectedVotingPower, 1);
    });
    it("Manage tokenIds for user10", async () => {
        let tokenIds = {owneds: [2], mgDelegateds: [1], veDelegateds: []};
        await lockingPositionDelegate.connect(user2).manageOwnedAndDelegated(tokenIds);
    });

    it("Checks mgCVG balances of user2 (delegatee + owner)", async () => {
        await increaseCvgCycle(contractsUsers, 1);

        // delegatee of tokenId 1
        const token1Balance = await lockingPositionService.balanceOfMgCvg(1);

        const delegatedPercentage = 10n;
        const token1VotingPower = (token1Balance * delegatedPercentage) / 100n;

        // owner of tokenId2
        const token2Balance = await lockingPositionService.balanceOfMgCvg(2);
        const votingPower = await lockingPositionService.mgCvgVotingPowerPerAddress(user2);

        // take solidity rounding down into account
        expect(votingPower).to.be.approximately(token1VotingPower + token2Balance, 1);
    });

    it("Removes user10 as delegatee of tokenId 1 and checks data", async () => {
        await lockingPositionDelegate.connect(user1).delegateMgCvg(1, user10, 0);

        // USER2
        const user10Info = await lockingPositionDelegate.getMgDelegateeInfoPerTokenAndAddress(1, user10);
        let expectedValues = [
            0n, // 0% toPercentage
            10n, // 10% totalPercentage
            999n, // 999 index for user10
        ];

        expect(user10Info).to.deep.equal(expectedValues);

        // USER10
        const user2Info = await lockingPositionDelegate.getMgDelegateeInfoPerTokenAndAddress(1, user2);
        expectedValues = [
            10n, // 10% toPercentage
            10n, // 10% totalPercentage
            0n, // 0 index for user2
        ];

        expect(user2Info).to.deep.equal(expectedValues);
    });

    it("Updates delegatee user2 to 95% and checks data", async () => {
        await lockingPositionDelegate.connect(user1).delegateMgCvg(1, user2, 95);

        const [delegateeUser2] = await lockingPositionDelegate.getDelegatedMgCvg(1);
        expect(delegateeUser2.delegatee).to.be.equal(await user2.getAddress());
        expect(delegateeUser2.percentage).to.be.equal(95);
    });

    it("Reduces max mgCVG delegatees and fails to add another delegatee", async () => {
        await lockingPositionDelegate.connect(treasuryDao).setMaxMgDelegatees(1);

        const txFail = lockingPositionDelegate.connect(user1).delegateMgCvg(1, user3, 5);
        await expect(txFail).to.be.revertedWith("TOO_MUCH_DELEGATEES");
    });
});
