import {expect} from "chai";
import {ApiHelper} from "../../../utils/ApiHelper";
import {MAX_INTEGER} from "@nomicfoundation/ethereumjs-util";
import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {deployBondFixture} from "../../fixtures/fixtures";
import {time} from "@nomicfoundation/hardhat-network-helpers";
import {manipulateCurveDuoLp} from "../../../utils/swapper/curve-duo-manipulator";
import {Signer, EventLog} from "ethers";
import {ERC20} from "../../../typechain-types/@openzeppelin/contracts/token/ERC20";
import {CloneFactory, CvgControlTower} from "../../../typechain-types/contracts";
import {Cvg} from "../../../typechain-types/contracts/Token";
import {BondDepository} from "../../../typechain-types/contracts/Bond";
import {ICrvPool} from "../../../typechain-types/contracts/interfaces/ICrvPool.sol";
import {ethers} from "hardhat";
import {CvgUtilities, SwapperFactory} from "../../../typechain-types";
import {AGGREGATIONROUTERV5} from "../../../resources/oneInch";
import {TOKEN_ADDR_WETH} from "../../../resources/tokens/common";
const slippage = 10;

describe("Bond factory test", () => {
    let owner: Signer, treasuryBonds: Signer, treasuryDao: Signer, user1: Signer;
    let dai: ERC20,
        crv: ERC20,
        wETH: ERC20,
        fxs: ERC20,
        usdc: ERC20,
        usdt: ERC20,
        controlTowerContract: CvgControlTower,
        cloneFactoryContract: CloneFactory,
        cvgContract: Cvg,
        baseBondContract: BondDepository;
    let daiBondContract: BondDepository, wETHBondContract: BondDepository, fxsBondContract: BondDepository, crvBondContract: BondDepository;
    let cvgPoolContract: ICrvPool;
    let prices: any;
    let swapperFactory: SwapperFactory, cvgUtilities: CvgUtilities;

    before(async () => {
        const {contracts, users} = await loadFixture(deployBondFixture);

        prices = await ApiHelper.getDefiLlamaTokenPrices([TOKEN_ADDR_WETH]);
        const tokens = contracts.tokens;
        owner = users.owner;
        user1 = users.user1;
        treasuryBonds = users.treasuryBonds;
        treasuryDao = users.treasuryDao;
        controlTowerContract = contracts.base.cvgControlTower;
        swapperFactory = contracts.base.swapperFactory;
        cvgUtilities = contracts.base.cvgUtilities;
        dai = tokens.dai;
        wETH = tokens.weth;
        crv = tokens.crv;
        fxs = tokens.fxs;
        usdc = tokens.usdc;
        usdt = tokens.usdt;
        baseBondContract = contracts.bonds.baseBond;
        cvgContract = tokens.cvg;
        cloneFactoryContract = contracts.base.cloneFactory;

        cvgPoolContract = contracts.lp.poolCvgFraxBp;
    });

    it("Success : Should create bond Stable", async () => {
        const tx1 = await cloneFactoryContract.connect(treasuryDao).createBond(
            {
                bondDuration: 86400 * 70,
                maxCvgToMint: ethers.parseEther("1000000"),
                minRoi: 5_000,
                maxRoi: 65_000,
                composedFunction: 0,
                vestingTerm: 432_000,
                token: dai,
                percentageMaxCvgToMint: 150,
                gamma: 250_000,
                scale: 5_000,
            },
            1
        );
        const receipt1 = await tx1.wait();
        const logs = receipt1?.logs as EventLog[];
        const events1 = logs.filter((e) => e.fragment.name === "BondCreated");

        expect(events1).is.not.empty;

        daiBondContract = await ethers.getContractAt("BondDepository", events1[0].args[1]);
        const daiBondContractOwner = await daiBondContract.owner();
        const daiBondParam = await daiBondContract.bondParams();

        expect(await daiBondContract.getAddress()).is.not.empty;
        expect(daiBondContractOwner).to.equal(await treasuryDao.getAddress());

        expect(daiBondParam.composedFunction).to.be.equal(0);
    });

    it("Should create bond not stable", async () => {
        const tx2 = await cloneFactoryContract.connect(treasuryDao).createBond(
            {
                bondDuration: 86400 * 70,
                maxCvgToMint: ethers.parseEther("1000000"),
                minRoi: 5_000,
                maxRoi: 65_000,
                composedFunction: "0",
                vestingTerm: 7_600,
                token: wETH,
                percentageMaxCvgToMint: 150, // 15% of the total of the bond
                gamma: 250_000,
                scale: 5_000,
            },
            1
        );
        const receipt2 = await tx2.wait();
        const logs = receipt2?.logs as EventLog[];
        const events2 = logs.filter((e) => e.fragment.name === "BondCreated");
        expect(events2).is.not.empty;

        wETHBondContract = await ethers.getContractAt("BondDepository", events2[0].args[1]);
        expect(await wETHBondContract.getAddress()).is.not.empty;
        const wETHBondContractOwner = await wETHBondContract.owner();
        expect(wETHBondContractOwner).to.equal(await treasuryDao.getAddress());
    });

    it("Should create a bond not stable with a price below 1$", async () => {
        const tx = await cloneFactoryContract.connect(treasuryDao).createBond(
            {
                maxCvgToMint: ethers.parseEther("1000000"),
                bondDuration: 86400 * 70,
                minRoi: 5_000,
                maxRoi: 65_000,
                composedFunction: "0",
                vestingTerm: 7_600,
                token: fxs,
                percentageMaxCvgToMint: 200,
                gamma: 250_000,
                scale: 5_000,
            },
            1
        );
        const receipt = await tx.wait();
        const logs = receipt?.logs as EventLog[];
        const events = logs.filter((e) => e.fragment.name === "BondCreated");
        expect(events).is.not.empty;

        fxsBondContract = await ethers.getContractAt("BondDepository", events[0].args[1]);
        expect(await fxsBondContract.getAddress()).is.not.empty;
        expect(await fxsBondContract.owner()).to.equal(await treasuryDao.getAddress());
    });

    it("Should create a bond not stable on CRV", async () => {
        const tx = await cloneFactoryContract.connect(treasuryDao).createBond(
            {
                bondDuration: 86400 * 70,
                maxCvgToMint: ethers.parseEther("1000000"),
                minRoi: 5_000,
                maxRoi: 65_000,
                composedFunction: "0",
                vestingTerm: 7_600,
                token: crv,
                percentageMaxCvgToMint: 150,
                gamma: 250_000,
                scale: 5_000,
            },
            1
        );
        const receipt = await tx.wait();
        const logs = receipt?.logs as EventLog[];
        const events = logs.filter((e) => e.fragment.name === "BondCreated");
        expect(events).is.not.empty;

        crvBondContract = await ethers.getContractAt("BondDepository", events[0].args[1]);
        expect(await crvBondContract.getAddress()).is.not.empty;
        expect(await crvBondContract.owner()).to.equal(await treasuryDao.getAddress());
    });

    it("Should not let someone change the initialization parameters", async () => {
        await expect(
            daiBondContract.initialize(controlTowerContract, {
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
            })
        ).to.be.revertedWith("Initializable: contract is already initialized");
    });

    it("Should not let someone initialize the base contract", async () => {
        await expect(
            baseBondContract.initialize(controlTowerContract, {
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
            })
        ).to.be.revertedWith("Initializable: contract is already initialized");
    });
    it("Deposit in bond DAI with amount 0 should revert", async () => {
        await daiBondContract.deposit(0, 0, owner).should.be.revertedWith("LTE");
    });
    let totalCvgToken1: bigint;
    it("Should deposit in bond DAI, update balance and send to the treasury", async () => {
        const daiDeposited = ethers.parseEther("40000");
        await (await dai.approve(daiBondContract, MAX_INTEGER)).wait();
        const receipt = await (await daiBondContract.deposit(0, daiDeposited, owner)).wait();
        const logs = receipt?.logs as EventLog[];
        const [depositEvent] = logs.filter((e) => e?.fragment?.name === "BondDeposit") as EventLog[];
        expect(depositEvent.args.amountDeposited).to.be.equal(daiDeposited);
        expect(depositEvent.args.amountDepositedUsd).to.be.equal(daiDeposited);

        const bondPending = await daiBondContract.bondInfos(1);
        totalCvgToken1 = bondPending.payout;
        expect(bondPending.payout).to.be.eq("129638632312429103872954"); // 129,638 tokens
        expect(await dai.balanceOf(await treasuryBonds.getAddress())).to.be.eq(daiDeposited);
    });

    it("Should deposit in bond ETH, update balance and send to the treasury ", async () => {
        const ethToPay = 5;
        const ethPrice = prices[TOKEN_ADDR_WETH].price;
        // ROI = ROI MAX
        const cvgPriceExpected = 0.33 - 0.33 * 0.065;
        const dollarValueDeposited = ethPrice * ethToPay;
        const cvgMintedExpected = dollarValueDeposited / cvgPriceExpected;
        await (await wETH.approve(wETHBondContract, MAX_INTEGER)).wait();

        await (await wETHBondContract.deposit(0, ethers.parseEther(ethToPay.toString()), owner)).wait();
        const bondPending = await wETHBondContract.bondInfos(2);
        expect(Number(ethers.formatEther(bondPending.payout))).to.be.within(cvgMintedExpected * 0.95, cvgMintedExpected * 1.05);

        expect(await wETH.balanceOf(treasuryBonds)).to.be.eq(ethers.parseEther(ethToPay.toString()));
    });

    it("Should redeem the CVG minted", async () => {
        let balanceUserBeforeRedeem = await cvgContract.balanceOf(owner);

        await time.increase(0.5 * 86400);
        let percentVested = await daiBondContract.percentVestedFor(1);
        expect(percentVested).to.be.eq("1000"); // 10 %
        let pendingPayout = await daiBondContract.pendingPayoutFor(1);
        expect(pendingPayout).to.be.eq((totalCvgToken1 * percentVested) / 10_000n); // 12.96k tokens => 10% of vesting

        await expect(daiBondContract.redeem(1, owner, owner)).to.changeTokenBalances(cvgContract, [owner, daiBondContract], [pendingPayout, -pendingPayout]);

        await time.increase(5 * 86400);
        percentVested = await daiBondContract.percentVestedFor(1);
        expect(percentVested).to.be.eq("10000"); // 100 %

        pendingPayout = await daiBondContract.pendingPayoutFor(1);
        expect(pendingPayout).to.be.eq(totalCvgToken1 - (totalCvgToken1 * 1_000n) / 10_000n); // 116k tokens => 90% of vesting

        await expect(daiBondContract.redeem(1, owner, owner)).to.changeTokenBalances(cvgContract, [owner, daiBondContract], [pendingPayout, -pendingPayout]);

        expect((await cvgContract.balanceOf(owner)) - balanceUserBeforeRedeem).to.be.eq(totalCvgToken1); // Verify that we claim all
    });

    it("Test view function", async () => {
        const bonds = await controlTowerContract.getBondContractsPerVersion(1, 0, 2);
        const bondDai = bonds[0];
        expect(bondDai.token.token).to.be.eq("DAI");
        expect(bondDai.token.decimals).to.be.eq("18");
        expect(bondDai.totalCvgMinted).to.be.eq("129638632312429103872954");
        expect(bondDai.maxCvgToMint).to.be.eq("1000000000000000000000000");
        expect(bondDai.vestingTerm).to.be.eq(432000);
        expect(bondDai.bondRoi).to.be.eq(65000);
        expect(bondDai.isFlexible).to.be.eq(false);

        const bondsEth = bonds[1];
        expect(bondsEth.token.token).to.be.eq("WETH");
        expect(bondsEth.token.decimals).to.be.eq("18");
        expect(bondsEth.maxCvgToMint).to.be.eq("1000000000000000000000000");
        expect(bondsEth.vestingTerm).to.be.eq(7600);
        expect(bondsEth.bondRoi).to.be.eq(65000);
        expect(bondsEth.isFlexible).to.be.eq(false);
    });

    // it("Test limit case pagination function", async () => {
    //     const bondsDai = await controlTowerContract.getBondContractsPerVersion(1, 0, 1);
    //     expect(bondsDai[0].token.token).to.be.eq("DAI");

    //     const bondsEth = await controlTowerContract.getBondContractsPerVersion(1, 1, 3);
    //     expect(bondsEth[0].token.token).to.be.eq("WETH");
    // });

    it("Tries to set new composed function on DAI bond with invalid value", async () => {
        await expect(daiBondContract.connect(treasuryDao).setComposedFunction(4)).to.be.revertedWith("INVALID_COMPOSED_FUNCTION");
    });

    it("Set composed function to logarithm (1) on DAI bond", async () => {
        await daiBondContract.connect(treasuryDao).setComposedFunction(1);

        const bondParams = await daiBondContract.bondParams();
        expect(bondParams.composedFunction).to.be.equal(1);
    });

    it("Pauses and unpauses bond deposit", async () => {
        await daiBondContract.connect(treasuryDao).pause();
        expect(await daiBondContract.paused()).to.be.true;

        await daiBondContract.connect(treasuryDao).unpause();
        expect(await daiBondContract.paused()).to.be.false;
    });

    it("Checks onlyOwner modifier", async () => {
        // set composed function
        await expect(daiBondContract.connect(user1).setComposedFunction(1)).to.be.revertedWith("Ownable: caller is not the owner");

        // pause
        await expect(daiBondContract.connect(user1).pause()).to.be.revertedWith("Ownable: caller is not the owner");

        // unpause
        await expect(daiBondContract.connect(user1).unpause()).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Fail: Checks whenNotPaused modifier on deposit", async () => {
        await daiBondContract.connect(treasuryDao).pause();
        await expect(daiBondContract.deposit(1, ethers.parseEther("50000"), owner)).to.be.revertedWith("Pausable: paused");
        await daiBondContract.connect(treasuryDao).unpause();
    });
    it("Fail: Checks whenNotPaused modifier on depositToLock", async () => {
        await daiBondContract.connect(treasuryDao).pause();
        await expect(daiBondContract.depositToLock(100, user1)).to.be.revertedWith("Pausable: paused");
        await daiBondContract.connect(treasuryDao).unpause();
    });
    it("Fail: depositToLock with other user than cvgUtilities", async () => {
        await expect(daiBondContract.depositToLock(100, user1)).to.be.revertedWith("NOT_CVG_UTILITIES");
    });
    it("Fail: depositToLock with other user than cvgUtilities", async () => {
        await controlTowerContract.connect(treasuryDao).setCvgUtilities(owner);
        await expect(daiBondContract.depositToLock(0, user1)).to.be.revertedWith("LTE");
        await controlTowerContract.connect(treasuryDao).setCvgUtilities(cvgUtilities);
    });

    it("Tries to deposit with amount above maximum deposit", async () => {
        await expect(daiBondContract.deposit(1, ethers.parseEther("58500"), owner)).to.be.revertedWith("MAX_CVG_PER_BOND");
    });
    it("Fail: depositToLock with amount above maximum deposit", async () => {
        const amountDeposit = ethers.parseEther("58500");
        await dai.approve(cvgUtilities, amountDeposit);

        const amountToSwap = ethers.parseEther("250");
        const data = await ApiHelper.getOneInchDataForSwap(
            await dai.getAddress(),
            await usdc.getAddress(),
            amountToSwap.toString(),
            await swapperFactory.getAddress(),
            slippage.toString(),
            await cvgUtilities.getAddress()
        );
        data.executor = ethers.ZeroAddress;

        // ACTUAL CVG CYCLE = 41
        await cvgUtilities.swapTokenBondAndLock(daiBondContract, 0, 1, amountDeposit, 0, 0, 0, data).should.be.revertedWith("MAX_CVG_PER_BOND");
    });

    it("Tries to deposit with amount above maximum cvg to mint", async () => {
        // maxCvgToMint = 1 000 000
        await daiBondContract.deposit(1, ethers.parseEther("40000"), owner);
        await daiBondContract.deposit(0, ethers.parseEther("40000"), owner);
        await daiBondContract.deposit(1, ethers.parseEther("40000"), owner);
        await daiBondContract.deposit(0, ethers.parseEther("40000"), owner);
        await daiBondContract.deposit(0, ethers.parseEther("40000"), owner);
        await daiBondContract.deposit(0, ethers.parseEther("40000"), owner);

        await expect(daiBondContract.deposit(0, ethers.parseEther("40000"), owner)).to.be.revertedWith("MAX_CVG_ALREADY_MINTED");
    });
    it("Fail: depositToLock with amount above maximum deposit", async () => {
        const amountDeposit = ethers.parseEther("40000");
        await dai.approve(cvgUtilities, amountDeposit);

        const amountToSwap = ethers.parseEther("250");
        const data = await ApiHelper.getOneInchDataForSwap(
            await dai.getAddress(),
            await usdc.getAddress(),
            amountToSwap.toString(),
            await swapperFactory.getAddress(),
            slippage.toString(),
            await cvgUtilities.getAddress()
        );
        data.executor = ethers.ZeroAddress;

        // ACTUAL CVG CYCLE = 41
        await cvgUtilities.swapTokenBondAndLock(daiBondContract, 0, 1, amountDeposit, 0, 0, 0, data).should.be.revertedWith("MAX_CVG_ALREADY_MINTED");
    });

    it("Tries to deposit with invalid CVG price", async () => {
        // manipulate Liquidity
        await manipulateCurveDuoLp(await cvgPoolContract.getAddress(), [{type: "swap", direction: [1, 0], amountIn: 50_000}], owner);

        await expect(daiBondContract.deposit(1, ethers.parseEther("1000"), owner)).to.be.revertedWith("LIMIT_TOO_HIGH");

        // reset to initial value
        await manipulateCurveDuoLp(
            await cvgPoolContract.getAddress(),
            [
                {type: "swap", direction: [0, 1], amountIn: 25_000},
                {type: "swap", direction: [0, 1], amountIn: 1},
            ],
            owner
        );

        await expect(daiBondContract.deposit(1, ethers.parseEther("1000"), owner)).to.be.revertedWith("LIMIT_TOO_LOW");
    });

    it("Time travels and tries to deposit after bond ended", async () => {
        await time.increase(70 * 86400);

        await expect(daiBondContract.deposit(1, ethers.parseEther("1000"), owner)).to.be.revertedWith("BOND_INACTIVE");
    });
    it("Enables source token (DAI)", async () => {
        await swapperFactory.connect(treasuryDao).toggleSourceToken(dai);
        expect(await swapperFactory.srcTokenAllowed(dai)).to.be.true;
        expect(await dai.allowance(swapperFactory, AGGREGATIONROUTERV5)).to.be.equal(ethers.MaxUint256);
    });
    it("Fail: depositToLock after bond ended", async () => {
        await dai.approve(cvgUtilities, ethers.parseEther("1000"));

        const amountToSwap = ethers.parseEther("250");
        const data = await ApiHelper.getOneInchDataForSwap(
            await dai.getAddress(),
            await usdc.getAddress(),
            amountToSwap.toString(),
            await swapperFactory.getAddress(),
            slippage.toString(),
            await cvgUtilities.getAddress()
        );
        data.executor = ethers.ZeroAddress;

        // ACTUAL CVG CYCLE = 41
        await cvgUtilities.swapTokenBondAndLock(daiBondContract, 0, 1, ethers.parseEther("1000"), 0, 0, 0, data).should.be.revertedWith("BOND_INACTIVE");
    });
    it("set composed function daiBondContract contract ", async () => {
        await daiBondContract.connect(treasuryDao).setComposedFunction(2);
    });

    it("Success: set setPercentageMaxCvgToMint in base contract ", async () => {
        await daiBondContract.connect(treasuryDao).setPercentageMaxCvgToMint(2);
    });

    it("Fail: set setPercentageMaxCvgToMint in base contract with invalid percentage", async () => {
        await expect(daiBondContract.connect(treasuryDao).setPercentageMaxCvgToMint(100)).to.be.revertedWith("INVALID_PERCENTAGE_MAX");
    });

    it("Fail: set setPercentageMaxCvgToMint in base contract ", async () => {
        await expect(daiBondContract.setPercentageMaxCvgToMint(2)).to.be.revertedWith("Ownable: caller is not the owner");
    });
});
