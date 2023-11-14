import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {ethers} from "hardhat";
import {Signer} from "ethers";
import {deploySdtStakingFixture} from "../../fixtures/fixtures";
import {IContractsUser} from "../../../utils/contractInterface";
import {CvgControlTower} from "../../../typechain-types";

describe("Coverage ControlTower ", () => {
    let contractsUsers: IContractsUser;
    let owner: Signer, user1: Signer, user2: Signer, veSdtMultisig: Signer, treasuryDao: Signer;
    let cvgControlTower: CvgControlTower;

    before(async () => {
        contractsUsers = await loadFixture(deploySdtStakingFixture);

        const users = contractsUsers.users;
        const contracts = contractsUsers.contracts;
        const stakeDao = contracts.stakeDao;
        const tokens = contracts.tokens;
        const tokensStakeDao = contracts.tokensStakeDao;

        owner = users.owner;
        user1 = users.user1;
        user2 = users.user2;
        treasuryDao = users.treasuryDao;
        veSdtMultisig = users.veSdtMultisig;
        cvgControlTower = contracts.base.cvgControlTower;
    });
    it("Fail: toggleStakingContract with random user", async () => {
        await cvgControlTower.toggleStakingContract(user1).should.be.revertedWith("Ownable: caller is not the owner");
    });
    it("Fail: insertNewBond with random user", async () => {
        await cvgControlTower.insertNewBond(user1, 0).should.be.revertedWith("CLONE_FACTORY");
    });
    it("Fail: insertNewSdtStaking with random user", async () => {
        await cvgControlTower.insertNewSdtStaking(user1).should.be.revertedWith("CLONE_FACTORY");
    });
    it("Fail: setOracle with random user", async () => {
        await cvgControlTower.setOracle(user1).should.be.revertedWith("Ownable: caller is not the owner");
    });
    it("Fail: setTreasuryBonds with random user", async () => {
        await cvgControlTower.setTreasuryBonds(user1).should.be.revertedWith("Ownable: caller is not the owner");
    });
    it("Fail: setTreasuryDao with random user", async () => {
        await cvgControlTower.setTreasuryDao(user1).should.be.revertedWith("Ownable: caller is not the owner");
    });
    it("Fail: setTreasuryAirdrop with random user", async () => {
        await cvgControlTower.setTreasuryAirdrop(user1).should.be.revertedWith("Ownable: caller is not the owner");
    });
    it("Fail: setTreasuryCore with random user", async () => {
        await cvgControlTower.setTreasuryCore(user1).should.be.revertedWith("Ownable: caller is not the owner");
    });
    it("Fail: setBondCalculator with random user", async () => {
        await cvgControlTower.setBondCalculator(user1).should.be.revertedWith("Ownable: caller is not the owner");
    });
    it("Fail: setCvgRewards with random user", async () => {
        await cvgControlTower.setCvgRewards(user1).should.be.revertedWith("Ownable: caller is not the owner");
    });
    it("Fail: setVeCVG with random user", async () => {
        await cvgControlTower.setVeCVG(user1).should.be.revertedWith("Ownable: caller is not the owner");
    });
    it("Fail: setGaugeController with random user", async () => {
        await cvgControlTower.setGaugeController(user1).should.be.revertedWith("Ownable: caller is not the owner");
    });
    it("Fail: setCloneFactory with random user", async () => {
        await cvgControlTower.setCloneFactory(user1).should.be.revertedWith("Ownable: caller is not the owner");
    });
    it("Fail: setNewVersionBaseBond with random user", async () => {
        await cvgControlTower.setNewVersionBaseBond(user1).should.be.revertedWith("Ownable: caller is not the owner");
    });
    it("Fail: setLockingPositionManager with random user", async () => {
        await cvgControlTower.setLockingPositionManager(user1).should.be.revertedWith("Ownable: caller is not the owner");
    });
    it("Fail: setLockingPositionService with random user", async () => {
        await cvgControlTower.setLockingPositionService(user1).should.be.revertedWith("Ownable: caller is not the owner");
    });
    it("Fail: setLockingPositionDelegate with random user", async () => {
        await cvgControlTower.setLockingPositionDelegate(user1).should.be.revertedWith("Ownable: caller is not the owner");
    });
    it("Fail: setYsDistributor with random user", async () => {
        await cvgControlTower.setYsDistributor(user1).should.be.revertedWith("Ownable: caller is not the owner");
    });
    it("Fail: setCvg with random user", async () => {
        await cvgControlTower.setCvg(user1).should.be.revertedWith("Ownable: caller is not the owner");
    });
    it("Fail: setBondPositionManager with random user", async () => {
        await cvgControlTower.setBondPositionManager(user1).should.be.revertedWith("Ownable: caller is not the owner");
    });
    it("Fail: setSdtStakingPositionManager with random user", async () => {
        await cvgControlTower.setSdtStakingPositionManager(user1).should.be.revertedWith("Ownable: caller is not the owner");
    });
    it("Fail: setSdtStakingViewer with random user", async () => {
        await cvgControlTower.setSdtStakingViewer(user1).should.be.revertedWith("Ownable: caller is not the owner");
    });
    it("Fail: setSdtStakingLogo with random user", async () => {
        await cvgControlTower.setSdtStakingLogo(user1).should.be.revertedWith("Ownable: caller is not the owner");
    });
    it("Fail: setBondLogo with random user", async () => {
        await cvgControlTower.setBondLogo(user1).should.be.revertedWith("Ownable: caller is not the owner");
    });
    it("Fail: setLockingLogo with random user", async () => {
        await cvgControlTower.setLockingLogo(user1).should.be.revertedWith("Ownable: caller is not the owner");
    });
    it("Fail: setSdt with random user", async () => {
        await cvgControlTower.setSdt(user1).should.be.revertedWith("Ownable: caller is not the owner");
    });
    it("Fail: setCvgSdt with random user", async () => {
        await cvgControlTower.setCvgSdt(user1).should.be.revertedWith("Ownable: caller is not the owner");
    });
    it("Fail: setCvgSdtStaking with random user", async () => {
        await cvgControlTower.setCvgSdtStaking(user1).should.be.revertedWith("Ownable: caller is not the owner");
    });
    it("Fail: setVeSdtMultisig with random user", async () => {
        await cvgControlTower.setVeSdtMultisig(user1).should.be.revertedWith("Ownable: caller is not the owner");
    });
    it("Fail: setCvgSdtBuffer with random user", async () => {
        await cvgControlTower.setCvgSdtBuffer(user1).should.be.revertedWith("Ownable: caller is not the owner");
    });
    it("Fail: setPoolCvgSdt with random user", async () => {
        await cvgControlTower.setPoolCvgSdt(user1).should.be.revertedWith("Ownable: caller is not the owner");
    });
    it("Fail: setSdtBlackHole with random user", async () => {
        await cvgControlTower.setSdtBlackHole(user1).should.be.revertedWith("Ownable: caller is not the owner");
    });
    it("Fail: setSdtFeeCollector with random user", async () => {
        await cvgControlTower.setSdtFeeCollector(user1).should.be.revertedWith("Ownable: caller is not the owner");
    });
    it("Fail: setCvgUtilities with random user", async () => {
        await cvgControlTower.setCvgUtilities(user1).should.be.revertedWith("Ownable: caller is not the owner");
    });
    it("Fail: setSwapperFactory with random user", async () => {
        await cvgControlTower.setSwapperFactory(user1).should.be.revertedWith("Ownable: caller is not the owner");
    });
    it("Fail: setVestingCvg with random user", async () => {
        await cvgControlTower.setVestingCvg(user1).should.be.revertedWith("Ownable: caller is not the owner");
    });
    it("Fail: setSdtUtilities with random user", async () => {
        await cvgControlTower.setSdtUtilities(user1).should.be.revertedWith("Ownable: caller is not the owner");
    });
    it("Fail: setIbo with random user", async () => {
        await cvgControlTower.setIbo(user1).should.be.revertedWith("Ownable: caller is not the owner");
    });
    it("Success: setIbo ", async () => {
        await cvgControlTower.connect(treasuryDao).setIbo(user1);
    });
});
