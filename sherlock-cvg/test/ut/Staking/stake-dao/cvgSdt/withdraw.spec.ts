import {expect} from "chai";
import {ethers} from "hardhat";

import {Signer} from "ethers";
import {loadFixture} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import {MINT, TOKEN_4, TOKEN_5, CYCLE_2, CYCLE_1} from "../../../../../resources/constant";
import {SdtStakingPositionService, CvgSdtBuffer, MockFeeDistributor, CvgControlTower, ERC20, CvgSDT} from "../../../../../typechain-types";
import {deploySdtStakingFixture} from "../../../../fixtures/fixtures";

describe("cvgSdtStaking - Withdraw", () => {
    let owner: Signer, user1: Signer, user2: Signer, veSdtMultisig: Signer;
    let cvgSdtStakingContract: SdtStakingPositionService, cvgSdtBuffer: CvgSdtBuffer, feeDistributor: MockFeeDistributor;
    let controlTowerContract: CvgControlTower;
    let sdt: ERC20, weth: ERC20, cvgSdt: CvgSDT, sdFRAX3CRV: ERC20;

    before(async () => {
        const {contracts, users} = await loadFixture(deploySdtStakingFixture);

        owner = users.owner;
        user1 = users.user1;
        user2 = users.user2;
        veSdtMultisig = users.veSdtMultisig;

        cvgSdtStakingContract = contracts.stakeDao.cvgSdtStaking;

        cvgSdt = contracts.tokens.cvgSdt;
        sdt = contracts.tokens.sdt;

        await sdt.approve(cvgSdt, ethers.MaxUint256);

        // mint cvgSdt
        await cvgSdt.mint(owner, ethers.parseEther("30000"));

        // transfer sdt to users
        await cvgSdt.transfer(user1, ethers.parseEther("10000"));
        await cvgSdt.transfer(user2, ethers.parseEther("10000"));

        // approve sdt spending from staking contract
        await cvgSdt.connect(user1).approve(cvgSdtStakingContract, ethers.MaxUint256);
        await cvgSdt.connect(user2).approve(cvgSdtStakingContract, ethers.MaxUint256);

        // deposit for user1 and user2
        await cvgSdtStakingContract.connect(user1).deposit(MINT, ethers.parseEther("5000"), ethers.ZeroAddress);
        await cvgSdtStakingContract.connect(user1).deposit(TOKEN_4, ethers.parseEther("5000"), ethers.ZeroAddress);
        await cvgSdtStakingContract.connect(user2).deposit(MINT, ethers.parseEther("3000"), ethers.ZeroAddress);
    });

    it("Fails : Withdrawing cvgSdt should be reverted with amount 0", async () => {
        await cvgSdtStakingContract.connect(user1).withdraw(TOKEN_4, 0).should.be.revertedWith("WITHDRAW_LTE_0");
    });

    it("Fails : Withdrawing amount that exceeds deposited amount", async () => {
        await cvgSdtStakingContract.connect(user2).withdraw(TOKEN_5, ethers.parseEther("50000")).should.be.revertedWith("WITHDRAW_EXCEEDS_STAKED_AMOUNT");
    });

    it("Fails : Withdrawing with random user", async () => {
        await cvgSdtStakingContract.connect(user1).withdraw(TOKEN_5, ethers.parseEther("1000")).should.be.revertedWith("TOKEN_NOT_OWNED");
    });

    it("Success : Withdraw cvgSdt for user1", async () => {
        expect(await cvgSdtStakingContract.tokenInfoByCycle(CYCLE_2, TOKEN_4)).to.be.deep.eq([ethers.parseEther("10000"), ethers.parseEther("10000")]);
        expect(await cvgSdtStakingContract.tokenInfoByCycle(CYCLE_2, TOKEN_5)).to.be.deep.eq([ethers.parseEther("3000"), ethers.parseEther("3000")]);

        const amount = ethers.parseEther("1000");

        // withdraw cvgSdt
        await expect(cvgSdtStakingContract.connect(user1).withdraw(TOKEN_4, amount))
            .to.emit(cvgSdtStakingContract, "Withdraw")
            .withArgs(TOKEN_4, await user1.getAddress(), CYCLE_1, amount);

        // new cvgSdt balances
        expect(await cvgSdt.balanceOf(user1)).to.be.equal(ethers.parseEther("1000"));
        expect(await cvgSdt.balanceOf(cvgSdtStakingContract)).to.be.equal(ethers.parseEther("12000"));

        // staking information
        const expectedAmount = ethers.parseEther("9000");

        expect(await cvgSdtStakingContract.tokenInfoByCycle(CYCLE_2, TOKEN_4)).to.be.deep.eq([expectedAmount, expectedAmount]);
        expect(await cvgSdtStakingContract.tokenInfoByCycle(CYCLE_2, TOKEN_5)).to.be.deep.eq([ethers.parseEther("3000"), ethers.parseEther("3000")]);
    });
});
