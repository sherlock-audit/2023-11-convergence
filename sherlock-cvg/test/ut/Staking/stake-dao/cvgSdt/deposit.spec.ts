import {loadFixture} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import {expect} from "chai";
import {IContracts, IUsers} from "../../../../../utils/contractInterface";
import {deploySdtStakingFixture, increaseCvgCycle} from "../../../../fixtures/fixtures";
import {Signer} from "ethers";
import {ethers} from "hardhat";
import {ERC20, CvgSDT, SdtStakingPositionService} from "../../../../../typechain-types";
import {CYCLE_1, CYCLE_2, CYCLE_3, MINT, TOKEN_4, TOKEN_5} from "../../../../../resources/constant";

describe("CvgSdtStaking - Deposit", () => {
    let owner: Signer, user1: Signer, user2: Signer, veSdtMultisig: Signer, treasuryDao: Signer;
    let cvgSdtStakingContract: SdtStakingPositionService;
    let sdt: ERC20, cvgSdt: CvgSDT;

    let contracts: IContracts, users: IUsers;

    before(async () => {
        const contractUsers = await loadFixture(deploySdtStakingFixture);

        contracts = contractUsers.contracts;
        users = contractUsers.users;

        owner = users.owner;
        user1 = users.user1;
        user2 = users.user2;
        veSdtMultisig = users.veSdtMultisig;
        treasuryDao = users.treasuryDao;

        cvgSdtStakingContract = contracts.stakeDao.cvgSdtStaking;
        const tokens = contracts.tokens;
        cvgSdt = tokens.cvgSdt;
        sdt = tokens.sdt;

        await sdt.approve(cvgSdt, ethers.MaxUint256);

        // mint cvgSdt
        await cvgSdt.mint(owner, ethers.parseEther("20000"));

        // transfer sdt to users
        await cvgSdt.transfer(user1, ethers.parseEther("10000"));
        await cvgSdt.transfer(user2, ethers.parseEther("10000"));

        // approve sdt spending from staking contract
        await cvgSdt.connect(user1).approve(cvgSdtStakingContract, ethers.MaxUint256);
        await cvgSdt.connect(user2).approve(cvgSdtStakingContract, ethers.MaxUint256);

        const balanceOfTokeOwner = await sdt.balanceOf(owner);
        await sdt.approve(veSdtMultisig, balanceOfTokeOwner);
        await sdt.transfer(veSdtMultisig, balanceOfTokeOwner);
    });

    it("Fails : Depositing SDT  with amount 0", async () => {
        await cvgSdtStakingContract.connect(user1).deposit(MINT, 0, ethers.ZeroAddress).should.be.revertedWith("DEPOSIT_LTE_0");
    });

    it("Fails : Setting deposit paused with random user", async () => {
        await cvgSdtStakingContract.connect(user1).toggleDepositPaused().should.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Success : Pauses deposit", async () => {
        await cvgSdtStakingContract.connect(treasuryDao).toggleDepositPaused();
        expect(await cvgSdtStakingContract.depositPaused()).to.be.true;
    });

    it("Fails : Deposits when paused", async () => {
        await cvgSdtStakingContract.connect(user1).deposit(MINT, ethers.parseEther("500"), ethers.ZeroAddress).should.be.revertedWith("DEPOSIT_PAUSED");
    });

    it("Success : Unpause deposit", async () => {
        await cvgSdtStakingContract.connect(treasuryDao).toggleDepositPaused();
        expect(await cvgSdtStakingContract.depositPaused()).to.be.false;
    });

    it("Success : Depositing cvgSdt for user1 at cycle 1", async () => {
        const amount500 = ethers.parseEther("500");
        // deposit cvgToke

        const tx = cvgSdtStakingContract.connect(user1).deposit(MINT, amount500, ethers.ZeroAddress);
        await expect(tx)
            .to.emit(cvgSdtStakingContract, "Deposit")
            .withArgs(TOKEN_4, await user1.getAddress(), CYCLE_1, amount500);

        await expect(tx).to.changeTokenBalances(cvgSdt, [user1, cvgSdtStakingContract], [-amount500, amount500]);

        // staking information
        expect(await cvgSdtStakingContract.tokenInfoByCycle(CYCLE_2, TOKEN_4)).to.be.deep.equal([amount500, amount500]);
    });

    it("Success : Re-deposit cvgSdt for user1 at cycle 1 for cycle 2", async () => {
        const amount1000 = ethers.parseEther("1000");

        // deposit cvgToke
        await expect(cvgSdtStakingContract.connect(user1).deposit(TOKEN_4, amount1000, ethers.ZeroAddress))
            .to.emit(cvgSdtStakingContract, "Deposit")
            .withArgs(TOKEN_4, await user1.getAddress(), CYCLE_1, amount1000);

        // check staking info
        const expectedAmount = ethers.parseEther("1500");
        expect(await cvgSdtStakingContract.tokenInfoByCycle(CYCLE_2, TOKEN_4)).to.be.deep.eq([expectedAmount, expectedAmount]);
    });

    it("Success : Update staking cycle to 2 and processRewards CVG", async () => {
        const expectedAmount = ethers.parseEther("1500");
        await increaseCvgCycle({contracts, users}, 1);

        expect(await cvgSdtStakingContract.stakingCycle()).to.be.equal(2);
        expect(await cvgSdtStakingContract.cycleInfo(CYCLE_2)).to.be.deep.eq([0, expectedAmount, false, false]);
    });

    it("Success : Depositing cvgSdt for user2 at cycle 2 for cycle 3", async () => {
        const amount700 = ethers.parseEther("700");

        // deposit cvgSdt
        await expect(cvgSdtStakingContract.connect(user2).deposit(MINT, amount700, ethers.ZeroAddress))
            .to.emit(cvgSdtStakingContract, "Deposit")
            .withArgs(TOKEN_5, await user2.getAddress(), CYCLE_2, amount700);
        expect(await cvgSdtStakingContract.tokenInfoByCycle(CYCLE_3, TOKEN_5)).to.be.deep.eq([amount700, amount700]);
    });

    it("Fails : Depositing with wrong tokenId", async () => {
        const amount700 = ethers.parseEther("700");
        await cvgSdtStakingContract.connect(user1).deposit(TOKEN_5, amount700, ethers.ZeroAddress).should.be.revertedWith("TOKEN_NOT_OWNED");
    });

    it("Success : Updating staking cycle to 3 and processRewards", async () => {
        const expectedAmount = ethers.parseEther("2200");
        await increaseCvgCycle({contracts, users}, 1);

        expect(await cvgSdtStakingContract.stakingCycle()).to.be.equal(CYCLE_3);
        expect(await cvgSdtStakingContract.cycleInfo(CYCLE_3)).to.be.deep.eq([0, expectedAmount, false, false]);
    });

    it("Success : Deposit", async () => {
        await cvgSdtStakingContract.connect(user1).deposit(MINT, ethers.parseEther("100"), ethers.ZeroAddress);
    });
});
