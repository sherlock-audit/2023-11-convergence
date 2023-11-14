import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {deployPresaleVestingFixture} from "../../fixtures/fixtures";
import {Signer} from "ethers";
import {ERC20} from "../../../typechain-types/@openzeppelin/contracts/token/ERC20";
import {SeedPresaleCvg, WlPresaleCvg, VestingCvg, Ibo} from "../../../typechain-types/contracts/PresaleVesting";
import {Cvg} from "../../../typechain-types/contracts/Token";
import {bedTestIboMinting, bedTestVestingDistributeInitTokens} from "../../Beds/bedTest-vesting";
import {ethers, network} from "hardhat";
import {TREASURY_RUNWAY} from "../../../resources/cvg-mainnet";
chai.use(chaiAsPromised).should();
const expect = chai.expect;

describe("Vesting Team/Dao Cvg / Release tests", () => {
    let presaleContractSeed: SeedPresaleCvg, presaleContractWl: WlPresaleCvg, vestingContract: VestingCvg, iboContract: Ibo;
    let owner: Signer, user1: Signer, user3: Signer, user5: Signer, user7: Signer, user8: Signer, user10: Signer, user4: Signer, treasuryDao: Signer;
    let dai: ERC20, frax: ERC20, cvg: Cvg;
    let TEAM: Signer, DAO: Signer;

    before(async () => {
        const {contracts, users} = await loadFixture(deployPresaleVestingFixture);

        const tokens = contracts.tokens;
        const presaleContracts = contracts.presaleVesting;
        cvg = tokens.cvg;
        presaleContractSeed = presaleContracts.seedPresale;
        presaleContractWl = presaleContracts.wlPresaleCvg;
        vestingContract = presaleContracts.vestingCvg;
        iboContract = presaleContracts.ibo;
        owner = users.owner;
        user1 = users.user1;
        user3 = users.user3;
        user4 = users.user4;

        user5 = users.user5;
        user7 = users.user7;
        user8 = users.user8;
        user4 = users.user4;
        user10 = users.user10;
        user1 = users.user1;
        treasuryDao = users.treasuryDao;

        TEAM = user7;
        DAO = user8;
        await bedTestIboMinting({contracts, users});

        await bedTestVestingDistributeInitTokens({contracts, users});
    });

    it("Success close the sale state of both WL & Presale", async () => {
        await vestingContract.setWhitelistTeam(user1).should.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Success close the sale state of both WL & Presale", async () => {
        await vestingContract.setWhitelistDao(user1).should.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Success close the sale state of both WL & Presale", async () => {
        await network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [TREASURY_RUNWAY],
        });

        await owner.sendTransaction({
            to: TREASURY_RUNWAY,
            value: ethers.parseEther("1.0"), // Sends exactly 1.0 ether
        });
        await presaleContractSeed.connect(await ethers.getSigner(TREASURY_RUNWAY)).setSaleState(3);
        await network.provider.request({
            method: "hardhat_stopImpersonatingAccount",
            params: [TREASURY_RUNWAY],
        });
        await presaleContractWl.connect(treasuryDao).setSaleState(2);
        expect(await presaleContractSeed.saleState()).to.be.equal(3);
        expect(await presaleContractWl.saleState()).to.be.equal(2);
    });
    it("Success: set/open vesting", async () => {
        await vestingContract.connect(treasuryDao).setVesting(cvg);
        await vestingContract.connect(treasuryDao).openVesting();
    });

    it("Set Team and Dao address for vesting", async () => {
        await vestingContract.connect(treasuryDao).setWhitelistTeam(TEAM);
        await vestingContract.connect(treasuryDao).setWhitelistDao(DAO);
        expect(await vestingContract.whitelistedTeam()).to.be.equal(await TEAM.getAddress());
        expect(await vestingContract.whitelistedDao()).to.be.equal(await DAO.getAddress());
    });

    it("releaseTeam with DAO should revert", async () => {
        await expect(vestingContract.connect(DAO).releaseTeamOrDao(true)).to.be.revertedWith("NOT_TEAM");
    });
    it("releaseDao with TEAM should revert", async () => {
        await expect(vestingContract.connect(TEAM).releaseTeamOrDao(false)).to.be.revertedWith("NOT_DAO");
    });

    ///////////////////////////////RELEASE TOKEN///////////////////////////////
    it("release for TEAM should be reverted", async () => {
        await vestingContract.connect(TEAM).releaseTeamOrDao(true).should.be.revertedWith("NOT_RELEASABLE");
    });

    it("try to release with DAO and param isTeam == true should revert", async () => {
        await vestingContract.connect(TEAM).releaseTeamOrDao(false).should.be.revertedWith("NOT_DAO");
    });

    it("release daysBeforeCliff for DAO should compute right infos", async () => {
        await vestingContract.connect(DAO).releaseTeamOrDao(false);
        expect(await cvg.balanceOf(DAO)).to.be.approximately("750000000000000000000000", ethers.parseEther("3"));
    });

    it("Go to day 10", async () => {
        //IncreaseTime + Mine the last block to be effective
        await network.provider.send("evm_increaseTime", [10 * 86_400]);
        await network.provider.send("hardhat_mine", []);

        await vestingContract.connect(TEAM).releaseTeamOrDao(true).should.be.revertedWith("NOT_RELEASABLE");

        await vestingContract.connect(DAO).releaseTeamOrDao(false);
        expect(await cvg.balanceOf(DAO)).to.be.approximately("1013891646000000000000000", ethers.parseEther("2"));
    });
    it("Go to day 20", async () => {
        //IncreaseTime + Mine the last block to be effective
        await network.provider.send("evm_increaseTime", [10 * 86_400]);
        await network.provider.send("hardhat_mine", []);

        await vestingContract.connect(TEAM).releaseTeamOrDao(true).should.be.revertedWith("NOT_RELEASABLE");

        await vestingContract.connect(DAO).releaseTeamOrDao(false);
        expect(await cvg.balanceOf(DAO)).to.be.approximately("1277781453750000000000000", ethers.parseEther("2"));
    });

    it("Go to day 30", async () => {
        //IncreaseTime + Mine the last block to be effective
        await network.provider.send("evm_increaseTime", [10 * 86_400]);
        await network.provider.send("hardhat_mine", []);

        await vestingContract.connect(TEAM).releaseTeamOrDao(true).should.be.revertedWith("NOT_RELEASABLE");

        await vestingContract.connect(DAO).releaseTeamOrDao(false);
        expect(await cvg.balanceOf(DAO)).to.be.approximately("1541670948000000000000000", ethers.parseEther("1"));
    });

    it("Go to day 90", async () => {
        //IncreaseTime + Mine the last block to be effective
        await network.provider.send("evm_increaseTime", [60 * 86_400]);
        await network.provider.send("hardhat_mine", []);

        await vestingContract.connect(TEAM).releaseTeamOrDao(true).should.be.revertedWith("NOT_RELEASABLE");

        await vestingContract.connect(DAO).releaseTeamOrDao(false);
        expect(await cvg.balanceOf(DAO)).to.be.approximately("3125004593250000000000000", ethers.parseEther("1"));
    });

    it("Go to day 179", async () => {
        //IncreaseTime + Mine the last block to be effective
        await network.provider.send("evm_increaseTime", [89 * 86_400]);
        await network.provider.send("hardhat_mine", []);

        await vestingContract.connect(TEAM).releaseTeamOrDao(true).should.be.revertedWith("NOT_RELEASABLE");

        await vestingContract.connect(DAO).releaseTeamOrDao(false);
        expect(await cvg.balanceOf(DAO)).to.be.approximately("5473616305500000000000000", ethers.parseEther("1"));
    });

    it("Go to day 180, unlock cliff TEAM", async () => {
        //IncreaseTime + Mine the last block to be effective
        await network.provider.send("evm_increaseTime", [1 * 86_400]);
        await network.provider.send("hardhat_mine", []);

        await vestingContract.connect(TEAM).releaseTeamOrDao(true);
        expect(await cvg.balanceOf(TEAM)).to.be.approximately("637500000000000000000000", ethers.parseEther("10"));

        await vestingContract.connect(DAO).releaseTeamOrDao(false);
        expect(await cvg.balanceOf(DAO)).to.be.approximately("5500005809250000000000000", ethers.parseEther("1"));
    });

    it("Go to day 300 => 6 months after DAO cliff & 4 months after cliff TEAM", async () => {
        //IncreaseTime + Mine the last block to be effective
        await network.provider.send("evm_increaseTime", [4 * 30 * 86_400]);
        await network.provider.send("hardhat_mine", []);

        await vestingContract.connect(TEAM).releaseTeamOrDao(true);
        expect(await cvg.balanceOf(TEAM)).to.be.approximately("3329172126712500000000000", ethers.parseEther("5"));

        await vestingContract.connect(DAO).releaseTeamOrDao(false);
        expect(await cvg.balanceOf(DAO)).to.be.approximately("8666673085500000000000000", ethers.parseEther("1"));
    });

    it("Go to day 480 => 12 months after DAO cliff & 10 months after cliff TEAM", async () => {
        //IncreaseTime + Mine the last block to be effective
        await network.provider.send("evm_increaseTime", [6 * 30 * 86_400]);
        await network.provider.send("hardhat_mine", []);

        await vestingContract.connect(TEAM).releaseTeamOrDao(true);
        expect(await cvg.balanceOf(TEAM)).to.be.approximately("7366672643512500000000000", ethers.parseEther("5"));

        await vestingContract.connect(DAO).releaseTeamOrDao(false);
        expect(await cvg.balanceOf(DAO)).to.be.approximately("13416673693500000000000000", ethers.parseEther("1"));
    });

    it("Go to day 540 => 14 months after DAO cliff & 12 months after cliff TEAM", async () => {
        //IncreaseTime + Mine the last block to be effective
        await network.provider.send("evm_increaseTime", [2 * 30 * 86_400]);
        await network.provider.send("hardhat_mine", []);

        await vestingContract.connect(TEAM).releaseTeamOrDao(true);
        expect(await cvg.balanceOf(TEAM)).to.be.approximately("8712506241975000000000000", ethers.parseEther("5"));

        await vestingContract.connect(DAO).releaseTeamOrDao(false);
        expect(await cvg.balanceOf(DAO)).to.be.approximately("15000000000000000000000000", ethers.parseEther("1"));
    });

    it("Go to day 569 => 15 months after DAO cliff & 13 months after cliff TEAM", async () => {
        //IncreaseTime + Mine the last block to be effective
        await network.provider.send("evm_increaseTime", [29 * 86_400]);
        await network.provider.send("hardhat_mine", []);

        await vestingContract.connect(TEAM).releaseTeamOrDao(true);
        expect(await cvg.balanceOf(TEAM)).to.be.approximately("9362993131875000000000000", ethers.parseEther("50"));

        await vestingContract.connect(DAO).releaseTeamOrDao(false).should.be.revertedWith("NOT_RELEASABLE");
    });

    it("Go to day 570 => end of the vesting DAO & 13 months after cliff TEAM", async () => {
        //IncreaseTime + Mine the last block to be effective
        await network.provider.send("evm_increaseTime", [1 * 86_400]);
        await network.provider.send("hardhat_mine", []);

        await vestingContract.connect(TEAM).releaseTeamOrDao(true);
        expect(await cvg.balanceOf(TEAM)).to.be.approximately("9385424197950000000000000", ethers.parseEther("5"));

        await vestingContract.connect(DAO).releaseTeamOrDao(false).should.be.revertedWith("NOT_RELEASABLE");
    });

    it("Go to day 660 => end of the vesting DAO & 16 months after cliff TEAM", async () => {
        //IncreaseTime + Mine the last block to be effective
        await network.provider.send("evm_increaseTime", [3 * 30 * 86_400]);
        await network.provider.send("hardhat_mine", []);

        await vestingContract.connect(TEAM).releaseTeamOrDao(true);
        expect(await cvg.balanceOf(TEAM)).to.be.approximately("11404174456350000000000000", ethers.parseEther("5"));

        await vestingContract.connect(DAO).releaseTeamOrDao(false).should.be.revertedWith("NOT_RELEASABLE");
    });

    it("Go to day 719 => end of the vesting DAO & 18 months after cliff TEAM, 1 day before the end of the vesting", async () => {
        //IncreaseTime + Mine the last block to be effective
        await network.provider.send("evm_increaseTime", [59 * 86_400]);
        await network.provider.send("hardhat_mine", []);

        await vestingContract.connect(TEAM).releaseTeamOrDao(true);
        expect(await cvg.balanceOf(TEAM)).to.be.approximately("12727578018300000000000000", ethers.parseEther("5")); //+1187499999999999999744000

        await vestingContract.connect(DAO).releaseTeamOrDao(false).should.be.revertedWith("NOT_RELEASABLE");
    });

    it("Go to day 720 => end of both vesting", async () => {
        //IncreaseTime + Mine the last block to be effective
        await network.provider.send("evm_increaseTime", [30 * 86_400]);
        await network.provider.send("hardhat_mine", []);

        await vestingContract.connect(TEAM).releaseTeamOrDao(true);
        expect(await cvg.balanceOf(DAO)).to.be.eq("15000000000000000000000000");
        expect(await cvg.balanceOf(TEAM)).to.be.eq("12750000000000000000000000");
    });
});
