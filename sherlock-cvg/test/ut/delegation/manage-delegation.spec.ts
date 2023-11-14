import chai from "chai";
import chaiAsPromised from "chai-as-promised";
chai.use(chaiAsPromised).should();
const expect = chai.expect;
import {ethers} from "hardhat";
import {zeroAddress} from "@nomicfoundation/ethereumjs-util";

import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {deployYsDistributorFixture, increaseCvgCycle} from "../../fixtures/fixtures";
import {Signer} from "ethers";
import {LockingPositionDelegate, LockingPositionService, LockingPositionManager, Cvg} from "../../../typechain-types";
import {IContractsUser} from "../../../utils/contractInterface";
import {LOCKING_POSITIONS} from "../Locking/config/lockingTestConfig";

describe("LockingPositionManager / veCvg/mgCvg manage delegation", () => {
    let lockingPositionDelegate: LockingPositionDelegate,
        lockingPositionService: LockingPositionService,
        lockingPositionManager: LockingPositionManager,
        cvgContract: Cvg;
    let user1: Signer, user2: Signer, user3: Signer, user9: Signer, user10: Signer;

    let contractsUsers: IContractsUser;

    before(async () => {
        contractsUsers = await loadFixture(deployYsDistributorFixture);
        const contracts = contractsUsers.contracts;
        const users = contractsUsers.users;

        lockingPositionService = contracts.locking.lockingPositionService;
        lockingPositionManager = contracts.locking.lockingPositionManager;
        lockingPositionDelegate = contracts.locking.lockingPositionDelegate;
        cvgContract = contracts.tokens.cvg;
        user1 = users.user1;
        user2 = users.user2;
        user3 = users.user3;
        user9 = users.user9;
        user10 = users.user10;

        await (await cvgContract.transfer(user1, ethers.parseEther("100000"))).wait();

        await (await cvgContract.connect(user1).approve(lockingPositionService, LOCKING_POSITIONS[0].cvgAmount)).wait();

        // increase staking cycle to 5
        await increaseCvgCycle(contractsUsers, LOCKING_POSITIONS[0].lockCycle - 1);
        // MINT POSITION 1
        await (
            await lockingPositionService.connect(user1).mintPosition(LOCKING_POSITIONS[0].duration, LOCKING_POSITIONS[0].cvgAmount, 60, user1, false)
        ).wait(); // Lock 100 CVG for 43 cycles
    });
    it("Metagovernance of user1 should compute 0 if no tokenId is managed", async () => {
        const veUser1 = await lockingPositionService.veCvgVotingPowerPerAddress(user1);
        const mgUser1 = await lockingPositionService.mgCvgVotingPowerPerAddress(user1);
        veUser1.should.be.equal("0");
        mgUser1.should.be.equal("0");
    });
    it("Manage tokenId as owned for user2 should revert", async () => {
        let tokenIds = {owneds: [1], mgDelegateds: [], veDelegateds: []};
        await lockingPositionDelegate.connect(user2).manageOwnedAndDelegated(tokenIds).should.be.revertedWith("TOKEN_NOT_OWNED");
    });
    it("Manage tokenId as mg delegated for user2 should revert", async () => {
        let tokenIds = {owneds: [], mgDelegateds: [1], veDelegateds: []};
        await lockingPositionDelegate.connect(user2).manageOwnedAndDelegated(tokenIds).should.be.revertedWith("NFT_NOT_MG_DELEGATED");
    });
    it("Manage tokenId as ve delegated for user2 should revert", async () => {
        let tokenIds = {owneds: [], mgDelegateds: [], veDelegateds: [1]};
        await lockingPositionDelegate.connect(user2).manageOwnedAndDelegated(tokenIds).should.be.revertedWith("NFT_NOT_VE_DELEGATED");
    });
    it("Manage tokenId as owned for user1 should compute right infos", async () => {
        let tokenIds = {owneds: [1], mgDelegateds: [], veDelegateds: []};
        await lockingPositionDelegate.connect(user1).manageOwnedAndDelegated(tokenIds);
        const tokenIdsOwnedAndDelegateds = await lockingPositionDelegate.getTokenOwnedAndDelegated(user1);
        expect(tokenIdsOwnedAndDelegateds).to.deep.equal([[1], [], []]);
    });
    it("Metagovernance of user1 should compute right amount of mgCvg if tokenId owned is managed", async () => {
        const veUser1 = await lockingPositionService.veCvgVotingPowerPerAddress(user1);
        const mgUser1 = await lockingPositionService.mgCvgVotingPowerPerAddress(user1);
        veUser1.should.be.approximately("17784971090362718550", "1000000000000000000"); //100% of veCvg tokenId 1
        mgUser1.should.be.equal("17916666666666666666"); //100% of mgCvg tokenId 1
    });
    it("Delegate veCvg to user3", async () => {
        await lockingPositionDelegate.connect(user1).delegateVeCvg(1, user3);
    });
    it("Checks veCVG delegatee tokenId index for non-delegatee user", async () => {
        const tokenIdIndex = await lockingPositionDelegate.getIndexForVeDelegatee(user2, 1);
        expect(tokenIdIndex).to.be.equal(0);
    });
    it("Delegates mgCvg with 40% to user9 and 20% to user10", async () => {
        await lockingPositionDelegate.connect(user1).delegateMgCvg(1, user9, 40);
        await lockingPositionDelegate.connect(user1).delegateMgCvg(1, user10, 20);
    });
    it("Votingpower of user1 should compute zero", async () => {
        const veUser1 = await lockingPositionService.veCvgVotingPowerPerAddress(user1);
        veUser1.should.be.equal("0");
    });
    it("Metagovernance of user1 should compute right amount of mgCvg if tokenId owned is managed", async () => {
        const mgUser1 = await lockingPositionService.mgCvgVotingPowerPerAddress(user1);
        mgUser1.should.be.equal("7166666666666666666"); //40% of mgCvg tokenId 1
    });
    it("Votingpower of user3 should compute zero if no token is managed", async () => {
        const veUser3 = await lockingPositionService.veCvgVotingPowerPerAddress(user3);
        veUser3.should.be.equal("0");
    });
    it("Metagovernance of user9/user10 should compute 0 if no token is managed", async () => {
        const mgUser9 = await lockingPositionService.mgCvgVotingPowerPerAddress(user9);
        const mgUser10 = await lockingPositionService.mgCvgVotingPowerPerAddress(user10);
        mgUser9.should.be.equal("0");
        mgUser10.should.be.equal("0");
    });
    it("Manage tokenId for user3/user9/user10 should compute right infos", async () => {
        let tokenIdsUser3 = {owneds: [], mgDelegateds: [], veDelegateds: [1]};
        let tokenIds = {owneds: [], mgDelegateds: [1], veDelegateds: []};
        await lockingPositionDelegate.connect(user3).manageOwnedAndDelegated(tokenIdsUser3);
        await lockingPositionDelegate.connect(user9).manageOwnedAndDelegated(tokenIds);
        await lockingPositionDelegate.connect(user10).manageOwnedAndDelegated(tokenIds);
        const tokenIdsOwnedAndDelegatedsUser3 = await lockingPositionDelegate.getTokenOwnedAndDelegated(user3);
        const tokenIdsOwnedAndDelegatedsUser9 = await lockingPositionDelegate.getTokenOwnedAndDelegated(user9);
        const tokenIdsOwnedAndDelegatedsUser10 = await lockingPositionDelegate.getTokenOwnedAndDelegated(user10);
        expect(tokenIdsOwnedAndDelegatedsUser3).to.deep.equal([[], [], [1]]);
        expect(tokenIdsOwnedAndDelegatedsUser9).to.deep.equal([[], [1], []]);
        expect(tokenIdsOwnedAndDelegatedsUser10).to.deep.equal([[], [1], []]);
    });
    it("Votingpower of user3 should compute right amount of veCvg if tokenIds is managed", async () => {
        const veUser3 = await lockingPositionService.veCvgVotingPowerPerAddress(user3);
        veUser3.should.be.approximately("17784442671664197375", "1000000000000000000"); //100% of veCvg tokenId 1
    });
    it("Metagovernance of user9/user10 should compute right amount of mgCvg if tokenIds is managed", async () => {
        const mgUser9 = await lockingPositionService.mgCvgVotingPowerPerAddress(user9);
        const mgUser10 = await lockingPositionService.mgCvgVotingPowerPerAddress(user10);
        mgUser9.should.be.equal("7166666666666666666"); //40% of mgCvg tokenId 1
        mgUser10.should.be.equal("3583333333333333333"); //20% of mgCvg tokenId 1
    });
    it("Transfer tokenId to user2", async () => {
        await lockingPositionManager.connect(user1).transferFrom(user1, user2, 1);
        const ownerTokendId = await lockingPositionManager.ownerOf(1);
        ownerTokendId.should.be.equal(await user2.getAddress());
    });
    it("Metagovernance of user1 should compute 0", async () => {
        const mgUser1 = await lockingPositionService.mgCvgVotingPowerPerAddress(user1);
        mgUser1.should.be.equal("0");
    });
    it("Votingpower of user2 should compute 0 if no tokenId is managed", async () => {
        const veUser2 = await lockingPositionService.veCvgVotingPowerPerAddress(user2);
        veUser2.should.be.equal("0");
    });
    it("Metagovernance of user2 should compute 0 if no tokenId is managed", async () => {
        const mgUser2 = await lockingPositionService.mgCvgVotingPowerPerAddress(user2);
        mgUser2.should.be.equal("0");
    });
    it("Manage tokenId for user2 should compute right infos", async () => {
        let tokenIds = {owneds: [1], mgDelegateds: [], veDelegateds: []};
        await lockingPositionDelegate.connect(user2).manageOwnedAndDelegated(tokenIds);
        const tokenIdsOwnedAndDelegatedsUser2 = await lockingPositionDelegate.getTokenOwnedAndDelegated(user2);
        expect(tokenIdsOwnedAndDelegatedsUser2).to.deep.equal([[1], [], []]);
    });
    it("Votingpower of user2/user3 should should compute right amount of mgCvg if tokenId owned is managed", async () => {
        const veUser2 = await lockingPositionService.veCvgVotingPowerPerAddress(user2);
        const veUser3 = await lockingPositionService.veCvgVotingPowerPerAddress(user3);
        veUser2.should.be.equal("0");
        veUser3.should.be.approximately("17784270168527776914", "1000000000000000000"); //100% of veCvg tokenId 1
    });
    it("Metagovernance of user2/user9/user10 should compute right amount of mgCvg if tokenId owned is managed", async () => {
        const mgUser2 = await lockingPositionService.mgCvgVotingPowerPerAddress(user2);
        const mgUser9 = await lockingPositionService.mgCvgVotingPowerPerAddress(user9);
        const mgUser10 = await lockingPositionService.mgCvgVotingPowerPerAddress(user10);
        mgUser2.should.be.equal("7166666666666666666"); //40% of mgCvg tokenId 1
        mgUser9.should.be.equal("7166666666666666666"); //40% of mgCvg tokenId 1
        mgUser10.should.be.equal("3583333333333333333"); //20% of mgCvg tokenId 1
    });
    it("Clean all delegatees for tokenId 1 should revert if wrong owner", async () => {
        await lockingPositionDelegate.connect(user1).cleanDelegatees(1, false, true).should.be.revertedWith("TOKEN_NOT_OWNED");
    });
    it("Clean all delegatees for tokenId 1 with false values", async () => {
        await lockingPositionDelegate.connect(user2).cleanDelegatees(1, false, false);

        // as we are passing false values in parameters, it indicates it shouldn't clean delegatees of both veCVG and mgCVG
        // therefore, Zero Address shouldn't be the delegated address of veCVG and array of mgCVG delegatees mustn't be empty
        expect(await lockingPositionDelegate.delegatedVeCvg(1)).to.not.be.equal(zeroAddress());
        expect(await lockingPositionDelegate.getDelegatedMgCvg(1)).to.not.be.empty;
    });
    it("Clean all delegatees for tokenId 1", async () => {
        await lockingPositionDelegate.connect(user2).cleanDelegatees(1, true, true);
    });
    it("Votingpower of user2/user3 should should compute right amount of mgCvg if tokenId owned is managed", async () => {
        const veUser2 = await lockingPositionService.veCvgVotingPowerPerAddress(user2);
        const veUser3 = await lockingPositionService.veCvgVotingPowerPerAddress(user3);
        veUser2.should.be.approximately("17760385643354619804", "1000000000000000000"); //100% of veCvg tokenId 1
        veUser3.should.be.equal("0");
    });
    it("Metagovernance of user2/user9/user10 should compute right amount of mgCvg if tokenId owned is managed", async () => {
        const mgUser2 = await lockingPositionService.mgCvgVotingPowerPerAddress(user2);
        const mgUser9 = await lockingPositionService.mgCvgVotingPowerPerAddress(user9);
        const mgUser10 = await lockingPositionService.mgCvgVotingPowerPerAddress(user10);
        mgUser2.should.be.equal("17916666666666666666"); //100% of mgCvg tokenId 1
        mgUser9.should.be.equal("0");
        mgUser10.should.be.equal("0");
    });

    it("Fails delegating ysCVG shares with token not owned", async () => {
        const txFail = lockingPositionDelegate.connect(user1).delegateYsCvg(1, user10);
        await expect(txFail).to.be.revertedWith("TOKEN_NOT_OWNED");
    });

    it("Delegates user2 ysCVG shares to user10", async () => {
        await expect(lockingPositionDelegate.connect(user2).delegateYsCvg(1, user10))
            .to.emit(lockingPositionDelegate, "DelegateShare")
            .withArgs(1, await user10.getAddress());

        expect(await lockingPositionDelegate.delegatedYsCvg(1)).to.be.eq(await user10.getAddress());
    });

    it("Delegates veCVG to Zero Address (remove delegation)", async () => {
        await lockingPositionDelegate.connect(user2).delegateVeCvg(1, zeroAddress());
        expect(await lockingPositionDelegate.delegatedVeCvg(1)).to.be.equal(zeroAddress());
        expect(await lockingPositionDelegate.getVeCvgDelegatees(zeroAddress())).to.be.empty;
    });
});
