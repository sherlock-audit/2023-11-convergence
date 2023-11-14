import chai from "chai";
import {MAX_INTEGER, zeroAddress} from "@nomicfoundation/ethereumjs-util";
import chaiAsPromised from "chai-as-promised";

chai.use(chaiAsPromised).should();
const expect = chai.expect;

import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {deploySdtStakingFixture, deployYsDistributorFixture, increaseCvgCycle} from "../../fixtures/fixtures";
import {SwapperFactory} from "../../../typechain-types/contracts/utils";
import {Cvg, CvgSDT} from "../../../typechain-types/contracts/Token";
import {Signer, EventLog} from "ethers";
import {ERC20} from "../../../typechain-types/@openzeppelin/contracts/token/ERC20";
import {LockingPositionService} from "../../../typechain-types/contracts/Locking";
import {IContracts, IContractsUser, IUsers} from "../../../utils/contractInterface";
import {YsDistributor} from "../../../typechain-types/contracts/Rewards";
import {ethers} from "hardhat";
import {ApiHelper} from "../../../utils/ApiHelper";
import {deployBase} from "../../fixtures/testContext";
import {CvgControlTower} from "../../../typechain-types";

describe("CvgSdt Token Tests", () => {
    let ysdistributor: YsDistributor, treasuryBonds: Signer, treasuryDao: Signer;
    let dai: ERC20, weth: ERC20, crv: ERC20, usdc: ERC20, sdt: ERC20;
    let owner: Signer, user1: Signer, user2: Signer;
    let lockingPositionServiceContract: LockingPositionService,
        cvgContract: Cvg,
        cvgSdt: CvgSDT,
        swapperFactory: SwapperFactory,
        cvgControlTower: CvgControlTower;
    let contractsUsers: IContractsUser, contracts: IContracts, users: IUsers;

    before(async () => {
        contractsUsers = await loadFixture(deploySdtStakingFixture);
        contracts = contractsUsers.contracts;
        users = contractsUsers.users;
        lockingPositionServiceContract = contracts.locking.lockingPositionService;
        swapperFactory = contracts.base.swapperFactory;
        cvgControlTower = contracts.base.cvgControlTower;

        const tokens = contracts.tokens;
        cvgContract = tokens.cvg;
        cvgSdt = tokens.cvgSdt;
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
    });
    it("Success: burn cvgSDT token", async () => {
        const amount = ethers.parseEther("1");
        await sdt.approve(cvgSdt, amount);
        await cvgSdt.mint(owner, amount);
        const supplyBefore = await cvgSdt.totalSupply();

        const tx = cvgSdt.burn(amount);
        await expect(tx).to.changeTokenBalances(cvgSdt, [owner], [-amount]);
        expect(await cvgSdt.totalSupply()).to.be.equal(supplyBefore - amount);
    });
});
