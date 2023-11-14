import chai from "chai";
import chaiAsPromised from "chai-as-promised";

chai.use(chaiAsPromised).should();
const expect = chai.expect;

import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {deployYsDistributorFixture, increaseCvgCycle} from "../../fixtures/fixtures";
import {SwapperFactory} from "../../../typechain-types/contracts/utils";
import {Cvg} from "../../../typechain-types/contracts/Token";
import {Signer, EventLog, MaxUint256, ZeroAddress} from "ethers";
import {ERC20} from "../../../typechain-types/@openzeppelin/contracts/token/ERC20";
import {LockingPositionService} from "../../../typechain-types/contracts/Locking";
import {IContracts, IContractsUser, IUsers} from "../../../utils/contractInterface";
import {YsDistributor} from "../../../typechain-types/contracts/Rewards";
import {ethers} from "hardhat";
import {TOKEN_1, TOKEN_2, TOKEN_3} from "../../../resources/constant";

describe("YsDistributor Deposit/Claim Multiple Tokens Tests", () => {
    let ysdistributor: YsDistributor, treasuryBonds: Signer, treasuryDao: Signer;
    let dai: ERC20, weth: ERC20, crv: ERC20, usdc: ERC20, sdt: ERC20;
    let owner: Signer, user1: Signer, user2: Signer;
    let lockingPositionServiceContract: LockingPositionService, cvgContract: Cvg, swapperFactory: SwapperFactory;
    let contractsUsers: IContractsUser, contracts: IContracts, users: IUsers;

    before(async () => {
        contractsUsers = await loadFixture(deployYsDistributorFixture);
        contracts = contractsUsers.contracts;
        users = contractsUsers.users;
        lockingPositionServiceContract = contracts.locking.lockingPositionService;
        swapperFactory = contracts.base.swapperFactory;

        const tokens = contracts.tokens;
        cvgContract = tokens.cvg;
        dai = tokens.dai;
        weth = tokens.weth;
        crv = tokens.crv;
        usdc = tokens.usdc;
        sdt = tokens.sdt;

        owner = users.owner;
        user1 = users.user1;
        user2 = users.user2;
        treasuryBonds = users.treasuryBonds;
        treasuryDao = users.treasuryDao;
        ysdistributor = contracts.rewards.ysDistributor;

        // approve treasurybonds tokens spending
        await crv.connect(treasuryBonds).approve(ysdistributor, MaxUint256);
        await weth.connect(treasuryBonds).approve(ysdistributor, MaxUint256);
        await usdc.connect(treasuryBonds).approve(ysdistributor, MaxUint256);
        await sdt.connect(treasuryBonds).approve(ysdistributor, MaxUint256);

        await (await cvgContract.transfer(user1, ethers.parseEther("100000"))).wait();
        await (await cvgContract.transfer(user2, ethers.parseEther("100000"))).wait();
    });
    it("initialize ysDistributor should revert", async () => {
        await ysdistributor.initialize(user1).should.be.revertedWith("Initializable: contract is already initialized");
    });

    it("mint position user1 at cycle 1", async () => {
        const amountCvgUser1 = ethers.parseEther("75");
        await (await cvgContract.connect(user1).approve(lockingPositionServiceContract, amountCvgUser1)).wait();
        await (await lockingPositionServiceContract.connect(user1).mintPosition(23, amountCvgUser1, 100, user1, true)).wait(); // Lock 75 CVG for 43 cycles

        const totalSupplyYsCvg = await lockingPositionServiceContract.totalSupplyYsCvg();
        expect(totalSupplyYsCvg).to.be.eq(0);

        const token1Position = await lockingPositionServiceContract.lockingPositions(1);
        expect(token1Position.startCycle).to.be.eq(1);
        expect(token1Position.lastEndCycle).to.be.eq(24);
        expect(token1Position.totalCvgLocked).to.be.eq(amountCvgUser1);
        expect(await ysdistributor.getAllTokenRewardsForTde([1], 1)).to.be.empty;
        expect(await ysdistributor.getAllTokenRewardsForTde([2], 1)).to.be.empty;
        expect(await ysdistributor.getAllTokenRewardsForTde([3], 1)).to.be.empty;
        expect(await ysdistributor.getAllTokenRewardsForTde([4], 1)).to.be.empty;
    });

    it("mint position user2 at cycle 1", async () => {
        const amountCvgUser2 = ethers.parseEther("25");
        await (await cvgContract.connect(user2).approve(lockingPositionServiceContract, amountCvgUser2)).wait();
        await (await lockingPositionServiceContract.connect(user2).mintPosition(23, amountCvgUser2, 100, user2, true)).wait(); // Lock 25 CVG for 43 cycles
        const token2Position = await lockingPositionServiceContract.lockingPositions(2);

        expect(token2Position.startCycle).to.be.eq(1);
        expect(token2Position.lastEndCycle).to.be.eq(24);
        expect(token2Position.totalCvgLocked).to.be.eq(amountCvgUser2);
    });

    it("mint position user2 at cycle 1", async () => {
        const amountCvgUser2 = ethers.parseEther("25");
        await (await cvgContract.connect(user2).approve(lockingPositionServiceContract, amountCvgUser2)).wait();
        await (await lockingPositionServiceContract.connect(user2).mintPosition(23, amountCvgUser2, 0, user2, true)).wait(); // Lock 25 CVG for 43 cycles
        const token2Position = await lockingPositionServiceContract.lockingPositions(3);

        expect(token2Position.startCycle).to.be.eq(1);
        expect(token2Position.lastEndCycle).to.be.eq(24);
        expect(token2Position.totalCvgLocked).to.be.eq(amountCvgUser2);
        expect(await ysdistributor.getAllTokenRewardsForTde([1], TOKEN_3)).to.be.empty;
        expect(await ysdistributor.getAllTokenRewardsForTde([2], TOKEN_3)).to.be.empty;
        expect(await ysdistributor.getAllTokenRewardsForTde([3], TOKEN_3)).to.be.empty;
        expect(await ysdistributor.getAllTokenRewardsForTde([4], TOKEN_3)).to.be.empty;
    });

    it("Deposit multiple tokens for TDE1 at cycle1 should compute right infos", async () => {
        const sdtAmount = ethers.parseEther("5");
        const crvAmount = ethers.parseEther("10");
        const wethAmount = ethers.parseEther("15");
        const usdcAmount = ethers.parseUnits("5000", 6);

        await sdt.connect(users.user7).transfer(treasuryBonds, ethers.parseUnits("10000", 18));
        await crv.connect(users.user7).transfer(treasuryBonds, ethers.parseUnits("10000", 18));
        await weth.connect(users.user7).transfer(treasuryBonds, ethers.parseUnits("10000", 18));
        await usdc.connect(users.user7).transfer(treasuryBonds, ethers.parseUnits("10000", 6));

        const depositStruct: YsDistributor.TokenAmountStruct[] = [
            {token: sdt, amount: sdtAmount},
            {token: crv, amount: crvAmount},
            {token: weth, amount: wethAmount},
            {token: usdc, amount: usdcAmount},
        ];
        await ysdistributor.connect(treasuryBonds).depositMultipleToken(depositStruct);

        expect(await ysdistributor.depositedTokenAmountForTde(1, sdt)).to.be.equal(sdtAmount);
        expect(await ysdistributor.depositedTokenAmountForTde(1, crv)).to.be.equal(crvAmount);
        expect(await ysdistributor.depositedTokenAmountForTde(1, weth)).to.be.equal(wethAmount);
        expect(await ysdistributor.depositedTokenAmountForTde(1, usdc)).to.be.equal(usdcAmount);

        expect(await sdt.balanceOf(ysdistributor)).to.be.equal(sdtAmount);
        expect(await crv.balanceOf(ysdistributor)).to.be.equal(crvAmount);
        expect(await weth.balanceOf(ysdistributor)).to.be.equal(wethAmount);
        expect(await usdc.balanceOf(ysdistributor)).to.be.equal(usdcAmount);
    });

    it("Success : Get rewards on a token before cycle TDE cycle", async () => {
        const allRewards = await ysdistributor.getAllTokenRewardsForTde([1], TOKEN_1);
        expect(allRewards).to.be.eql([]);
    });

    it("Increase to cycle 12 (TDE 0)", async () => {
        await increaseCvgCycle(contractsUsers, 11);
    });

    it("Success : Get rewards on the TDE cycle returns still nothing", async () => {
        const allRewards = await ysdistributor.getAllTokenRewardsForTde([1, 2], TOKEN_1);
        expect(allRewards).to.be.eql([]);
    });

    //81655
    it("Deposit multiple tokens for TDE1 at cycle12 should compute right infos", async () => {
        const sdtAmount = ethers.parseEther("10");
        const crvAmount = ethers.parseEther("5");
        const wethAmount = ethers.parseEther("15");
        const usdcAmount = ethers.parseUnits("5000", 6);

        const sdtCrvTotalAmount = ethers.parseEther("15");
        const wethTotalAmount = ethers.parseEther("30");
        const usdcTotalAmount = ethers.parseUnits("10000", 6);

        const depositStruct: YsDistributor.TokenAmountStruct[] = [
            {token: sdt, amount: sdtAmount},
            {token: crv, amount: crvAmount},
            {token: weth, amount: wethAmount},
            {token: usdc, amount: usdcAmount},
        ];
        await ysdistributor.connect(treasuryBonds).depositMultipleToken(depositStruct);

        expect(await ysdistributor.depositedTokenAmountForTde(1, sdt)).to.be.equal(sdtCrvTotalAmount);
        expect(await ysdistributor.depositedTokenAmountForTde(1, crv)).to.be.equal(sdtCrvTotalAmount);
        expect(await ysdistributor.depositedTokenAmountForTde(1, weth)).to.be.equal(wethTotalAmount);
        expect(await ysdistributor.depositedTokenAmountForTde(1, usdc)).to.be.equal(usdcTotalAmount);
        expect(await sdt.balanceOf(ysdistributor)).to.be.equal(sdtCrvTotalAmount);
        expect(await crv.balanceOf(ysdistributor)).to.be.equal(sdtCrvTotalAmount);
        expect(await weth.balanceOf(ysdistributor)).to.be.equal(wethTotalAmount);
        expect(await usdc.balanceOf(ysdistributor)).to.be.equal(usdcTotalAmount);
    });

    it("Increase to cycle 13 (TDE 1)", async () => {
        await increaseCvgCycle(contractsUsers, 1);
    });

    it("Success : Get rewards with batched view function", async () => {
        const allRewards = await ysdistributor.getAllTokenRewardsForTde([1, 2], TOKEN_1);
        expect(allRewards.length).to.be.eq(1);
        expect(allRewards[0].tdeCycle).to.be.eq(1);

        expect(ethers.getAddress(allRewards[0].tokenAmounts[0].token)).to.be.eq(await sdt.getAddress());
        expect(allRewards[0].tokenAmounts[0].amount).to.be.eq("11250000000000000000");

        expect(ethers.getAddress(allRewards[0].tokenAmounts[1].token)).to.be.eq(await crv.getAddress());
        expect(allRewards[0].tokenAmounts[1].amount).to.be.eq("11250000000000000000");

        expect(ethers.getAddress(allRewards[0].tokenAmounts[2].token)).to.be.eq(await weth.getAddress());
        expect(allRewards[0].tokenAmounts[2].amount).to.be.eq("22500000000000000000");

        expect(ethers.getAddress(allRewards[0].tokenAmounts[3].token)).to.be.eq(await usdc.getAddress());
        expect(allRewards[0].tokenAmounts[3].amount).to.be.eq("7500000000");
    });

    //81655
    it("Deposit multiple tokens for TDE2 at cycle13 should compute right infos", async () => {
        const sdtAmount = ethers.parseEther("5");
        const crvAmount = ethers.parseEther("10");

        const sdtTotalAmount = ethers.parseEther("20");
        const crvTotalAmount = ethers.parseEther("25");

        const depositStruct: YsDistributor.TokenAmountStruct[] = [
            {token: sdt, amount: sdtAmount},
            {token: crv, amount: crvAmount},
        ];
        await ysdistributor.connect(treasuryBonds).depositMultipleToken(depositStruct);

        expect(await ysdistributor.depositedTokenAmountForTde(2, sdt)).to.be.equal(sdtAmount);
        expect(await ysdistributor.depositedTokenAmountForTde(2, crv)).to.be.equal(crvAmount);
        expect(await sdt.balanceOf(ysdistributor)).to.be.equal(sdtTotalAmount);
        expect(await crv.balanceOf(ysdistributor)).to.be.equal(crvTotalAmount);
    });

    it("User1 Claim tokens at TDE1", async () => {
        const amountSdt = await lockingPositionServiceContract.getTokenRewardAmount(TOKEN_1, 1, sdt);
        const amountCrv = await lockingPositionServiceContract.getTokenRewardAmount(TOKEN_1, 1, crv);
        const amountWeth = await lockingPositionServiceContract.getTokenRewardAmount(TOKEN_1, 1, weth);
        const amountUsdc = await lockingPositionServiceContract.getTokenRewardAmount(TOKEN_1, 1, usdc);
        const sdtBalance = await sdt.balanceOf(user1);
        const crvBalance = await crv.balanceOf(user1);
        const wethBalance = await weth.balanceOf(user1);
        const usdcBalance = await usdc.balanceOf(user1);

        const tx = await ysdistributor.connect(user1).claimRewards(TOKEN_1, 1, user1, ZeroAddress);
        const receipt = await tx.wait();
        const logs = receipt?.logs as EventLog[];
        const events = logs.filter((e) => e?.fragment?.name === "TokensClaim");
        const share1 = events[0].args.share;

        const usdcAmount = ethers.parseUnits("10000", 6);
        const totalAmount = ethers.parseEther("15");
        const wethAmount = ethers.parseEther("30");

        let denominator = ethers.parseUnits("1", 20);
        let calc = (totalAmount * share1) / denominator;
        let calc_weth = (wethAmount * share1) / denominator;
        let calc_usdc = (usdcAmount * share1) / denominator;

        expect(await sdt.balanceOf(user1)).to.be.equal(calc + sdtBalance);
        expect(await crv.balanceOf(user1)).to.be.equal(calc + crvBalance);
        expect(await weth.balanceOf(user1)).to.be.equal(calc_weth + wethBalance);
        expect(await usdc.balanceOf(user1)).to.be.equal(calc_usdc + usdcBalance);
        expect(amountSdt).to.be.equal(calc);
        expect(amountCrv).to.be.equal(calc);
        expect(amountWeth).to.be.equal(calc_weth);
        expect(amountUsdc).to.be.equal(calc_usdc);
    });

    it("Success : Get all token rewards should remove already claimed cycle", async () => {
        const allRewards = await ysdistributor.getAllTokenRewardsForTde([1, 2], TOKEN_1);
        expect(allRewards.length).to.be.eq(0);
    });

    it("User2 Claim tokens at TDE1", async () => {
        const amountSdt = await lockingPositionServiceContract.getTokenRewardAmount(TOKEN_2, 1, sdt);
        const amountCrv = await lockingPositionServiceContract.getTokenRewardAmount(TOKEN_2, 1, crv);
        const amountWeth = await lockingPositionServiceContract.getTokenRewardAmount(TOKEN_2, 1, weth);
        const sdtBalance = await sdt.balanceOf(user2);
        const crvBalance = await crv.balanceOf(user2);
        const wethBalance = await weth.balanceOf(user2);
        const tx = await ysdistributor.connect(user2).claimRewards(TOKEN_2, 1, user2, ZeroAddress);
        const receipt = await tx.wait();
        const logs = receipt?.logs as EventLog[];

        const events = logs.filter((e) => e?.fragment?.name === "TokensClaim");
        const share2 = events[0].args.share;

        const totalAmount = ethers.parseEther("15");
        const wethAmount = ethers.parseEther("30");

        let denominator = ethers.parseUnits("1", 20);
        let calc = (totalAmount * share2) / denominator;
        let calc_weth = (wethAmount * share2) / denominator;

        expect(await sdt.balanceOf(user2)).to.be.equal(calc + sdtBalance);
        expect(await crv.balanceOf(user2)).to.be.equal(calc + crvBalance);
        expect(await weth.balanceOf(user2)).to.be.equal(calc_weth + wethBalance);
        expect(amountSdt).to.be.equal(calc);
        expect(amountCrv).to.be.equal(calc);
        expect(amountWeth).to.be.equal(calc_weth);
    });

    it("Increase to cycle 24 (TDE 1)", async () => {
        await increaseCvgCycle(contractsUsers, 11);
    });

    it("Deposit multiple tokens for TDE2 at cycle24 should compute right infos", async () => {
        const sdtAmount = ethers.parseEther("10");
        const crvAmount = ethers.parseEther("5");
        const totalAmount = ethers.parseEther("15");

        const depositStruct: YsDistributor.TokenAmountStruct[] = [
            {token: sdt, amount: sdtAmount},
            {token: crv, amount: crvAmount},
        ];
        await ysdistributor.connect(treasuryBonds).depositMultipleToken(depositStruct);

        expect(await ysdistributor.depositedTokenAmountForTde(2, sdt)).to.be.equal(totalAmount);
        expect(await ysdistributor.depositedTokenAmountForTde(2, crv)).to.be.equal(totalAmount);
    });

    it("Success : Get all token rewards should remove already claimed cycle", async () => {
        const allRewards1 = await ysdistributor.getAllTokenRewardsForTde([1, 2], TOKEN_1);
        expect(allRewards1.length).to.be.eq(0);

        const allRewards2 = await ysdistributor.getAllTokenRewardsForTde([1, 2], TOKEN_2);
        expect(allRewards2.length).to.be.eq(0);
    });

    it("Success : Verify that getTokensDepositedAtTde returns good values ", async () => {
        const depositedTokens = await ysdistributor.getTokensDepositedAtTde(1);
        expect(depositedTokens.map((token) => ethers.getAddress(token))).to.be.eql([
            await sdt.getAddress(),
            await crv.getAddress(),
            await weth.getAddress(),
            await usdc.getAddress(),
        ]);
    });

    it("Increase to cycle 25 (TDE 2)", async () => {
        await increaseCvgCycle(contractsUsers, 1);
    });

    it("Success : Get all token rewards should display only the cycle available to claim and not empty", async () => {
        const allRewards1 = await ysdistributor.getAllTokenRewardsForTde([1, 2], TOKEN_1);
        expect(allRewards1.length).to.be.eq(1);
        expect(allRewards1[0].tdeCycle).to.be.eq(2);
        const allRewards2 = await ysdistributor.getAllTokenRewardsForTde([1, 2], TOKEN_1);
        expect(allRewards2[0].tdeCycle).to.be.eq(2);
    });

    it("User1 Claim tokens at TDE2", async () => {
        const amountSdt = await lockingPositionServiceContract.getTokenRewardAmount(TOKEN_1, 2, sdt);
        const amountCrv = await lockingPositionServiceContract.getTokenRewardAmount(TOKEN_1, 2, crv);
        const sdtBalance = await sdt.balanceOf(user1);
        const crvBalance = await crv.balanceOf(user1);

        const tx = await ysdistributor.connect(user1).claimRewards(TOKEN_1, 2, user1, ZeroAddress);
        const receipt = await tx.wait();
        const logs = receipt?.logs as EventLog[];
        const events = logs.filter((e) => e?.fragment?.name === "TokensClaim");

        const share1 = events[0].args.share;
        const totalAmount = ethers.parseEther("15");
        let denominator = ethers.parseUnits("1", 20);
        let calc = (totalAmount * share1) / denominator;

        expect(await sdt.balanceOf(user1)).to.be.equal(sdtBalance + calc);
        expect(await crv.balanceOf(user1)).to.be.equal(crvBalance + calc);
        expect(amountSdt).to.be.equal(calc);
        expect(amountCrv).to.be.equal(calc);
    });

    it("Success : Get all token rewards ", async () => {
        const allRewards1 = await ysdistributor.getAllTokenRewardsForTde([1, 2], TOKEN_1);
        expect(allRewards1.length).to.be.eq(0);
        const allRewards2 = await ysdistributor.getAllTokenRewardsForTde([1, 2], TOKEN_2);
        expect(allRewards2[0].tdeCycle).to.be.eq(2);
    });

    it("User2 Claim tokens at TDE2", async () => {
        const amountSdt = await lockingPositionServiceContract.getTokenRewardAmount(TOKEN_2, 2, sdt);
        const amountCrv = await lockingPositionServiceContract.getTokenRewardAmount(TOKEN_2, 2, crv);

        const sdtBalance = await sdt.balanceOf(user2);
        const crvBalance = await crv.balanceOf(user2);

        const tx = await ysdistributor.connect(user2).claimRewards(TOKEN_2, 2, user2, ZeroAddress);
        const receipt = await tx.wait();
        const logs = receipt?.logs as EventLog[];
        const events = logs.filter((e) => e?.fragment?.name === "TokensClaim");
        const share2 = events[0].args.share;
        const totalAmount = ethers.parseEther("15");
        const denominator = ethers.parseUnits("1", 20);
        const calc = (totalAmount * share2) / denominator;

        expect(await sdt.balanceOf(user2)).to.be.equal(sdtBalance + calc);
        expect(await crv.balanceOf(user2)).to.be.equal(crvBalance + calc);
        expect(amountSdt).to.be.equal(calc);
        expect(amountCrv).to.be.equal(calc);
    });

    // //////////////////////////REVERTED//////////////////////////<<
    it("if one deposit transfer failed, all tx is reverted", async () => {
        const crvAmount = ethers.parseEther("200000");
        const totalAmount = ethers.parseEther("15");

        const depositStruct: YsDistributor.TokenAmountStruct[] = [
            {token: usdc, amount: crvAmount},
            {token: weth, amount: crvAmount},
        ];
        await ysdistributor.connect(treasuryBonds).depositMultipleToken(depositStruct).should.be.revertedWith("ERC20: transfer amount exceeds balance");

        expect(await ysdistributor.depositedTokenAmountForTde(2, sdt)).to.be.equal(totalAmount);
        expect(await ysdistributor.depositedTokenAmountForTde(2, crv)).to.be.equal(totalAmount);
    });

    it("Deposit is called by another wallet should be reverted", async () => {
        const sdtAmount = ethers.parseEther("10");
        const crvAmount = ethers.parseEther("100");

        const depositStruct: YsDistributor.TokenAmountStruct[] = [
            {token: sdt, amount: sdtAmount},
            {token: crv, amount: crvAmount},
        ];
        await ysdistributor.connect(owner).depositMultipleToken(depositStruct).should.be.revertedWith("NOT_TREASURY_BONDS");
    });
});
