import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {expect} from "chai";
import {ethers, network} from "hardhat";
import {Signer, ZeroAddress} from "ethers";
import {deployPresaleVestingFixture} from "../../fixtures/fixtures";
import {REAL_VESTING_SCHEDULES} from "../../../resources/vesting";
import {bedTestIboMinting, bedTestVestingDistributeInitTokens, bedTestVestingMintWlTokens} from "../../Beds/bedTest-vesting";
import {Ibo, SeedPresaleCvg, VestingCvg, WlPresaleCvg} from "../../../typechain-types/contracts/PresaleVesting";
import {Cvg} from "../../../typechain-types/contracts/Token";
import {time} from "@nomicfoundation/hardhat-network-helpers";
import {TREASURY_RUNWAY} from "../../../resources/cvg-mainnet";
import {TOKEN_1, TOKEN_2, TOKEN_3} from "../../../resources/constant";
import {IERC20} from "../../../typechain-types";

describe("Vesting Cvg / Release tests", () => {
    let cvg: Cvg, dai: IERC20, presaleContractSeed: SeedPresaleCvg, presaleContractWl: WlPresaleCvg, vestingContract: VestingCvg, iboContract: Ibo;
    let owner: Signer, user1: Signer, user7: Signer, user4: Signer, user10: Signer;
    let treasuryDao: Signer;

    before(async () => {
        const {contracts, users} = await loadFixture(deployPresaleVestingFixture);

        await bedTestVestingDistributeInitTokens({contracts, users});
        const tokens = contracts.tokens;
        const presaleContracts = contracts.presaleVesting;
        cvg = tokens.cvg;
        dai = tokens.dai;
        presaleContractSeed = presaleContracts.seedPresale;
        presaleContractWl = presaleContracts.wlPresaleCvg;
        vestingContract = presaleContracts.vestingCvg;
        iboContract = presaleContracts.ibo;
        owner = users.owner;
        user1 = users.user1;
        user4 = users.user4;

        user7 = users.user7;
        user4 = users.user4;
        user10 = users.user10;
        user1 = users.user1;
        treasuryDao = users.treasuryDao;

        await presaleContractWl.connect(treasuryDao).setSaleState(1);
        await bedTestVestingMintWlTokens({contracts, users});
        await bedTestIboMinting({contracts, users});
    });
    it("withdraw funds presale wl", async () => {
        await presaleContractWl.connect(treasuryDao).withdrawFunds();
    });
    it("withdraw funds presale wl with zero balance should revert", async () => {
        await expect(presaleContractWl.connect(treasuryDao).withdrawFunds()).to.be.revertedWith("NO_FUNDS");
    });
    it("Fail: setVesting if both WL & Presale not finished", async () => {
        await vestingContract.connect(treasuryDao).setVesting(cvg).should.be.revertedWith("PRESALE_ROUND_NOT_FINISHED");
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
    });

    it("Fail: setVesting if not the contract Owner", async () => {
        await vestingContract.setVesting(cvg).should.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Fail: setVesting with zero address for CVG", async () => {
        await vestingContract.connect(treasuryDao).setVesting(ZeroAddress).should.be.revertedWith("CVG_ZERO");
    });
    it("Fail: setVesting with token balance not sufficient", async () => {
        await vestingContract.connect(treasuryDao).setVesting(dai).should.be.revertedWith("NOT_ENOUGH_CVG");
    });

    it("Success : setVesting should compute right infoss", async () => {
        await vestingContract.connect(treasuryDao).setVesting(cvg);

        const vestingSeed = await vestingContract.vestingSchedules(REAL_VESTING_SCHEDULES.PRESEED_SEED.type);
        expect(vestingSeed.totalAmount).to.be.equal(await presaleContractSeed.getTotalCvg());
        expect(vestingSeed.totalReleased).to.be.equal(0);
        expect(vestingSeed.daysBeforeCliff).to.be.equal(REAL_VESTING_SCHEDULES.PRESEED_SEED.daysBeforeCliff);
        expect(vestingSeed.daysAfterCliff).to.be.equal(REAL_VESTING_SCHEDULES.PRESEED_SEED.daysAfterCliff);
        expect(vestingSeed.dropCliff).to.be.equal(REAL_VESTING_SCHEDULES.PRESEED_SEED.dropCliff);

        const vestingWl = await vestingContract.vestingSchedules(REAL_VESTING_SCHEDULES.WL.type);
        expect(vestingWl.totalAmount).to.be.equal(await presaleContractWl.getTotalCvg());
        expect(vestingWl.totalReleased).to.be.equal(0);
        expect(vestingWl.daysBeforeCliff).to.be.equal(REAL_VESTING_SCHEDULES.WL.daysBeforeCliff);
        expect(vestingWl.daysAfterCliff).to.be.equal(REAL_VESTING_SCHEDULES.WL.daysAfterCliff);
        expect(vestingWl.dropCliff).to.be.equal(REAL_VESTING_SCHEDULES.WL.dropCliff);

        const vestingIbo = await vestingContract.vestingSchedules(REAL_VESTING_SCHEDULES.IBO.type);
        expect(vestingIbo.totalAmount).to.be.equal(await iboContract.getTotalCvgDue());
        expect(vestingIbo.totalReleased).to.be.equal(0);
        expect(vestingIbo.daysBeforeCliff).to.be.equal(REAL_VESTING_SCHEDULES.IBO.daysBeforeCliff);
        expect(vestingIbo.daysAfterCliff).to.be.equal(REAL_VESTING_SCHEDULES.IBO.daysAfterCliff);
        expect(vestingIbo.dropCliff).to.be.equal(REAL_VESTING_SCHEDULES.IBO.dropCliff);

        const vestingTeam = await vestingContract.vestingSchedules(REAL_VESTING_SCHEDULES.TEAM.type);
        expect(vestingTeam.totalAmount).to.be.equal(await vestingContract.MAX_SUPPLY_TEAM());
        expect(vestingTeam.totalReleased).to.be.equal(0);
        expect(vestingTeam.daysBeforeCliff).to.be.equal(REAL_VESTING_SCHEDULES.TEAM.daysBeforeCliff);
        expect(vestingTeam.daysAfterCliff).to.be.equal(REAL_VESTING_SCHEDULES.TEAM.daysAfterCliff);
        expect(vestingTeam.dropCliff).to.be.equal(REAL_VESTING_SCHEDULES.TEAM.dropCliff);

        const vestingDao = await vestingContract.vestingSchedules(REAL_VESTING_SCHEDULES.DAO.type);
        expect(vestingDao.totalAmount).to.be.equal(await vestingContract.MAX_SUPPLY_DAO());
        expect(vestingDao.totalReleased).to.be.equal(0);
        expect(vestingDao.daysBeforeCliff).to.be.equal(REAL_VESTING_SCHEDULES.DAO.daysBeforeCliff);
        expect(vestingDao.daysAfterCliff).to.be.equal(REAL_VESTING_SCHEDULES.DAO.daysAfterCliff);
        expect(vestingDao.dropCliff).to.be.equal(REAL_VESTING_SCHEDULES.DAO.dropCliff);

        expect(await vestingContract.state()).to.be.equal(1);
    });

    it("Fail: setVesting already started", async () => {
        await vestingContract.connect(treasuryDao).setVesting(cvg).should.be.revertedWith("VESTING_ALREADY_SET");
    });

    it("Verify : Computation of total Cvg ", async () => {
        const totalCvg = await presaleContractWl.getTotalCvg();
        expect(totalCvg).to.be.eq("15454545454545454545453");
    });

    it("Fail : Claiming WL CVG if vesting not openned yet", async () => {
        await vestingContract.connect(user7).releaseWl(TOKEN_1).should.be.revertedWith("VESTING_NOT_OPEN");
    });
    it("Fail : Claiming SEED CVG if vesting not openned yet", async () => {
        const fistTokenOwner = await presaleContractSeed.ownerOf(TOKEN_1);
        await network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [fistTokenOwner],
        });
        await expect(vestingContract.connect(await ethers.getSigner(fistTokenOwner)).releaseSeed(TOKEN_1)).to.be.revertedWith("VESTING_NOT_OPEN");

        await network.provider.request({
            method: "hardhat_stopImpersonatingAccount",
            params: [fistTokenOwner],
        });
    });
    it("Fail : Claiming IBO CVG if vesting not openned yet", async () => {
        await vestingContract.connect(user10).releaseIbo(TOKEN_1).should.be.revertedWith("VESTING_NOT_OPEN");
    });

    it("Fail: openVesting with random user", async () => {
        await vestingContract.openVesting().should.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Success: openVesting for all", async () => {
        await vestingContract.connect(treasuryDao).openVesting();
        expect(await vestingContract.state()).to.be.equal(2);
    });
    it("Fail: openVesting already openned", async () => {
        await vestingContract.connect(treasuryDao).openVesting().should.be.revertedWith("VESTING_ALREADY_OPENED");
    });

    ///////////////////////////////RELEASE TOKEN///////////////////////////////
    it("Seed first token try release before releaseTime should be reverted", async () => {
        const fistTokenOwner = await presaleContractSeed.ownerOf(TOKEN_1);
        await network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [fistTokenOwner],
        });
        await expect(vestingContract.connect(await ethers.getSigner(fistTokenOwner)).releaseSeed(TOKEN_1)).to.be.revertedWith("NOT_RELEASABLE");

        await network.provider.request({
            method: "hardhat_stopImpersonatingAccount",
            params: [fistTokenOwner],
        });
    });

    it("Seed second token try release before releaseTime should be reverted", async () => {
        const secondTokenOwner = await presaleContractSeed.ownerOf(2);
        await network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [secondTokenOwner],
        });
        await expect(vestingContract.connect(await ethers.getSigner(secondTokenOwner)).releaseSeed(TOKEN_2)).to.be.revertedWith("NOT_RELEASABLE");

        await network.provider.request({
            method: "hardhat_stopImpersonatingAccount",
            params: [secondTokenOwner],
        });
    });
    it("Try to releaseWl a token not owned", async () => {
        await expect(vestingContract.connect(user4).releaseWl(TOKEN_1)).to.be.revertedWith("NOT_OWNED");
    });

    it("Try to releaseSeed a token not owned", async () => {
        await expect(vestingContract.connect(user4).releaseSeed(TOKEN_1)).to.be.revertedWith("NOT_OWNED");
    });

    it("WL_S (7)  release after begin of schedule should change balances", async () => {
        expect(await cvg.balanceOf(user7)).to.be.equal("0");
        await vestingContract.connect(user7).releaseWl(TOKEN_1);

        const vesting0 = (await presaleContractWl.connect(user7).presaleInfos(TOKEN_1)).cvgAmount; // 909.09 total for 7
        const percentCliff = (await vestingContract.connect(user7).vestingSchedules(REAL_VESTING_SCHEDULES.WL.type)).dropCliff;
        const amountDropCliff = (vesting0 * percentCliff) / 1000n;

        expect(await cvg.balanceOf(user7)).to.be.approximately(amountDropCliff, ethers.parseEther("0.001")); //Release drop daysBeforeCliff
    });

    it("WL_M (4) try to release after begin of schedule should change balances", async () => {
        expect(await cvg.balanceOf(user4)).to.be.equal("0");
        await vestingContract.connect(user4).releaseWl(2);

        const vesting0 = (await presaleContractWl.connect(user4).presaleInfos(TOKEN_2)).cvgAmount; // 5454,54 total for 4

        const percentCliff = (await vestingContract.connect(user4).vestingSchedules(REAL_VESTING_SCHEDULES.WL.type)).dropCliff;
        const amountDropCliff = (vesting0 * percentCliff) / 1000n;
        expect(await cvg.balanceOf(user4)).to.be.approximately(amountDropCliff, ethers.parseEther("0.1"));
    });
    it("Fail : Claiming CVG with non owner of ibo token", async () => {
        await vestingContract.connect(user1).releaseIbo(TOKEN_1).should.be.revertedWith("NOT_OWNED");
    });

    it("Success : Claiming CVG dust on the iboContract", async () => {
        expect(await cvg.balanceOf(user10)).to.be.equal("0");
        await vestingContract.connect(user10).releaseIbo(TOKEN_1);

        const totalCvgVested = await iboContract.totalCvgPerToken(TOKEN_1);

        expect(await cvg.balanceOf(user10)).to.be.approximately(0, ethers.parseEther("0.01"));
    });

    // DAY 15
    it("Success : Claiming 1/6 of CVG on an IBO token", async () => {
        await network.provider.send("evm_increaseTime", [15 * 86400]);
        await network.provider.send("hardhat_mine", []);

        expect(await cvg.balanceOf(user10)).to.be.approximately("0", ethers.parseEther("0.01"));
        await vestingContract.connect(user10).releaseIbo(TOKEN_1);

        const totalCvgVested = await iboContract.totalCvgPerToken(TOKEN_1);

        expect(await cvg.balanceOf(user10)).to.be.approximately(totalCvgVested / 4n, ethers.parseEther("0.1"));
    });

    // DAY 30

    it("WL_S (7) releaseWl releaseTime1 should change balances", async () => {
        const amountAfter30Days = BigInt("503031399799999999999");
        await network.provider.send("evm_increaseTime", [15 * 86400]);
        await network.provider.send("hardhat_mine", []);

        await vestingContract.connect(user7).releaseWl(TOKEN_1);
        expect(await cvg.balanceOf(user7)).to.be.approximately(amountAfter30Days, ethers.parseEther("0.1"));
    });

    it("WL_M (4) releaseWl after releaseTime1 should change balances", async () => {
        const amountAfter30Days = BigInt("3018188398799999999999");
        await vestingContract.connect(user4).releaseWl(TOKEN_2);
        expect(await cvg.balanceOf(user4)).to.be.approximately(amountAfter30Days, ethers.parseEther("0.1"));
    });

    it("Success : Claiming 1/3 of CVG on an IBO token", async () => {
        const totalCvgVested = await iboContract.totalCvgPerToken(TOKEN_1);

        expect(await cvg.balanceOf(user10)).to.be.approximately(totalCvgVested / 4n, ethers.parseEther("0.01"));
        await vestingContract.connect(user10).releaseIbo(TOKEN_1);

        expect(await cvg.balanceOf(user10)).to.be.approximately(totalCvgVested / 2n, ethers.parseEther("0.1"));
    });
    // DAY 89

    it("WL_S (7) releaseWl after releaseTime2 should change balances", async () => {
        const amountAfter89Days = BigInt("902324485899999999999");
        await network.provider.send("evm_increaseTime", [59 * 86400]);
        await network.provider.send("hardhat_mine", []);
        await vestingContract.connect(user7).releaseWl(TOKEN_1);
        expect(await cvg.balanceOf(user7)).to.be.approximately(amountAfter89Days, ethers.parseEther("0.1"));
    });

    it("WL_M (4) releaseWl after releaseTime2 should change balances", async () => {
        const amountAfter89Days = BigInt("5413946915399999999999");
        await vestingContract.connect(user4).releaseWl(TOKEN_2);
        expect(await cvg.balanceOf(user4)).to.be.approximately(amountAfter89Days, ethers.parseEther("0.1"));
    });

    it("WL_L (1) releaseWl after releaseTime2 should change balances", async () => {
        const amountAfter89Days = BigInt("9023244858999999999999");
        await vestingContract.connect(user1).releaseWl(TOKEN_3);
        expect(await cvg.balanceOf(user1)).to.be.approximately(amountAfter89Days, ethers.parseEther("0.1"));
    });

    it("Success : Claiming almost all of CVG on an IBO token", async () => {
        const totalCvgVested = await iboContract.totalCvgPerToken(TOKEN_1);

        expect(await cvg.balanceOf(user10)).to.be.approximately("946975178030303030302", ethers.parseEther("0.01"));
        await vestingContract.connect(user10).releaseIbo(TOKEN_1);

        expect(await cvg.balanceOf(user10)).to.be.eq(totalCvgVested);
    });
    it("Fail : Re-claim after all CVG released", async () => {
        await vestingContract.connect(user10).releaseIbo(TOKEN_1).should.be.revertedWith("NOT_RELEASABLE");
    });

    // DAY 90

    it("WL_S (7) end of vesting, claim all", async () => {
        const fullAmount = (await presaleContractWl.presaleInfos(TOKEN_1)).cvgAmount;
        await network.provider.send("evm_increaseTime", [59 * 86400]);
        await network.provider.send("hardhat_mine", []);
        await vestingContract.connect(user7).releaseWl(TOKEN_1);
        expect(await cvg.balanceOf(user7)).to.be.eq(fullAmount);
    });

    it("WL_M (4) end of vesting, claim all", async () => {
        const fullAmount = (await presaleContractWl.presaleInfos(TOKEN_2)).cvgAmount;
        await vestingContract.connect(user4).releaseWl(TOKEN_2);
        expect(await cvg.balanceOf(user4)).to.be.eq(fullAmount);
    });

    it("WL_L (1) end of vesting, claim all", async () => {
        const fullAmount = (await presaleContractWl.presaleInfos(TOKEN_3)).cvgAmount;
        await vestingContract.connect(user1).releaseWl(TOKEN_3);
        expect(await cvg.balanceOf(user1)).to.be.eq(fullAmount);
    });

    it("Success : Claiming all of CVG on an IBO token", async () => {
        const totalCvgVested = await iboContract.totalCvgPerToken(TOKEN_1);
        expect(await cvg.balanceOf(user10)).to.be.eq(totalCvgVested);
    });

    // // DAY 120

    it("Go at end of seed cliff & Success claiming cliff of token 1 on Seed", async () => {
        await network.provider.send("evm_increaseTime", [30 * 86400]);
        await network.provider.send("hardhat_mine", []);
        const amountAfterCliff = 129333791550000000000000n;

        const firstTokenOwner = await presaleContractSeed.ownerOf(TOKEN_1);
        await network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [firstTokenOwner],
        });

        await vestingContract.connect(await ethers.getSigner(firstTokenOwner)).releaseSeed(TOKEN_1);

        expect(await cvg.balanceOf(firstTokenOwner)).to.be.approximately(amountAfterCliff, ethers.parseEther("1"));
    });

    it("Success Get the vesting information of a presale token", async () => {
        const t1 = await vestingContract.getInfoVestingTokenId(TOKEN_1, REAL_VESTING_SCHEDULES.PRESEED_SEED.type);
        expect(t1.amountReleasable).to.be.eq("0");
        expect(t1.totalCvg).to.be.eq("750000000000000000000000");
        expect(t1.amountRedeemed).to.be.approximately(129333791550000000000000n, ethers.parseEther("1"));
    });

    it("WL_S (7) try to release, but nothing to release ", async () => {
        await expect(vestingContract.connect(user7).releaseWl(TOKEN_1)).to.be.revertedWith("NOT_RELEASABLE");
    });

    it("WL_M (4) try to release, but nothing to release", async () => {
        await expect(vestingContract.connect(user4).releaseWl(TOKEN_2)).to.be.revertedWith("NOT_RELEASABLE");
    });

    // GETTERS

    it("Success Get the Total CVG released by the vesting schedule", async () => {
        const v1 = await vestingContract.getTotalReleasedScheduleId(REAL_VESTING_SCHEDULES.PRESEED_SEED.type);
        expect(v1).to.be.approximately(129333791550000000000000n, ethers.parseEther("1"));
    });

    // DAY 190
    it("Go in day 190", async () => {
        await network.provider.send("evm_increaseTime", [70 * 86400]);
        await network.provider.send("hardhat_mine", []);
    });

    it("Success claiming  Seed in day 190", async () => {
        const amountday190 = 240167180062500000000000n; // 37500 = 750 000 * (1/20) tokens dropped at cliffs

        const firstTokenOwner = await presaleContractSeed.ownerOf(TOKEN_1);

        await network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [firstTokenOwner],
        });
        await vestingContract.connect(await ethers.getSigner(firstTokenOwner)).releaseSeed(1);

        await network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [firstTokenOwner],
        });

        expect(await cvg.balanceOf(firstTokenOwner)).to.be.approximately(amountday190, ethers.parseEther("1")); // 148_333
    });

    it("Success claiming ALL of token 2 on Seed in day 190", async () => {
        const amountday190 = 98628662886600000000000n;

        const secondTokenOwner = await presaleContractSeed.ownerOf(TOKEN_2);

        await network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [secondTokenOwner],
        });
        await vestingContract.connect(await ethers.getSigner(secondTokenOwner)).releaseSeed(TOKEN_2);

        await network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [secondTokenOwner],
        });
        expect(await cvg.balanceOf(secondTokenOwner)).to.be.approximately(amountday190, ethers.parseEther("1")); /// 60_915,75
    });

    // DAY 480
    it("Go in day 480, end of vesting seed", async () => {
        await network.provider.send("evm_increaseTime", [380 * 86400]);
        await network.provider.send("hardhat_mine", []);
    });

    it("Success claiming  All of token 1", async () => {
        const amountFull = BigInt("750000000000000000000000");

        const firstTokenOwner = await presaleContractSeed.ownerOf(TOKEN_1);

        await network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [firstTokenOwner],
        });
        await vestingContract.connect(await ethers.getSigner(firstTokenOwner)).releaseSeed(TOKEN_1);

        await network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [firstTokenOwner],
        });

        expect(await cvg.balanceOf(firstTokenOwner)).to.be.eq(amountFull); // 148_333
    });

    it("Success claiming  All of token 2", async () => {
        const amountFull = BigInt("308000000000000000000000"); // 37_500 = 750 000 * (1/20) tokens dropped at cliffs

        const secondTokenOwner = await presaleContractSeed.ownerOf(TOKEN_2);

        await network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [secondTokenOwner],
        });
        await vestingContract.connect(await ethers.getSigner(secondTokenOwner)).releaseSeed(TOKEN_2);

        await network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [secondTokenOwner],
        });
        expect(await cvg.balanceOf(secondTokenOwner)).to.be.eq(amountFull); /// 60_915,75
    });
});
