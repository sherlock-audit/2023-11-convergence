import {expect} from "chai";
import {MAX_INTEGER, zeroAddress} from "@nomicfoundation/ethereumjs-util";
import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {deployBondFixture} from "../../fixtures/fixtures";
import {time} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import {Signer} from "ethers";
import {ERC20} from "../../../typechain-types/@openzeppelin/contracts/token/ERC20";
import {BondDepository, BondLogo, BondPositionManager} from "../../../typechain-types/contracts/Bond";
import {CloneFactory, CvgControlTower} from "../../../typechain-types/contracts";
import {ethers} from "hardhat";
import {EventLog} from "ethers";
import {render_svg} from "../../../utils/svg/render_svg";

const path = "./test/ut/BondLogo/image/";

describe("Bond Logo test", () => {
    let owner: Signer, treasuryDao: Signer;
    let dai: ERC20, wETH: ERC20, cloneFactoryContract: CloneFactory, bondPositionManagerContract: BondPositionManager, controlTowerContract: CvgControlTower;
    let wETHBondContract: BondDepository;
    let tokens;
    let bondLogoContract: BondLogo;

    before(async () => {
        const {contracts, users} = await loadFixture(deployBondFixture);

        owner = users.owner;
        treasuryDao = users.treasuryDao;
        controlTowerContract = contracts.base.cvgControlTower;
        bondPositionManagerContract = contracts.bonds.bondPositionManager;
        bondLogoContract = contracts.bonds.bondLogo;

        tokens = contracts.tokens;

        dai = tokens.dai;
        wETH = tokens.weth;

        cloneFactoryContract = contracts.base.cloneFactory;
    });
    it("initialize bondPositionManagerContract should revert", async () => {
        await bondPositionManagerContract.initialize(owner).should.be.revertedWith("Initializable: contract is already initialized");
    });

    it("Success : Should create bond Stable", async () => {
        const tx1 = await cloneFactoryContract.connect(treasuryDao).createBond(
            {
                maxCvgToMint: ethers.parseEther("1000000"),
                minRoi: 5_000,
                maxRoi: 65_000,
                composedFunction: "0",
                vestingTerm: 432_000,
                token: dai,
                percentageMaxCvgToMint: 200,
                bondDuration: 43_200,
                gamma: 250_000,
                scale: 5_000,
            },
            1
        );
    });

    it("Success : Should create bond not stable", async () => {
        const tx2 = await cloneFactoryContract.connect(treasuryDao).createBond(
            {
                maxCvgToMint: ethers.parseEther("1000000"),
                minRoi: 5_000,
                maxRoi: 65_000,
                composedFunction: "0",
                vestingTerm: 864_000, //10 days
                token: wETH,
                percentageMaxCvgToMint: 200,
                gamma: 250_000,
                scale: 5_000,
                bondDuration: 43_200,
            },
            1
        );
        const receipt2 = await tx2.wait();
        const logs2 = receipt2?.logs as EventLog[];
        const events2 = logs2!.filter((e) => e.fragment.name === "BondCreated");
        expect(events2).is.not.empty;

        wETHBondContract = await ethers.getContractAt("BondDepository", events2[0].args[1]);
        expect(await wETHBondContract.getAddress()).is.not.empty;
        const wETHBondContractOwner = await wETHBondContract.owner();
        expect(wETHBondContractOwner).to.equal(await treasuryDao.getAddress());
    });

    it("Success : creating a bond on wETH", async () => {
        await (await wETH.approve(wETHBondContract, MAX_INTEGER)).wait();
        await wETHBondContract.deposit(0, ethers.parseEther("5"), owner);
    });
    it("tokenURI for tokenId 2 that is not minted should revert", async () => {
        await expect(bondPositionManagerContract.tokenURI(2)).to.be.revertedWith("ERC721: invalid token ID");
    });
    it("remove bond logo to controlTower", async () => {
        await controlTowerContract.connect(treasuryDao).setBondLogo(zeroAddress());
    });
    it("tokenURI for tokenId 1 should compute empty string if no baseURI/BondLogo is set", async () => {
        const tokenURI = await bondPositionManagerContract.tokenURI(1);
        expect(tokenURI).to.be.equal("");
    });
    it("set base URI with random user should be reverted", async () => {
        await bondPositionManagerContract.setBaseURI("ipfs://test/").should.be.revertedWith("Ownable: caller is not the owner");
    });
    it("set base URI should compute offchain tokenURI for tokenId 1", async () => {
        await bondPositionManagerContract.connect(treasuryDao).setBaseURI("ipfs://test/");
        const tokenURI = await bondPositionManagerContract.tokenURI(1);
        expect(tokenURI).to.be.equal("ipfs://test/1");
    });
    it("add bond logo to controlTower", async () => {
        await controlTowerContract.connect(treasuryDao).setBondLogo(bondLogoContract);
    });
    it("Check tokenURI for bondPosition at the begining of vesting", async () => {
        const blockNumBefore = await ethers.provider.getBlockNumber();
        const blockBefore = await ethers.provider.getBlock(blockNumBefore);
        const timestampBefore = blockBefore!.timestamp;
        const oneDayTimestamp = 86400;
        await bondPositionManagerContract.setLock(1, timestampBefore + oneDayTimestamp);
        const tokenURI = await bondPositionManagerContract.tokenURI(1);
        render_svg(tokenURI, "bond-begin", path);
    });
    it("Check tokenURI for bondPosition at the middle of the vesting", async () => {
        await time.increase(5 * 86400);
        const tokenURI = await bondPositionManagerContract.tokenURI(1);
        render_svg(tokenURI, "bond-middle", path);
    });

    it("Check tokenURI for bondPosition at the middle of the vesting after claim", async () => {
        await wETHBondContract.redeem(1, owner, owner);
        const tokenURI = await bondPositionManagerContract.tokenURI(1);
        render_svg(tokenURI, "bond-middle-claimed", path);
    });

    it("Check tokenURI for bondPosition at the end of the vesting", async () => {
        await time.increase(5 * 86400);
        const tokenURI = await bondPositionManagerContract.tokenURI(1);
        render_svg(tokenURI, "bond-end", path);
    });
    it("Check tokenURI for bondPosition at the end of the vesting after claim", async () => {
        await wETHBondContract.redeem(1, owner, owner);
        const tokenURI = await bondPositionManagerContract.tokenURI(1);
        render_svg(tokenURI, "bond-end-claimed", path);
    });

    it("Check tokenURI for bondPosition locked less than one hour ", async () => {
        const blockNumBefore = await ethers.provider.getBlockNumber();
        const blockBefore = await ethers.provider.getBlock(blockNumBefore);
        const timestampBefore = blockBefore!.timestamp;
        const oneHourTimestamp = 3600;
        await bondPositionManagerContract.setLock(1, timestampBefore + oneHourTimestamp);
        const tokenURI = await bondPositionManagerContract.tokenURI(1);
        render_svg(tokenURI, "bond-lock-one-hour", path);
        await bondLogoContract.getLogoInfo(1);
    });
});
