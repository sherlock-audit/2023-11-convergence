import chai from "chai";
import {setStorageAt} from "@nomicfoundation/hardhat-network-helpers";
import chaiAsPromised from "chai-as-promised";
chai.use(chaiAsPromised).should();
const expect = chai.expect;

import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {deployYsDistributorFixture, increaseCvgCycle} from "../../fixtures/fixtures";
import {ethers} from "hardhat";
import {Signer} from "ethers";
import {GlobalHelper} from "../../../utils/GlobalHelper";
import {CvgAirdrop} from "../../../typechain-types/contracts/Airdrop";
import {LockingPositionManager, LockingPositionService} from "../../../typechain-types/contracts/Locking";
import {Cvg} from "../../../typechain-types/contracts/Token";
import {SwapperFactory} from "../../../typechain-types/contracts/utils";
import {IContracts, IUsers} from "../../../utils/contractInterface";

const CLAIM = ethers.parseEther("1250");

describe("Airdrop Tests", () => {
    let treasuryDao: Signer, treasuryAirdrop: Signer;
    let owner: Signer, user1: Signer, user2: Signer, user3: Signer, user4: Signer;
    let lockingPositionServiceContract: LockingPositionService,
        lockingPositionManagerContract: LockingPositionManager,
        cvgContract: Cvg,
        swapperFactory: SwapperFactory,
        cvgAirdropContract: CvgAirdrop;
    let contractsUsers, contracts: IContracts, users: IUsers, merkleRoot: string;
    let whitelisted: string[];

    before(async () => {
        contractsUsers = await loadFixture(deployYsDistributorFixture);
        contracts = contractsUsers.contracts;
        users = contractsUsers.users;
        lockingPositionServiceContract = contracts.locking.lockingPositionService;
        lockingPositionManagerContract = contracts.locking.lockingPositionManager;
        swapperFactory = contracts.base.swapperFactory;
        cvgAirdropContract = contracts.presaleVesting.cvgAirdrop;

        cvgContract = contracts.tokens.cvg;

        owner = users.owner;
        user1 = users.user1;
        user2 = users.user2;
        user3 = users.user3;
        user4 = users.user4;

        treasuryDao = users.treasuryDao;
        treasuryAirdrop = users.treasuryAirdrop;

        whitelisted = [await user1.getAddress(), await user2.getAddress(), await user3.getAddress(), await user4.getAddress()];

        merkleRoot = GlobalHelper.getRoot(whitelisted);
    });
    it("Fail: startAirdrop with random user", async () => {
        await cvgAirdropContract.startAirdrop().should.be.revertedWith("Ownable: caller is not the owner");
    });
    it("Fail: set merkleRoot with random user", async () => {
        await cvgAirdropContract.setMerkleRoot(merkleRoot).should.be.revertedWith("Ownable: caller is not the owner");
    });
    it("Success: set merkleRoot", async () => {
        await cvgAirdropContract.connect(treasuryAirdrop).setMerkleRoot(merkleRoot);
    });

    it("Fail: Claim before active state", async () => {
        const proof = GlobalHelper.getProofMerkle(whitelisted, await user1.getAddress());
        await expect(cvgAirdropContract.connect(user1).claim(proof)).to.be.revertedWith("CLAIM_NOT_ACTIVE");
    });

    it("Fail: start airdrop with insufficient allowance", async () => {
        await cvgContract.connect(treasuryAirdrop).approve(cvgAirdropContract, ethers.parseEther("10"));
        await expect(cvgAirdropContract.connect(treasuryAirdrop).startAirdrop()).to.be.revertedWith("ALLOWANCE_INSUFFICIENT");
    });

    it("Success: start airdrop", async () => {
        await cvgContract.connect(treasuryAirdrop).approve(cvgAirdropContract, ethers.parseEther("312500"));
        await cvgAirdropContract.connect(treasuryAirdrop).startAirdrop();
    });

    it("Fail: Claim with wrong user", async () => {
        const proof = GlobalHelper.getProofMerkle(whitelisted, await user1.getAddress());
        await expect(cvgAirdropContract.connect(owner).claim(proof)).to.be.revertedWith("INVALID_PROOF");
    });

    it("Toggles contract locker", async () => {
        await lockingPositionServiceContract.connect(treasuryDao).toggleContractLocker(cvgAirdropContract);
        expect(await lockingPositionServiceContract.isContractLocker(cvgAirdropContract)).to.be.true;
    });

    it("Success: Claim airdrop at cycle 1 with user whitelisted", async () => {
        const proof = GlobalHelper.getProofMerkle(whitelisted, await user1.getAddress());
        await expect(cvgAirdropContract.connect(user1).claim(proof)).to.changeTokenBalances(cvgContract, [treasuryAirdrop], [-CLAIM]);
        expect(await lockingPositionManagerContract.balanceOf(user1)).to.be.equal("1");
        expect(await cvgAirdropContract.cvgClaimable()).to.be.equal(ethers.parseEther("311250"));
    });
    it("Fail: Claim with user that already claimed", async () => {
        const proof = GlobalHelper.getProofMerkle(whitelisted, await user1.getAddress());
        await expect(cvgAirdropContract.connect(user1).claim(proof)).to.be.revertedWith("ALREADY_CLAIMED");
    });

    it("Increase to cycle 2", async () => {
        increaseCvgCycle({contracts, users}, 1);
    });
    it("Success: Claim airdrop at cycle 2 with user whitelisted", async () => {
        const proof = GlobalHelper.getProofMerkle(whitelisted, await user2.getAddress());
        await expect(cvgAirdropContract.connect(user2).claim(proof)).to.changeTokenBalances(cvgContract, [treasuryAirdrop], [-CLAIM]);
        expect(await lockingPositionManagerContract.balanceOf(user2)).to.be.equal("1");
        expect(await cvgAirdropContract.cvgClaimable()).to.be.equal(ethers.parseEther("310000"));
    });
    it("Update cvgClaimable", async () => {
        await setStorageAt(await cvgAirdropContract.getAddress(), 2, ethers.parseEther("1250"));
        expect(await cvgAirdropContract.cvgClaimable()).to.be.equal(ethers.parseEther("1250"));
    });
    it("Increase to cycle 12", async () => {
        increaseCvgCycle({contracts, users}, 10);
    });
    it("Success: Claim airdrop at cycle 12 with user whitelisted", async () => {
        const proof = GlobalHelper.getProofMerkle(whitelisted, await user3.getAddress());
        await expect(cvgAirdropContract.connect(user3).claim(proof)).to.changeTokenBalances(cvgContract, [treasuryAirdrop], [-CLAIM]);
        expect(await lockingPositionManagerContract.balanceOf(user3)).to.be.equal("1");
        expect(await cvgAirdropContract.cvgClaimable()).to.be.equal("0");
    });
    it("Fail: Claim airdrop at cycle 12 with user whitelisted without sufficient cvg to claim", async () => {
        const proof = GlobalHelper.getProofMerkle(whitelisted, await user4.getAddress());
        await expect(cvgAirdropContract.connect(user4).claim(proof)).to.be.revertedWith("CLAIM_OVER");
    });
});
