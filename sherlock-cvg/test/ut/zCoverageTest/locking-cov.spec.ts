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
    CvgControlTower,
    CvgUtilities,
    ERC20,
    LockingPositionDelegate,
    LockingPositionManager,
    LockingPositionService,
    MockCvgUtilities,
    SwapperFactory,
} from "../../../typechain-types";
import {EventLog, Signer} from "ethers";
import {ethers} from "hardhat";
import {ApiHelper} from "../../../utils/ApiHelper";
import deployers from "../../../scripts/deployer/unit/_index";
import {IContracts} from "../../../utils/contractInterface";
const slippage = 10;

describe("Coverage Locking", () => {
    let swapperFactory: SwapperFactory,
        cvgUtilities: CvgUtilities,
        mockCvgUtilities: MockCvgUtilities,
        lockingPositionDelegate: LockingPositionDelegate,
        lockingPositionManager: LockingPositionManager,
        lockingPositionService: LockingPositionService,
        usdcBondContract: BondDepository,
        bondPositionManagerContract: BondPositionManager,
        cvgControlTower: CvgControlTower;
    let user1: Signer, user10: Signer, user11: Signer, treasuryDao: Signer;
    let dai: ERC20, usdc: ERC20, weth: ERC20;

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
        await mockCvgUtilities.connect(treasuryDao).approveRouterTokenSpending(usdc, usdcBondContract, MAX_INTEGER);
    };

    before(async () => {
        let contractsUsers = await loadFixture(deployBondWithLockingFixture);
        contractsUsers = await deployers.deployMockCvgUtilities(contractsUsers);

        const contracts = contractsUsers.contracts;
        const users = contractsUsers.users;

        swapperFactory = contracts.base.swapperFactory;
        cvgUtilities = contracts.base.cvgUtilities;
        mockCvgUtilities = contracts.tests.mockCvgUtilities;
        bondPositionManagerContract = contracts.bonds.bondPositionManager;
        cvgControlTower = contracts.base.cvgControlTower;
        lockingPositionDelegate = contracts.locking.lockingPositionDelegate;
        lockingPositionService = contracts.locking.lockingPositionService;
        lockingPositionManager = contracts.locking.lockingPositionManager;
        const tokens = contracts.tokens;
        dai = tokens.dai;
        usdc = tokens.usdc;
        weth = tokens.weth;
        user1 = users.user1;

        user10 = users.user10;
        user11 = users.user11;
        treasuryDao = users.treasuryDao;

        // approve users DAI spending from swapper factory
        await dai.connect(user10).approve(swapperFactory, MAX_INTEGER);
        await dai.connect(user11).approve(swapperFactory, MAX_INTEGER);

        // approve users USDC spending from cvg utilities
        await usdc.connect(user10).approve(mockCvgUtilities, MAX_INTEGER);
        await usdc.connect(user11).approve(mockCvgUtilities, MAX_INTEGER);

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
        await mockCvgUtilities.connect(treasuryDao).approveRouterTokenSpending(usdc, usdcBondContract, MAX_INTEGER);
        await mockCvgUtilities.connect(treasuryDao).approveRouterTokenSpending(dai, usdcBondContract, MAX_INTEGER);

        // allow CvgUtilities to be locker in lockingPositionService
        await lockingPositionService.connect(treasuryDao).toggleContractLocker(mockCvgUtilities);

        await (await cvgControlTower.connect(users.treasuryDao).setCvgUtilities(mockCvgUtilities)).wait();
        await createUsdcBond(contracts);

        // approve users DAI spending from swapper factory
        await dai.connect(user10).approve(swapperFactory, MAX_INTEGER);
        await dai.connect(user11).approve(swapperFactory, MAX_INTEGER);
    });

    it("initializes locking contract should revert", async () => {
        await lockingPositionDelegate.initialize(cvgControlTower).should.be.revertedWith("Initializable: contract is already initialized");
        await lockingPositionManager.initialize(cvgControlTower).should.be.revertedWith("Initializable: contract is already initialized");
        await lockingPositionService.initialize(cvgControlTower).should.be.revertedWith("Initializable: contract is already initialized");
    });

    it("Enables source token (DAI)", async () => {
        await swapperFactory.connect(treasuryDao).toggleSourceToken(dai);
        expect(await swapperFactory.srcTokenAllowed(dai)).to.be.true;
    });
    it("Swaps DAI to mint locking position (47 cycles)", async () => {
        const amountToSwap = ethers.parseEther("300");
        const data = await ApiHelper.getOneInchDataForSwap(
            await dai.getAddress(),
            await usdc.getAddress(),
            amountToSwap.toString(),
            await swapperFactory.getAddress(),
            slippage.toString(),
            await mockCvgUtilities.getAddress()
        );

        // ACTUAL CVG CYCLE = 1
        const ysPercentage = 30;
        await mockCvgUtilities.connect(user10).swapTokenBondAndLock(usdcBondContract, 0, 0, 0, 47, 0, ysPercentage, data, user1);

        const lockingPosition = await lockingPositionService.lockingPositions(1);
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
            await mockCvgUtilities.getAddress()
        );

        // ACTUAL CVG CYCLE = 1
        await mockCvgUtilities.connect(user10).swapTokenBondAndLock(usdcBondContract, 0, 1, 0, 0, 0, 0, data, user1).should.be.revertedWith("TOKEN_NOT_OWNED");
    });
    it("Swaps DAI to increase locking position time and amount fails with token not owned", async () => {
        const amountToSwap = ethers.parseEther("500");
        const data = await ApiHelper.getOneInchDataForSwap(
            await dai.getAddress(),
            await usdc.getAddress(),
            amountToSwap.toString(),
            await swapperFactory.getAddress(),
            slippage.toString(),
            await mockCvgUtilities.getAddress()
        );

        // ACTUAL CVG CYCLE = 1
        await mockCvgUtilities.connect(user10).swapTokenBondAndLock(usdcBondContract, 0, 1, 0, 0, 12, 0, data, user1).should.be.revertedWith("TOKEN_NOT_OWNED");
    });
});
