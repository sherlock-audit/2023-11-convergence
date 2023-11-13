import chai from "chai";
import {MAX_INTEGER, zeroAddress} from "@nomicfoundation/ethereumjs-util";

import chaiAsPromised from "chai-as-promised";
import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {deployYsDistributorFixture, increaseCvgCycle} from "../../fixtures/fixtures";
import {ethers} from "hardhat";
import {Signer} from "ethers";
import {CvgControlTower} from "../../../typechain-types/contracts";
import {LockingPositionManager, LockingPositionService, LockingPositionDelegate, LockingLogo} from "../../../typechain-types/contracts/Locking";
import {YsDistributor} from "../../../typechain-types/contracts/Rewards";
import {Cvg} from "../../../typechain-types/contracts/Token";
import {PositionLocker} from "../../../typechain-types/contracts/mocks";
import {IContractsUser, IContracts, IUsers} from "../../../utils/contractInterface";
import {LOCKING_POSITIONS} from "./config/lockingTestConfig";
import {ERC20} from "../../../typechain-types/@openzeppelin/contracts/token/ERC20";
import {render_svg} from "../../../utils/svg/render_svg";

chai.use(chaiAsPromised).should();
const expect = chai.expect;

const PATH = "./test/ut/Locking/logo/";

describe("LockingPositionManager Locking Logo test", () => {
    let lockingPositionManagerContract: LockingPositionManager,
        lockingPositionServiceContract: LockingPositionService,
        lockingPositionDelegateContract: LockingPositionDelegate,
        cvgContract: Cvg,
        controlTowerContract: CvgControlTower,
        positionLocker: PositionLocker,
        lockingLogo: LockingLogo,
        ysdistributor: YsDistributor;
    let contractUsers: IContractsUser, contracts: IContracts, users: IUsers;
    let owner: Signer, user1: Signer, user2: Signer, user10: Signer, treasuryDao: Signer;
    let tokens;
    let crv: ERC20, weth: ERC20, cvx: ERC20;

    before(async () => {
        contractUsers = await loadFixture(deployYsDistributorFixture);
        contracts = contractUsers.contracts;
        users = contractUsers.users;

        lockingPositionServiceContract = contracts.locking.lockingPositionService;
        lockingPositionManagerContract = contracts.locking.lockingPositionManager;
        lockingPositionDelegateContract = contracts.locking.lockingPositionDelegate;
        ysdistributor = contracts.rewards.ysDistributor;
        cvgContract = contracts.tokens.cvg;
        controlTowerContract = contracts.base.cvgControlTower;
        lockingLogo = contracts.locking.lockingLogo;
        treasuryDao = users.treasuryDao;
        user1 = users.user1;
        user2 = users.user2;
        user10 = users.user10;
        tokens = contracts.tokens;
        weth = tokens.weth;
        crv = tokens.crv;
        cvx = tokens.cvx;

        await (await weth.transfer(users.treasuryBonds, ethers.parseEther("100000"))).wait();
        await (await crv.transfer(users.treasuryBonds, ethers.parseEther("100000"))).wait();
        await (await cvx.transfer(users.treasuryBonds, ethers.parseEther("100000"))).wait();

        await (await cvgContract.transfer(user1, ethers.parseEther("100000"))).wait();
        await (await cvgContract.transfer(user2, ethers.parseEther("100000"))).wait();

        // approve treasurybonds tokens spending
        await cvx.connect(users.treasuryBonds).approve(ysdistributor, MAX_INTEGER);
        await crv.connect(users.treasuryBonds).approve(ysdistributor, MAX_INTEGER);
        await weth.connect(users.treasuryBonds).approve(ysdistributor, MAX_INTEGER);
        const cvxAmount = ethers.parseEther("5");
        const crvAmount = ethers.parseEther("10");
        const wethAmount = ethers.parseEther("15");

        const depositStruct: YsDistributor.TokenAmountStruct[] = [
            {token: cvx, amount: cvxAmount},
            {token: crv, amount: crvAmount},
            {token: weth, amount: wethAmount},
        ];

        await ysdistributor.connect(users.treasuryBonds).depositMultipleToken(depositStruct);
    });
    it("Fail addTokenAtMint", async () => {
        await lockingPositionDelegateContract.addTokenAtMint(1, user1).should.be.revertedWith("NOT_LOCKING_SERVICE");
    });
    it("Fail mint", async () => {
        await lockingPositionManagerContract.mint(user1).should.be.revertedWith("NOT_LOCKING_SERVICE");
    });
    it("Fail burn", async () => {
        await lockingPositionManagerContract.burn(1).should.be.revertedWith("NOT_LOCKING_SERVICE");
    });

    it("increase staking cycle to 5", async () => {
        await increaseCvgCycle(contractUsers, LOCKING_POSITIONS[0].lockCycle - 1);

        const actualCycle = await controlTowerContract.cvgCycle();
        expect(actualCycle).to.be.eq(LOCKING_POSITIONS[0].lockCycle);
    });

    it("mint position 1 at cycle 5", async () => {
        await (await cvgContract.connect(user1).approve(lockingPositionServiceContract, LOCKING_POSITIONS[0].cvgAmount)).wait();

        await (
            await lockingPositionServiceContract.connect(user1).mintPosition(LOCKING_POSITIONS[0].duration, LOCKING_POSITIONS[0].cvgAmount, 0, user1, true)
        ).wait();
    });
    it("mint position 2 at cycle 9", async () => {
        await increaseCvgCycle(contractUsers, LOCKING_POSITIONS[1].lockCycle - LOCKING_POSITIONS[0].lockCycle);

        await (await cvgContract.connect(user1).approve(lockingPositionServiceContract, LOCKING_POSITIONS[1].cvgAmount)).wait();
        await (
            await lockingPositionServiceContract.connect(user1).mintPosition(LOCKING_POSITIONS[1].duration, LOCKING_POSITIONS[1].cvgAmount, 30, user1, true)
        ).wait();
    });
    it("mint position 3 at cycle 12", async () => {
        await increaseCvgCycle(contractUsers, LOCKING_POSITIONS[2].lockCycle - LOCKING_POSITIONS[1].lockCycle);

        await (await cvgContract.connect(user1).approve(lockingPositionServiceContract, LOCKING_POSITIONS[2].cvgAmount)).wait();
        await (
            await lockingPositionServiceContract.connect(user1).mintPosition(LOCKING_POSITIONS[2].duration, LOCKING_POSITIONS[2].cvgAmount, 30, user1, true)
        ).wait();
    });
    it("remove locking logo to controlTower", async () => {
        await controlTowerContract.connect(treasuryDao).setLockingLogo(zeroAddress());
    });
    it("tokenURI for tokenId 1 should compute empty string if no baseURI/Logo is set", async () => {
        const tokenURI = await lockingPositionManagerContract.tokenURI(1);
        expect(tokenURI).to.be.equal("");
    });
    it("set base URI with random user should revert", async () => {
        await lockingPositionManagerContract.setBaseURI("ipfs://test/").should.be.revertedWith("Ownable: caller is not the owner");
    });
    it("set base URI should compute offchain tokenURI for tokenId 1", async () => {
        await lockingPositionManagerContract.connect(treasuryDao).setBaseURI("ipfs://test/");
        const tokenURI = await lockingPositionManagerContract.tokenURI(1);
        expect(tokenURI).to.be.equal("ipfs://test/1");
    });
    it("add locking logo to controlTower", async () => {
        await controlTowerContract.connect(treasuryDao).setLockingLogo(lockingLogo);
    });
    it("Check getLogoInfo", async () => {
        await lockingLogo.getLogoInfo(1);
    });
    it("Check tokenURI for locking position 1", async () => {
        await increaseCvgCycle(contractUsers, 10);

        const blockNumBefore = await ethers.provider.getBlockNumber();
        const blockBefore = await ethers.provider.getBlock(blockNumBefore);
        const timestampBefore = blockBefore!.timestamp;
        const oneDayTimestamp = 86400;
        const oneHourTimestamp = 3600;

        await lockingPositionManagerContract.connect(user1).setLock(1, timestampBefore + oneDayTimestamp);
        await lockingPositionManagerContract.connect(user1).setLock(2, timestampBefore + oneHourTimestamp);
        render_svg(await lockingPositionManagerContract.tokenURI(1), "1", PATH);
        render_svg(await lockingPositionManagerContract.tokenURI(2), "2", PATH);
        render_svg(await lockingPositionManagerContract.tokenURI(3), "3", PATH);
    });
    it("Check getLogoInfo", async () => {
        await lockingLogo.getLogoInfo(1);
        await lockingLogo.getLogoInfo(2);
    });
});
