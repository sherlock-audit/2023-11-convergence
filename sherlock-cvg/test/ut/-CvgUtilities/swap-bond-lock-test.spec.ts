import chai from "chai";
import {MAX_INTEGER} from "@nomicfoundation/ethereumjs-util";
import chaiAsPromised from "chai-as-promised";
chai.use(chaiAsPromised).should();
const expect = chai.expect;
import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {deployBondWithLockingFixture, increaseCvgCycle} from "../../fixtures/fixtures";
import {CvgUtilities, SwapperFactory} from "../../../typechain-types/contracts/utils";
import {LockingPositionManager, LockingPositionService} from "../../../typechain-types/contracts/Locking";
import {BondDepository} from "../../../typechain-types/contracts/Bond";
import {Signer, EventLog} from "ethers";
import {ERC20} from "../../../typechain-types/@openzeppelin/contracts/token/ERC20";
import {IContracts, IContractsUser} from "../../../utils/contractInterface";
import {ethers} from "hardhat";
import {ApiHelper} from "../../../utils/ApiHelper";
import {PositionLocker} from "../../../typechain-types";
import {AGGREGATIONROUTERV5} from "../../../resources/oneInch";
const slippage = 10;

describe("CvgUtilities - Swap & Bond & Lock", () => {
    let swapperFactory: SwapperFactory,
        cvgUtilities: CvgUtilities,
        lockingPositionManager: LockingPositionManager,
        lockingPositionServiceContract: LockingPositionService,
        usdcBondContract: BondDepository,
        positionLocker: PositionLocker;
    let user10: Signer, user11: Signer, treasuryDao: Signer;
    let dai: ERC20, usdc: ERC20, usdt: ERC20;

    let contractsUsers: IContractsUser;
    // create bond USDC contract
    const createUsdcBond = async (contracts: IContracts) => {
        const tx = await contracts.base.cloneFactory.connect(treasuryDao).createBond(
            {
                gamma: 250_000,
                scale: 5_000,
                maxCvgToMint: ethers.parseEther("1000000"),
                minRoi: 5_000,
                maxRoi: 65_000,
                bondDuration: 86_400,
                composedFunction: 0,
                vestingTerm: 432_000,
                token: usdc,
                percentageMaxCvgToMint: 150,
            },
            1
        );

        const receipt1 = await tx.wait();
        const events = (receipt1!.logs as EventLog[]).filter((e) => e?.fragment?.name === "BondCreated");
        usdcBondContract = await ethers.getContractAt("BondDepository", events[0].args[1]);

        // approve USDC bond to spend CvgUtilities USDC
        await cvgUtilities.connect(treasuryDao).approveRouterTokenSpending(usdc, usdcBondContract, MAX_INTEGER);
    };

    before(async () => {
        contractsUsers = await loadFixture(deployBondWithLockingFixture);
        const contracts = contractsUsers.contracts;
        const users = contractsUsers.users;
        swapperFactory = contracts.base.swapperFactory;
        cvgUtilities = contracts.base.cvgUtilities;
        lockingPositionServiceContract = contracts.locking.lockingPositionService;
        lockingPositionManager = contracts.locking.lockingPositionManager;
        positionLocker = contracts.tests.positionLocker;

        const tokens = contracts.tokens;
        dai = tokens.dai;
        usdc = tokens.usdc;
        usdt = tokens.usdt;

        user10 = users.user10;
        user11 = users.user11;
        treasuryDao = users.treasuryDao;

        // approve users DAI spending from swapper factory
        await dai.connect(user10).approve(swapperFactory, MAX_INTEGER);
        await dai.connect(user11).approve(swapperFactory, MAX_INTEGER);

        // approve users USDC spending from cvg utilities
        await usdc.connect(user10).approve(cvgUtilities, MAX_INTEGER);
        await usdc.connect(user11).approve(cvgUtilities, MAX_INTEGER);

        // allow CvgUtilities to be locker in lockingPositionService
        await lockingPositionServiceContract.connect(treasuryDao).toggleContractLocker(cvgUtilities);
        await createUsdcBond(contracts);
    });
    it("check view bond contracts", async () => {
        await contractsUsers.contracts.base.cvgControlTower.getAllBaseBonds();
        await contractsUsers.contracts.base.cvgControlTower.getBondLengthPerVersion(1);
        await contractsUsers.contracts.base.cvgControlTower.getBondContractsPerVersion(1, 0, 1);
        await contractsUsers.contracts.base.cvgControlTower.getBondContractsPerVersion(1, 0, 5);
    });
    it("Fail to approveRouterTokenSpending with random user", async () => {
        await cvgUtilities.approveRouterTokenSpending(usdc, usdcBondContract, MAX_INTEGER).should.be.revertedWith("Ownable: caller is not the owner");
    });
    it("Fail to toggle source token", async () => {
        await swapperFactory.toggleSourceToken(dai).should.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Enables source token (DAI)", async () => {
        await swapperFactory.connect(treasuryDao).toggleSourceToken(dai);
        expect(await swapperFactory.srcTokenAllowed(dai)).to.be.true;
        expect(await dai.allowance(swapperFactory, AGGREGATIONROUTERV5)).to.be.equal(ethers.MaxUint256);
    });
    it("Enables source token (USDT)", async () => {
        await swapperFactory.connect(treasuryDao).toggleSourceToken(usdt);
        expect(await swapperFactory.srcTokenAllowed(usdt)).to.be.true;
        expect(await usdt.allowance(swapperFactory, AGGREGATIONROUTERV5)).to.be.equal(ethers.MaxUint256);
    });
    it("Disables source token (USDT)", async () => {
        await swapperFactory.connect(treasuryDao).toggleSourceToken(usdt);
        expect(await swapperFactory.srcTokenAllowed(usdt)).to.be.false;
        expect(await usdt.allowance(swapperFactory, AGGREGATIONROUTERV5)).to.be.equal(0);
    });

    it("Fails to swap DAI to mint locking position with low locking duration (30 cycles)", async () => {
        const amountToSwap = ethers.parseEther("300");
        const data = await ApiHelper.getOneInchDataForSwap(
            await dai.getAddress(),
            await usdc.getAddress(),
            amountToSwap.toString(),
            await swapperFactory.getAddress(),
            slippage.toString(),
            await cvgUtilities.getAddress()
        );
        await cvgUtilities
            .connect(user10)
            .swapTokenBondAndLock(usdcBondContract, 0, 0, 0, 30, 0, 0, data)
            .should.be.revertedWith("LOCK_DURATION_NOT_LONG_ENOUGH");
    });
    it("Fails to swap DAI to mint locking position with executor address zero", async () => {
        const amountToSwap = ethers.parseEther("300");
        const data = await ApiHelper.getOneInchDataForSwap(
            await dai.getAddress(),
            await usdc.getAddress(),
            amountToSwap.toString(),
            await swapperFactory.getAddress(),
            slippage.toString(),
            await cvgUtilities.getAddress()
        );
        data.executor = ethers.ZeroAddress;
        await cvgUtilities.connect(user10).swapTokenBondAndLock(usdcBondContract, 0, 0, 0, 47, 0, 0, data).should.be.revertedWith("INVALID_AMOUNT");
    });

    it("Fails to Swaps Token bond and lock with unauthorized contract", async () => {
        const amountToSwap = ethers.parseEther("300");
        const data = await ApiHelper.getOneInchDataForSwap(
            await dai.getAddress(),
            await usdc.getAddress(),
            amountToSwap.toString(),
            await swapperFactory.getAddress(),
            slippage.toString(),
            await cvgUtilities.getAddress()
        );
        await dai.connect(user10).transfer(positionLocker, amountToSwap);

        // ACTUAL CVG CYCLE = 1
        const ysPercentage = 30;
        await positionLocker
            .connect(user10)
            .swapTokenBondAndLock(dai, usdcBondContract, 0, 0, 0, 47, 0, ysPercentage, data)
            .should.be.revertedWith("NOT_ALLOWED");
    });

    it("Swaps DAI to mint locking position (47 cycles)", async () => {
        const amountToSwap = ethers.parseEther("300");
        const data = await ApiHelper.getOneInchDataForSwap(
            await dai.getAddress(),
            await usdc.getAddress(),
            amountToSwap.toString(),
            await swapperFactory.getAddress(),
            slippage.toString(),
            await cvgUtilities.getAddress()
        );

        // ACTUAL CVG CYCLE = 1
        const ysPercentage = 30;
        await cvgUtilities.connect(user10).swapTokenBondAndLock(usdcBondContract, 0, 0, 0, 47, 0, ysPercentage, data);

        const lockingPosition = await lockingPositionServiceContract.lockingPositions(1);
        expect(await lockingPositionManager.balanceOf(user10)).to.be.equal(1);
        expect(lockingPosition.ysPercentage).to.be.equal(ysPercentage);
        expect(lockingPosition.lastEndCycle).to.be.equal(48);
    });

    it("Swaps DAI to increase locking position amount", async () => {
        const amountToSwap = ethers.parseEther("300");
        const data = await ApiHelper.getOneInchDataForSwap(
            await dai.getAddress(),
            await usdc.getAddress(),
            amountToSwap.toString(),
            await swapperFactory.getAddress(),
            slippage.toString(),
            await cvgUtilities.getAddress()
        );

        // ACTUAL CVG CYCLE = 1
        const previousLockingPosition = await lockingPositionServiceContract.lockingPositions(1);
        await cvgUtilities.connect(user10).swapTokenBondAndLock(usdcBondContract, 0, 1, 0, 0, 0, 0, data);

        // check values have been properly updated (therefore are strictly greater than previous data)
        const lockingPosition = await lockingPositionServiceContract.lockingPositions(1);
        expect(lockingPosition.totalCvgLocked).to.be.gt(previousLockingPosition.totalCvgLocked);
        expect(lockingPosition.mgCvgAmount).to.be.gt(previousLockingPosition.mgCvgAmount);
    });

    it("Swaps DAI to increase locking position time and amount", async () => {
        const amountToSwap = ethers.parseEther("500");
        const data = await ApiHelper.getOneInchDataForSwap(
            await dai.getAddress(),
            await usdc.getAddress(),
            amountToSwap.toString(),
            await swapperFactory.getAddress(),
            slippage.toString(),
            await cvgUtilities.getAddress()
        );

        // ACTUAL CVG CYCLE = 1
        const previousLockingPosition = await lockingPositionServiceContract.lockingPositions(1);
        await cvgUtilities.connect(user10).swapTokenBondAndLock(usdcBondContract, 0, 1, 0, 0, 12, 0, data);

        // check values have been properly updated (therefore are strictly greater than previous data)
        const lockingPosition = await lockingPositionServiceContract.lockingPositions(1);
        expect(lockingPosition.lastEndCycle).to.be.equal(60);
        expect(lockingPosition.totalCvgLocked).to.be.gt(previousLockingPosition.totalCvgLocked);
        expect(lockingPosition.mgCvgAmount).to.be.gt(previousLockingPosition.mgCvgAmount);
    });
    it("Success to Swaps Token bond and lock with authorized contract", async () => {
        await lockingPositionServiceContract.connect(treasuryDao).toggleContractLocker(positionLocker);
        const amountToSwap = ethers.parseEther("300");
        const data = await ApiHelper.getOneInchDataForSwap(
            await dai.getAddress(),
            await usdc.getAddress(),
            amountToSwap.toString(),
            await swapperFactory.getAddress(),
            slippage.toString(),
            await cvgUtilities.getAddress()
        );
        await dai.connect(user10).transfer(positionLocker, amountToSwap);

        // ACTUAL CVG CYCLE = 1
        const ysPercentage = 30;
        await positionLocker.connect(user10).swapTokenBondAndLock(dai, usdcBondContract, 0, 0, 0, 47, 0, ysPercentage, data);
    });

    it("Increases staking cycle to 41 and fails to increase locking position amount", async () => {
        await increaseCvgCycle(contractsUsers, 40);

        // we must create a new bond because the old one has expired at this cycle
        await createUsdcBond(contractsUsers.contracts);

        const amountToSwap = ethers.parseEther("250");
        const data = await ApiHelper.getOneInchDataForSwap(
            await dai.getAddress(),
            await usdc.getAddress(),
            amountToSwap.toString(),
            await swapperFactory.getAddress(),
            slippage.toString(),
            await cvgUtilities.getAddress()
        );

        // ACTUAL CVG CYCLE = 41
        await cvgUtilities
            .connect(user10)
            .swapTokenBondAndLock(usdcBondContract, 0, 1, 0, 0, 0, 0, data)
            .should.be.revertedWith("REMAINING_LOCK_DURATION_TOO_LOW");
    });

    it("Fails to increase locking position time and amount with low added duration", async () => {
        const amountToSwap = ethers.parseEther("250");
        const data = await ApiHelper.getOneInchDataForSwap(
            await dai.getAddress(),
            await usdc.getAddress(),
            amountToSwap.toString(),
            await swapperFactory.getAddress(),
            slippage.toString(),
            await cvgUtilities.getAddress()
        );

        // ACTUAL CVG CYCLE = 41
        await cvgUtilities
            .connect(user10)
            .swapTokenBondAndLock(usdcBondContract, 0, 1, 0, 0, 12, 0, data)
            .should.be.revertedWith("ADDED_LOCK_DURATION_NOT_ENOUGH");
    });
});
