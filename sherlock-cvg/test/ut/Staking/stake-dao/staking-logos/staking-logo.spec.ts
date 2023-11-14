import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {ethers} from "hardhat";
import {Signer} from "ethers";
import {IContractsUser} from "../../../../../utils/contractInterface";
import {deploySdtStakingFixture, increaseCvgCycle} from "../../../../fixtures/fixtures";
import {render_svg} from "../../../../../utils/svg/render_svg";
import {CvgControlTower, SdtStakingLogo, SdtStakingPositionManager} from "../../../../../typechain-types";
import {expect} from "chai";
import {TOKEN_4} from "../../../../../resources/constant";

const PATH = "./test/ut/Staking/stake-dao/staking-logos/";

describe("Sdt Staking Logo", () => {
    let contractsUsers: IContractsUser;
    let owner: Signer, user1: Signer, user2: Signer, treasuryDao: Signer;
    let sdtStakingPositionManager: SdtStakingPositionManager;
    let cvgControlTower: CvgControlTower;
    let sdtStakingLogo: SdtStakingLogo;

    before(async () => {
        contractsUsers = await loadFixture(deploySdtStakingFixture);

        const contracts = contractsUsers.contracts;
        const tokens = contracts.tokens;

        const users = contractsUsers.users;
        owner = users.owner;
        user1 = users.user1;
        user2 = users.user2;
        treasuryDao = users.treasuryDao;

        cvgControlTower = contracts.base.cvgControlTower;
        sdtStakingLogo = contracts.stakeDao.sdtStakingLogo;
        const cvgSdtStaking = contracts.stakeDao.cvgSdtStaking;
        const cvgSdtBuffer = contracts.stakeDao.cvgSdtBuffer;
        const gaugeController = contracts.locking.gaugeController;
        const lockingPositionService = contracts.locking.lockingPositionService;
        const cvg = tokens.cvg;
        const cvgSdt = tokens.cvgSdt;
        const sdt = tokens.sdt;

        // mint locking position and vote for cvgSdtStaking gauge
        await cvg.approve(lockingPositionService, ethers.parseEther("300000"));
        await lockingPositionService.mintPosition(47, ethers.parseEther("100000"), 0, owner, true);
        await gaugeController.simple_vote(5, cvgSdtStaking, 1000);
        await sdt.approve(cvgSdt, ethers.MaxUint256);

        sdtStakingPositionManager = contracts.stakeDao.sdtStakingPositionManager;

        // mint cvgSdt
        await cvgSdt.mint(owner, ethers.parseEther("30000"));

        // transfer cvgSdt to users
        await cvgSdt.transfer(user1, ethers.parseEther("10000"));
        await cvgSdt.transfer(user2, ethers.parseEther("10000"));

        // approve cvgSdt spending from staking contract
        await cvgSdt.connect(user1).approve(cvgSdtStaking, ethers.MaxUint256);
        await cvgSdt.connect(user2).approve(cvgSdtStaking, ethers.MaxUint256);

        // deposit for user1 and user2
        await cvgSdtStaking.connect(user1).deposit(0, ethers.parseEther("5000"), ethers.ZeroAddress);
        await cvgSdtStaking.connect(user2).deposit(0, ethers.parseEther("5000"), ethers.ZeroAddress);

        // increase to cycle 3
        await increaseCvgCycle(contractsUsers, 2);

        // process SDT rewards
        await sdt.connect(users.veSdtMultisig).transfer(cvgSdtBuffer, ethers.parseEther("1000"));
        await cvgSdtStaking.connect(users.veSdtMultisig).processSdtRewards();
    });
    it("Fail: setTokensLogo with random user with error in array length", async () => {
        await sdtStakingLogo.connect(treasuryDao).setTokensLogo(["test", "test2"], ["test"]).should.be.revertedWith("LENGTH_MISMATCH");
    });

    it("Fail: setTokensLogo with random user", async () => {
        await sdtStakingLogo.setTokensLogo(["test"], ["test"]).should.be.revertedWith("Ownable: caller is not the owner");
    });
    it("Lock nft", async () => {
        const blockNumBefore = await ethers.provider.getBlockNumber();
        const blockBefore = await ethers.provider.getBlock(blockNumBefore);
        const timestampBefore = blockBefore!.timestamp;
        const oneDayTimestamp = 86400;
        await sdtStakingPositionManager.connect(user1).setLock(1, timestampBefore + oneDayTimestamp);
    });
    it("check getLogoInfo", async () => {
        const logoInfo = await sdtStakingLogo.getLogoInfo(TOKEN_4);
        expect(logoInfo.tokenId).to.be.equal(TOKEN_4);
        expect(logoInfo.symbol).to.be.equal("STK-cvgSDT");
        expect(logoInfo.pending).to.be.equal(0n);
        expect(logoInfo.totalStaked).to.be.equal(5000000000000000000000n);
        expect(logoInfo.cvgClaimable).to.be.equal(17850678733031673967506n);
        // expect(logoInfo.sdtClaimable).to.be.equal();
        // expect(logoInfo.claimableInUsd).to.be.equal();
        expect(logoInfo.isLocked).to.be.false;
        expect(logoInfo.hoursLock).to.be.equal(0);
    });

    it("Renders SVG", async () => {
        render_svg(await sdtStakingPositionManager.tokenURI(1), "STK-sdCRV", PATH);
        render_svg(await sdtStakingPositionManager.tokenURI(2), "STK-sdANGLE", PATH);
        render_svg(await sdtStakingPositionManager.tokenURI(3), "STK-sdBAL", PATH);
        render_svg(await sdtStakingPositionManager.tokenURI(4), "STK-cvgSDT", PATH);
    });
    it("Success: unset lockingLogo", async () => {
        await cvgControlTower.connect(treasuryDao).setSdtStakingLogo(ethers.ZeroAddress);
    });
    it("Fail: try to setBaseUri with non-owner should revert", async () => {
        await sdtStakingPositionManager.setBaseURI("ipfs://test/").should.be.revertedWith("Ownable: caller is not the owner");
    });
    it("Success: setBaseUri with owner", async () => {
        await sdtStakingPositionManager.connect(treasuryDao).setBaseURI("ipfs://test/");
    });
    it("Success: check tokenUri", async () => {
        const uri = await sdtStakingPositionManager.tokenURI(1);
        expect(uri).to.be.equal("ipfs://test/1");
    });
    it("Success: setBaseUri with owner", async () => {
        await sdtStakingPositionManager.connect(treasuryDao).setBaseURI("");
    });
    it("Success: check tokenUri", async () => {
        const uri = await sdtStakingPositionManager.tokenURI(1);
        expect(uri).to.be.equal("");
    });
});
