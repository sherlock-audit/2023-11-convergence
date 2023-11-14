import chai from "chai";
import chaiAsPromised from "chai-as-promised";

chai.use(chaiAsPromised).should();
const expect = chai.expect;

import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {deploySdtStakingFixture} from "../../fixtures/fixtures";
import {Cvg} from "../../../typechain-types/contracts/Token";
import {Signer} from "ethers";
import {IContracts, IContractsUser, IUsers} from "../../../utils/contractInterface";
import {ethers} from "hardhat";
import {CvgControlTower} from "../../../typechain-types";

describe("Cvg Token Tests", () => {
    let treasuryDao: Signer;

    let owner: Signer;
    let cvgContract: Cvg, cvgControlTower: CvgControlTower;
    let contractsUsers: IContractsUser, contracts: IContracts, users: IUsers;

    before(async () => {
        contractsUsers = await loadFixture(deploySdtStakingFixture);
        contracts = contractsUsers.contracts;
        users = contractsUsers.users;

        cvgControlTower = contracts.base.cvgControlTower;

        const tokens = contracts.tokens;
        cvgContract = tokens.cvg;
        owner = users.owner;
        treasuryDao = users.treasuryDao;
    });
    it("Success: burn cvg token", async () => {
        const supplyBefore = await cvgContract.totalSupply();
        const amount = ethers.parseEther("1");
        const tx = cvgContract.burn(amount);
        await expect(tx).to.changeTokenBalances(cvgContract, [owner], [-amount]);
        expect(await cvgContract.totalSupply()).to.be.equal(supplyBefore - amount);
    });
    it("Fail: mint cvg token with random user", async () => {
        await cvgContract.mintBond(owner, 1n).should.be.revertedWith("NOT_BOND");
        await cvgContract.mintStaking(owner, 1n).should.be.revertedWith("NOT_STAKING");
    });
    it("Success: add owner as an staking/bond minter", async () => {
        await cvgControlTower.connect(treasuryDao).setCloneFactory(owner);
        await cvgControlTower.connect(treasuryDao).setNewVersionBaseBond(owner);
        await cvgControlTower.insertNewBond(owner, 1);
        await cvgControlTower.insertNewSdtStaking(owner);
    });
    it("Success: mint cvg token more than max authorized", async () => {
        const MAX_BOND = await cvgContract.MAX_BOND();
        const MAX_STAKING = await cvgContract.MAX_STAKING();
        await cvgContract.mintBond(owner, MAX_BOND + 1n).should.be.revertedWith("MAX_SUPPLY_BOND");
        await cvgContract.mintStaking(owner, MAX_STAKING + 1n).should.be.revertedWith("MAX_SUPPLY_STAKING");
    });
});
