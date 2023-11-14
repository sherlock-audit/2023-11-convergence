import chai from "chai";
import {MAX_INTEGER} from "@nomicfoundation/ethereumjs-util";

import chaiAsPromised from "chai-as-promised";
import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {deployYsDistributorFixture, increaseCvgCycle} from "../../fixtures/fixtures";
import {time} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import {Signer, EventLog} from "ethers";
import {ethers} from "hardhat";
import {ERC20} from "../../../typechain-types/@openzeppelin/contracts/token/ERC20";
import {CloneFactory} from "../../../typechain-types/contracts";
import {BondDepository} from "../../../typechain-types/contracts/Bond";
import {CvgUtilities, SwapperFactory} from "../../../typechain-types/contracts/utils";
import {IContracts, IContractsUser, IUsers} from "../../../utils/contractInterface";
import {Cvg, LockingPositionService, YsDistributor} from "../../../typechain-types";

chai.use(chaiAsPromised).should();
const expect = chai.expect;

describe("CvgUtilities - test Multiclaiming Locking", () => {
    let ysdistributor: YsDistributor, treasuryBonds: Signer, treasuryDao: Signer;
    let dai: ERC20, weth: ERC20, crv: ERC20, usdc: ERC20, sdt: ERC20;
    let owner: Signer, user1: Signer, user2: Signer;
    let lockingPositionServiceContract: LockingPositionService, cvgContract: Cvg, swapperFactory: SwapperFactory;
    let contractsUsers: IContractsUser, contracts: IContracts, users: IUsers;
    let cvgUtilities: CvgUtilities;
    before(async () => {
        contractsUsers = await loadFixture(deployYsDistributorFixture);
        contracts = contractsUsers.contracts;
        users = contractsUsers.users;
        lockingPositionServiceContract = contracts.locking.lockingPositionService;
        swapperFactory = contracts.base.swapperFactory;
        cvgUtilities = contracts.base.cvgUtilities;

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
        await crv.connect(treasuryBonds).approve(ysdistributor, MAX_INTEGER);
        await weth.connect(treasuryBonds).approve(ysdistributor, MAX_INTEGER);
        await usdc.connect(treasuryBonds).approve(ysdistributor, MAX_INTEGER);
        await sdt.connect(treasuryBonds).approve(ysdistributor, MAX_INTEGER);

        await (await cvgContract.transfer(user1, ethers.parseEther("100000"))).wait();
        await (await cvgContract.transfer(user2, ethers.parseEther("100000"))).wait();
    });
    it("mint position user1 at cycle 1", async () => {
        const amount = ethers.parseEther("75");
        await (await cvgContract.connect(user1).approve(lockingPositionServiceContract, amount)).wait();
        await (await lockingPositionServiceContract.connect(user1).mintPosition(23, amount, 100, user1, true)).wait(); // Lock 75 CVG for 43 cycles

        const totalSupplyYsCvg = await lockingPositionServiceContract.totalSupplyYsCvg();
        expect(totalSupplyYsCvg).to.be.eq(0);

        const token1Position = await lockingPositionServiceContract.lockingPositions(1);
        expect(token1Position.startCycle).to.be.eq(1);
        expect(token1Position.lastEndCycle).to.be.eq(24);
        expect(token1Position.totalCvgLocked).to.be.eq(amount);
    });
    it("mint position user1 at cycle 1", async () => {
        const amount = ethers.parseEther("25");
        await (await cvgContract.connect(user1).approve(lockingPositionServiceContract, amount)).wait();
        await (await lockingPositionServiceContract.connect(user1).mintPosition(23, amount, 100, user1, true)).wait(); // Lock 25 CVG for 43 cycles
        const token2Position = await lockingPositionServiceContract.lockingPositions(2);

        expect(token2Position.startCycle).to.be.eq(1);
        expect(token2Position.lastEndCycle).to.be.eq(24);
        expect(token2Position.totalCvgLocked).to.be.eq(amount);
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
    it("Increase to cycle 13 (TDE 1)", async () => {
        await increaseCvgCycle(contractsUsers, 12);
    });
    it("Success: Claim several tokens at TDE1", async () => {
        await cvgUtilities.connect(user1).claimMultipleLocking([
            {tokenId: 1, tdeIds: [1n]},
            {tokenId: 2, tdeIds: [1n]},
        ]);
    });
});
