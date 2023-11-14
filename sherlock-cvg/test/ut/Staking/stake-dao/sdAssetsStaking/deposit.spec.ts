import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {expect} from "chai";
import hardhat, {ethers} from "hardhat";
import {Signer} from "ethers";
import {deploySdtStakingFixture, increaseCvgCycle} from "../../../../fixtures/fixtures";
import {IContractsUser} from "../../../../../utils/contractInterface";
import {ISdAssetGauge, SdtStakingPositionService} from "../../../../../typechain-types";
import {CYCLE_1, CYCLE_2, CYCLE_3, CYCLE_4, MINT, TOKEN_1, TOKEN_2, TOKEN_4, TOKEN_5} from "../../../../../resources/constant";

describe("sdAssetStaking (sdCRVGauge) - Deposit", () => {
    let contractsUsers: IContractsUser;
    let user1: Signer, user2: Signer;
    let sdCRVStaking: SdtStakingPositionService;
    let sdCrvGauge: ISdAssetGauge;
    let sdtBlackHoleAddress: string;
    let treasuryDao: Signer;

    before(async () => {
        contractsUsers = await loadFixture(deploySdtStakingFixture);
        const users = contractsUsers.users;
        const contracts = contractsUsers.contracts;
        user1 = users.user1;
        user2 = users.user2;
        treasuryDao = users.treasuryDao;
        sdCRVStaking = contractsUsers.contracts.stakeDao.sdAssetsStaking.sdCRVStaking;
        sdCrvGauge = contracts.tokensStakeDao.sdCrvGauge;

        sdtBlackHoleAddress = await contracts.base.cvgControlTower.sdtBlackHole();

        // approve sdCRVGauge spending from staking contract
        await sdCrvGauge.connect(user1).approve(sdCRVStaking, ethers.MaxUint256);
        await sdCrvGauge.connect(user2).approve(sdCRVStaking, ethers.MaxUint256);
    });

    it("Fails : Depositing sdCRVGauge with 0 amount", async () => {
        await sdCRVStaking.connect(user1).deposit(MINT, 0, ethers.ZeroAddress).should.be.revertedWith("DEPOSIT_LTE_0");
    });

    it("Success : Sett deposit paused should be reverted with random user", async () => {
        await sdCRVStaking.connect(user1).toggleDepositPaused().should.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Pauses deposit", async () => {
        await sdCRVStaking.connect(treasuryDao).toggleDepositPaused();
        expect(await sdCRVStaking.depositPaused()).to.be.true;
    });

    it("Deposit when deposits are paused should be reverted", async () => {
        await sdCRVStaking.connect(user1).deposit(MINT, ethers.parseEther("500"), ethers.ZeroAddress).should.be.revertedWith("DEPOSIT_PAUSED");
    });

    it("Unpause deposit", async () => {
        await sdCRVStaking.connect(treasuryDao).toggleDepositPaused();
        expect(await sdCRVStaking.depositPaused()).to.be.false;
    });

    it("Deposits sdCRVGauge for user1 at cycle 1 for cycle 2", async () => {
        const amount10 = ethers.parseEther("10");
        const tx = sdCRVStaking.connect(user1).deposit(MINT, amount10, ethers.ZeroAddress);

        // deposit sdCRVGauge
        await expect(tx)
            .to.emit(sdCRVStaking, "Deposit")
            .withArgs(TOKEN_4, await user1.getAddress(), CYCLE_1, amount10);

        await expect(tx).to.changeTokenBalances(sdCrvGauge, [user1, sdtBlackHoleAddress], [-amount10, amount10]);

        // staking information
        expect(await sdCRVStaking.tokenInfoByCycle(CYCLE_2, TOKEN_4)).to.be.deep.eq([amount10, amount10]);
    });

    it("Re-deposit sdCRVGauge for user1 at cycle 1 for cycle 2", async () => {
        const amount5 = ethers.parseEther("5");

        // deposit sdCRVGauge
        await expect(sdCRVStaking.connect(user1).deposit(TOKEN_4, amount5, ethers.ZeroAddress))
            .to.emit(sdCRVStaking, "Deposit")
            .withArgs(TOKEN_4, await user1.getAddress(), CYCLE_1, amount5);

        // check staking info
        const expectedAmount = ethers.parseEther("15");
        expect(await sdCRVStaking.tokenInfoByCycle(TOKEN_2, CYCLE_4)).to.be.deep.eq([expectedAmount, expectedAmount]);
    });

    it("Update staking cycle to 2 and processRewards", async () => {
        const expectedAmount = ethers.parseEther("15");
        await increaseCvgCycle(contractsUsers, 1);

        expect(await sdCRVStaking.stakingCycle()).to.be.equal(CYCLE_2);
        expect((await sdCRVStaking.cycleInfo(CYCLE_2)).totalStaked).to.be.equal("20015000000000000000000");
    });

    it("Success : Depositing sdCRVGauge for user2 at cycle 2", async () => {
        const amount20 = ethers.parseEther("20");

        await expect(sdCRVStaking.connect(user2).deposit(MINT, amount20, ethers.ZeroAddress))
            .to.emit(sdCRVStaking, "Deposit")
            .withArgs(TOKEN_5, await user2.getAddress(), CYCLE_2, amount20);

        expect(await sdCRVStaking.tokenInfoByCycle(CYCLE_3, TOKEN_5)).to.be.deep.eq([amount20, amount20]);
    });

    it("Fails : Depositing with wrong tokenId", async () => {
        const amount10 = ethers.parseEther("10");
        await sdCRVStaking.connect(user2).deposit(TOKEN_1, amount10, ethers.ZeroAddress).should.be.revertedWith("TOKEN_NOT_OWNED");
    });

    it("Success : Updating staking cycle to 3 and processRewards", async () => {
        await increaseCvgCycle(contractsUsers, 1);

        expect(await sdCRVStaking.stakingCycle()).to.be.equal(CYCLE_3);
        expect((await sdCRVStaking.cycleInfo(CYCLE_3)).totalStaked).to.be.equal("20035000000000000000000");
    });
});
