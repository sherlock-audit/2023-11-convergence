import {expect} from "chai";

import {MAX_INTEGER} from "@nomicfoundation/ethereumjs-util";
import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {deployBondFixture} from "../../fixtures/fixtures";
import {time} from "@nomicfoundation/hardhat-network-helpers";
import {Signer} from "ethers";
import {ERC20} from "../../../typechain-types/@openzeppelin/contracts/token/ERC20";
import {CloneFactory, CvgControlTower} from "../../../typechain-types/contracts";
import {Cvg} from "../../../typechain-types/contracts/Token";
import {BondDepository, BondPositionManager} from "../../../typechain-types/contracts/Bond";
import {ICrvPool} from "../../../typechain-types/contracts/interfaces/ICrvPool.sol";
import {ethers} from "hardhat";

describe("Bond tokenisation test", () => {
    let helper;
    let owner: Signer, treasuryBonds: Signer, treasuryDao: Signer, user1: Signer;
    let dai: ERC20,
        frax: ERC20,
        crv: ERC20,
        usdc: ERC20,
        wETH: ERC20,
        fxs: ERC20,
        controlTowerContract: CvgControlTower,
        cloneFactoryContract: CloneFactory,
        cvgContract: Cvg,
        baseBondContract: BondDepository;
    let daiBondContract: BondDepository, wETHBondContract: BondDepository, usdcBondContract: BondDepository, crvBondContract: BondDepository;
    let cvgPoolContract: ICrvPool;
    let token;
    let bondPositionManager: BondPositionManager;

    before(async () => {
        let {contracts, users} = await loadFixture(deployBondFixture);

        owner = users.owner;
        user1 = users.user1;
        treasuryBonds = users.treasuryBonds;
        treasuryDao = users.treasuryDao;
        controlTowerContract = contracts.base.cvgControlTower;

        bondPositionManager = contracts.bonds.bondPositionManager;

        token = contracts.tokens;

        usdc = token.usdc;
        wETH = token.weth;

        baseBondContract = contracts.bonds.baseBond;
        cvgContract = contracts.tokens.cvg;
        cloneFactoryContract = contracts.base.cloneFactory;
    });

    it("Success : Should create bond Stable", async () => {
        const tx = await cloneFactoryContract.connect(treasuryDao).createBond(
            {
                bondDuration: 86400 * 70,
                maxCvgToMint: ethers.parseEther("1000000"),
                minRoi: 5_000,
                maxRoi: 65_000,
                composedFunction: 0,
                vestingTerm: 432_000,
                token: usdc,
                percentageMaxCvgToMint: 150,
                gamma: 250_000,
                scale: 5_000,
            },
            1
        );

        const receipt1 = await tx.wait();
        const events = receipt1.logs.filter((e) => e?.fragment?.name === "BondCreated");
        usdcBondContract = await ethers.getContractAt("BondDepository", events[0].args[1]);
        const usdcBondContractOwner = await usdcBondContract.owner();
        expect(await usdcBondContract.getAddress()).is.not.empty;
        expect(usdcBondContractOwner).to.equal(await treasuryDao.getAddress());

        // approve users USDC spending from cvg utilities
        await usdc.connect(user1).approve(usdcBondContract, MAX_INTEGER);
        await usdc.connect(owner).approve(usdcBondContract, MAX_INTEGER);
    });

    it("Success : Should create bond not stable", async () => {
        const tx2 = await cloneFactoryContract.connect(treasuryDao).createBond(
            {
                bondDuration: 86400 * 70,
                maxCvgToMint: ethers.parseEther("1000000"),
                minRoi: 5_000,
                maxRoi: 65_000,
                composedFunction: "0",
                vestingTerm: 7_600,
                token: wETH,
                percentageMaxCvgToMint: 200,
                gamma: 250_000,
                scale: 5_000,
            },

            1
        );
        const receipt2 = await tx2.wait();
        const events2 = receipt2.logs.filter((e) => e.fragment.name === "BondCreated");
        expect(events2).is.not.empty;

        wETHBondContract = await ethers.getContractAt("BondDepository", events2[0].args[1]);
        expect(await wETHBondContract.getAddress()).is.not.empty;
        const wETHBondContractOwner = await wETHBondContract.owner();
        expect(wETHBondContractOwner).to.equal(await treasuryDao.getAddress());
    });

    it("Fail : depositing asset on a token not created", async () => {
        await expect(wETHBondContract.deposit(1, ethers.parseEther("5"), owner)).to.be.revertedWith("ERC721: invalid token ID");
    });

    it("Success : creating a bond on wETH", async () => {
        await (await wETH.approve(wETHBondContract, MAX_INTEGER)).wait();
        await wETHBondContract.deposit(0, ethers.parseEther("5"), owner);
    });

    it("Fail : using a bond token that is not owned", async () => {
        await expect(usdcBondContract.connect(user1).deposit(1, ethers.parseEther("5"), user1)).to.be.revertedWith("TOKEN_NOT_OWNED");
    });

    it("Fail : updating a bond token on a wrong bondDepository", async () => {
        await expect(usdcBondContract.deposit(1, ethers.parseEther("5"), owner)).to.be.revertedWith("WRONG_BOND_DEPOSITORY");
    });

    it("Fail : redeeming a bond token not owned", async () => {
        await expect(usdcBondContract.connect(user1).redeem(1, owner, owner)).to.be.revertedWith("TOKEN_NOT_OWNED");
    });

    it("Fail : redeeming a bond token on a wrong bondDepository", async () => {
        await expect(usdcBondContract.redeem(1, user1, owner)).to.be.revertedWith("WRONG_BOND_DEPOSITORY");
    });

    it("Fail : burning a bond token not fully claimed", async () => {
        await expect(bondPositionManager.burn(1)).to.be.revertedWith("POSITION_STILL_OPEN");
    });
    it("Fail : burning a bond token not owned", async () => {
        await expect(bondPositionManager.connect(user1).burn(1)).to.be.revertedWith("TOKEN_NOT_OWNED");
    });

    it("Success : creating a second bond on USDC", async () => {
        await (await usdc.approve(usdcBondContract, MAX_INTEGER)).wait();
        await usdcBondContract.deposit(0, ethers.parseUnits("10", 6), owner);
        await time.increase(10 * 86400);
        await usdcBondContract.redeem(2, owner, owner);
    });

    it("Success : creating a third bond on Dai", async () => {
        await usdcBondContract.deposit(0, ethers.parseUnits("10000", 6), owner);
    });
    let token2CvgValue: bigint;
    it("Success : View function for getting infos per token ids", async () => {
        const tokens = await usdcBondContract.getBondInfosPerTokenIds([2, 3]);

        token2CvgValue = tokens[1].vestedCvg;

        expect(tokens[0].claimableCvg).to.be.eq("0");
        expect(tokens[0].vestedCvg).to.be.eq("0");

        expect(tokens[1].claimableCvg).to.be.eq("0");
        expect(tokens[1].vestedCvg).to.be.eq("32409658078107275968238");
    });

    it("Success : View function for the bond depository per TokenID", async () => {
        const tokens = await bondPositionManager.getBondDepositoryOfTokens([1, 2, 3]);
        expect(tokens).to.be.eql([await wETHBondContract.getAddress(), await usdcBondContract.getAddress(), await usdcBondContract.getAddress()]);
    });

    it("Success : redeeming a bond token ", async () => {
        await time.increase(8 * 86400);
        await wETHBondContract.redeem(1, user1, owner);
    });

    it("Verify : claimed totally", async () => {
        const bondInfo = await wETHBondContract.bondInfos(1);
        expect(bondInfo.payout).to.be.eq(0);
        expect(bondInfo.vesting).to.be.eq(0);
    });

    it("Success : burning a token", async () => {
        const tx = await bondPositionManager.burn(1);
    });

    it("Verify : token burnt", async () => {
        await expect(bondPositionManager.ownerOf(1)).to.be.revertedWith("ERC721: invalid token ID");
    });

    it("Fail : calling mint function on BondPositionManager from a random address", async () => {
        await expect(bondPositionManager.mint(owner)).to.be.revertedWith("NOT_BOND_DEPOSITORY");
    });

    it("Success : Bond on a token empty", async () => {
        await usdcBondContract.deposit(2, ethers.parseUnits("10000", 6), owner);
    });

    it("Verify : Bond number 2 values", async () => {
        const tokens = await usdcBondContract.getBondInfosPerTokenIds([2]);
        expect(tokens[0].claimableCvg).to.be.eq("0");
        expect(tokens[0].vestedCvg).to.be.eq(token2CvgValue);
    });

    it("Success : Timelock the token 2 in one day", async () => {
        const timestamp = await time.latest();
        const tx = await bondPositionManager.setLock(2, timestamp + 86400);
        expect(await bondPositionManager.unlockingTimestampPerToken(2)).to.be.eq(timestamp + 86400);
    });

    it("Fail : Refreshing a bond vesting end when timelocked", async () => {
        await expect(usdcBondContract.deposit(2, 10, owner)).to.be.revertedWith("TOKEN_TIMELOCKED");
    });

    it("Fail : Redeeming a bond when timelocked", async () => {
        await expect(usdcBondContract.redeem(2, owner, owner)).to.be.revertedWith("TOKEN_TIMELOCKED");
    });

    it("Success : Transfer the token to simulate a sell, wait 1 day and redeem with new owner", async () => {
        await bondPositionManager.transferFrom(owner, user1, 2);
        await time.increase(1 * 86400);
        await usdcBondContract.connect(user1).redeem(2, user1, owner);
    });
});
