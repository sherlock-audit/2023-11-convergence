import chai from "chai";
import {MAX_INTEGER} from "@nomicfoundation/ethereumjs-util";
import chaiAsPromised from "chai-as-promised";

chai.use(chaiAsPromised).should();
const expect = chai.expect;

import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {deployBondWithLockingFixture} from "../../fixtures/fixtures";
import {
    BondDepository,
    BondPositionManager,
    CvgUtilities,
    ERC20,
    LockingPositionManager,
    LockingPositionService,
    SwapperFactory,
} from "../../../typechain-types";
import {EventLog, Signer} from "ethers";
import {ethers} from "hardhat";
import {ApiHelper} from "../../../utils/ApiHelper";

const slippage = 10;

describe("CvgUtilities - Swap & Bond", () => {
    let swapperFactory: SwapperFactory,
        cvgUtilities: CvgUtilities,
        lockingPositionManager: LockingPositionManager,
        lockingPositionServiceContract: LockingPositionService,
        usdcBondContract: BondDepository,
        bondPositionManagerContract: BondPositionManager;
    let user10: Signer, user11: Signer, treasuryDao: Signer;
    let dai: ERC20, usdc: ERC20, weth: ERC20;

    before(async () => {
        const {contracts, users} = await loadFixture(deployBondWithLockingFixture);

        swapperFactory = contracts.base.swapperFactory;
        cvgUtilities = contracts.base.cvgUtilities;
        bondPositionManagerContract = contracts.bonds.bondPositionManager;
        const tokens = contracts.tokens;
        dai = tokens.dai;
        usdc = tokens.usdc;
        weth = tokens.weth;

        user10 = users.user10;
        user11 = users.user11;
        treasuryDao = users.treasuryDao;

        // approve users DAI spending from swapper factory
        await dai.connect(user10).approve(swapperFactory, MAX_INTEGER);
        await dai.connect(user11).approve(swapperFactory, MAX_INTEGER);

        // approve users USDC spending from cvg utilities
        await usdc.connect(user10).approve(cvgUtilities, MAX_INTEGER);
        await usdc.connect(user11).approve(cvgUtilities, MAX_INTEGER);

        // create bond contract
        const tx = await contracts.base.cloneFactory.connect(treasuryDao).createBond(
            {
                gamma: 250_000,
                scale: 5_000,
                maxCvgToMint: ethers.parseEther("1000000"),
                minRoi: 5_000,
                maxRoi: 65_000,
                composedFunction: 0,
                vestingTerm: 432_000,
                token: usdc,
                percentageMaxCvgToMint: 150,
                bondDuration: 864_000,
            },
            1
        );

        const receipt1 = await tx.wait();
        const logs = receipt1?.logs as EventLog[];
        const events = logs.filter((e) => e?.fragment?.name === "BondCreated");
        usdcBondContract = await ethers.getContractAt("BondDepository", events[0].args[1]);

        // approve USDC bond to spend CvgUtilities USDC
        await cvgUtilities.connect(treasuryDao).approveRouterTokenSpending(usdc, usdcBondContract, MAX_INTEGER);
    });
    it("Fail: approveRouterTokenSpending with random account", async () => {
        await cvgUtilities.approveRouterTokenSpending(usdc, usdcBondContract, MAX_INTEGER).should.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Enables source token (DAI)", async () => {
        await swapperFactory.connect(treasuryDao).toggleSourceToken(dai);
        expect(await swapperFactory.srcTokenAllowed(dai)).to.be.true;
    });

    it("Fails swapping DAI to USDC with random account directly from SwapperFactory", async () => {
        const amountToSwap = ethers.parseEther("300");
        const data = await ApiHelper.getOneInchDataForSwap(
            await dai.getAddress(),
            await usdc.getAddress(),
            amountToSwap.toString(),
            await swapperFactory.getAddress(),
            slippage.toString(),
            await cvgUtilities.getAddress()
        );

        await swapperFactory.connect(user11).executeSimpleSwap(user10, data).should.be.revertedWith("NOT_CVG_UTILITIES");
    });

    it("Fails swapping DAI to deposit into bond USDC contract with invalid destination token (WETH)", async () => {
        const amountToSwap = ethers.parseEther("300");
        const data = await ApiHelper.getOneInchDataForSwap(
            await dai.getAddress(),
            await weth.getAddress(),
            amountToSwap.toString(),
            await swapperFactory.getAddress(),
            slippage.toString(),
            await cvgUtilities.getAddress()
        );

        await cvgUtilities.connect(user10).swapTokenBondAndLock(usdcBondContract, 0, 0, 0, 0, 0, 0, data).should.be.revertedWith("INVALID_DESTINATION_TOKEN");
    });

    it("Fails swapping DAI to deposit into bond USDC contract with invalid amount", async () => {
        const amountToSwap = ethers.parseEther("300");
        const data = await ApiHelper.getOneInchDataForSwap(
            await dai.getAddress(),
            await usdc.getAddress(),
            amountToSwap.toString(),
            await swapperFactory.getAddress(),
            slippage.toString(),
            await cvgUtilities.getAddress()
        );

        data.description[4] = 0; // force amount to 0

        await cvgUtilities.connect(user10).swapTokenBondAndLock(usdcBondContract, 0, 0, 0, 0, 0, 0, data).should.be.revertedWith("INVALID_AMOUNT");
    });

    it("Fails swapping WETH to deposit into bond USDC contract with non-allowed source token", async () => {
        const amountToSwap = ethers.parseEther("3");
        const data = await ApiHelper.getOneInchDataForSwap(
            await weth.getAddress(),
            await usdc.getAddress(),
            amountToSwap.toString(),
            await swapperFactory.getAddress(),
            slippage.toString(),
            await cvgUtilities.getAddress()
        );

        await cvgUtilities.connect(user10).swapTokenBondAndLock(usdcBondContract, 0, 0, 0, 0, 0, 0, data).should.be.revertedWith("SRC_TOKEN_NOT_ALLOWED");
    });

    it("Fails swapping DAI to deposit into bond USDC contract with random receiver", async () => {
        const amountToSwap = ethers.parseEther("300");
        const data = await ApiHelper.getOneInchDataForSwap(
            await dai.getAddress(),
            await usdc.getAddress(),
            amountToSwap.toString(),
            await swapperFactory.getAddress(),
            slippage.toString(),
            await user10.getAddress()
        );

        await cvgUtilities.connect(user10).swapTokenBondAndLock(usdcBondContract, 0, 0, 0, 0, 0, 0, data).should.be.revertedWith("INVALID_RECEIVER");
    });

    it("Swaps DAI to deposit into bond USDC contract", async () => {
        const amountToSwap = ethers.parseEther("300");
        const data = await ApiHelper.getOneInchDataForSwap(
            await dai.getAddress(),
            await usdc.getAddress(),
            amountToSwap.toString(),
            await swapperFactory.getAddress(),
            slippage.toString(),
            await cvgUtilities.getAddress()
        );

        const user1DaiBalance = await dai.balanceOf(user10);

        await cvgUtilities.connect(user10).swapTokenBondAndLock(usdcBondContract, 0, 0, 0, 0, 0, 0, data);

        expect(await dai.balanceOf(user10)).to.be.equal(user1DaiBalance - amountToSwap);
        expect(await bondPositionManagerContract.balanceOf(user10)).to.be.equal(1);
    });

    it("Refills user1 bond position by swapping DAI", async () => {
        const amountToSwap = ethers.parseEther("2");
        const data = await ApiHelper.getOneInchDataForSwap(
            await dai.getAddress(),
            await usdc.getAddress(),
            amountToSwap.toString(),
            await swapperFactory.getAddress(),
            slippage.toString(),
            await cvgUtilities.getAddress()
        );

        const token1payout = (await usdcBondContract.bondInfos(1)).payout;

        await cvgUtilities.connect(user10).swapTokenBondAndLock(usdcBondContract, 1, 0, 0, 0, 0, 0, data);

        expect((await usdcBondContract.bondInfos(1)).payout).to.be.gt(token1payout);
    });

    it("Swaps DAI to deposit into bond USDC contract with additional USDC", async () => {
        const amountToSwap = ethers.parseEther("300");
        const data = await ApiHelper.getOneInchDataForSwap(
            await dai.getAddress(),
            await usdc.getAddress(),
            amountToSwap.toString(),
            await swapperFactory.getAddress(),
            slippage.toString(),
            await cvgUtilities.getAddress()
        );

        const user11DaiBalance = await dai.balanceOf(user11);
        const user11UsdcBalance = await usdc.balanceOf(user11);
        const additionalUsdcAmount = ethers.parseUnits("100", 6);

        await cvgUtilities.connect(user11).swapTokenBondAndLock(usdcBondContract, 0, 0, additionalUsdcAmount, 0, 0, 0, data);

        expect(await dai.balanceOf(user11)).to.be.equal(user11DaiBalance - amountToSwap);
        expect(await usdc.balanceOf(user11)).to.be.equal(user11UsdcBalance - additionalUsdcAmount);
        expect(await bondPositionManagerContract.balanceOf(user11)).to.be.equal(1);
    });
});
