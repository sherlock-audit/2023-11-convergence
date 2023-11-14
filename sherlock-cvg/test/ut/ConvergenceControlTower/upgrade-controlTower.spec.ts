import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {deployYsDistributorFixture, increaseCvgCycle} from "../../fixtures/fixtures";
import {ethers, upgrades} from "hardhat";
import {Signer} from "ethers";
import {CvgControlTower} from "../../../typechain-types/contracts";
import {ProxyAdmin} from "../../../typechain-types/contracts/Upgradeable/ProxyAdmin.sol";
import {IContracts, IUsers, IContractsUser} from "../../../utils/contractInterface";
import {Mock_CvgControlTowerV2, Mock_CvgControlTowerV3} from "../../../typechain-types";

chai.use(chaiAsPromised).should();

describe("CvgControlTower : Proxy", () => {
    let treasuryDao: Signer;
    let controlTowerContract: CvgControlTower;
    let controlTowerContractV2: Mock_CvgControlTowerV2;
    let controlTowerContractV3: Mock_CvgControlTowerV3;
    let proxyAdmin: ProxyAdmin;
    let contractsUsers: IContractsUser, contracts: IContracts, users: IUsers;

    before(async () => {
        contractsUsers = await loadFixture(deployYsDistributorFixture);
        contracts = contractsUsers.contracts;
        users = contractsUsers.users;

        treasuryDao = users.treasuryDao;
        proxyAdmin = contracts.base.proxyAdmin;
        controlTowerContract = contracts.base.cvgControlTower;
    });
    it("Increment cvg cycle", async function () {
        await increaseCvgCycle(contractsUsers, 1);
        (await controlTowerContract.cvgCycle()).should.be.equal(2);
    });
    it("Upgrade with a V2 implementation", async () => {
        //implementation
        const ControlTowerImplementation = await ethers.getContractFactory("CvgControlTower");
        const ControlTowerV2Implementation = await ethers.getContractFactory("mock_CvgControlTowerV2");
        await upgrades.validateUpgrade(ControlTowerImplementation, ControlTowerV2Implementation);

        const controlTowerV2Implementation = await ethers.deployContract("mock_CvgControlTowerV2", []);
        await controlTowerV2Implementation.waitForDeployment();

        //upgrade proxy
        await proxyAdmin.connect(treasuryDao).upgrade(controlTowerContract, controlTowerV2Implementation);
        controlTowerContractV2 = (await ethers.getContractAt("mock_CvgControlTowerV2", controlTowerContract)) as unknown as Mock_CvgControlTowerV2;
        (await controlTowerContractV2.cvgCycle()).should.be.equal(2);
        (await controlTowerContractV2.owner()).should.be.equal(await treasuryDao.getAddress());
    });
    it("Test new function controlTowerV2", async () => {
        await controlTowerContractV2.changeTestStorageV2(50);
        (await controlTowerContractV2.testStorageV2()).should.be.equal(50);
        (await controlTowerContractV2.testProxy()).should.be.equal(256);
    });
    it("Increment cvg cycle", async function () {
        await increaseCvgCycle(contractsUsers, 1);
        (await controlTowerContractV2.cvgCycle()).should.be.equal(3);
    });
    it("Upgrade with a V3 implementation", async () => {
        //implementation
        const ControlTowerV2Implementation = await ethers.getContractFactory("mock_CvgControlTowerV2");
        const ControlTowerV3Implementation = await ethers.getContractFactory("mock_CvgControlTowerV3");
        await upgrades.validateUpgrade(ControlTowerV2Implementation, ControlTowerV3Implementation);

        const controlTowerV3Implementation = await ethers.deployContract("mock_CvgControlTowerV3", []);
        await controlTowerV3Implementation.waitForDeployment();

        //upgrade proxy
        await proxyAdmin.connect(treasuryDao).upgrade(controlTowerContract, controlTowerV3Implementation);
        controlTowerContractV3 = (await ethers.getContractAt("mock_CvgControlTowerV3", controlTowerContract)) as unknown as Mock_CvgControlTowerV3;

        (await controlTowerContractV3.cvgCycle()).should.be.equal(3);
        (await controlTowerContractV3.owner()).should.be.equal(await treasuryDao.getAddress());
    });
    it("Test new function controlTowerV3", async () => {
        await controlTowerContractV3.connect(treasuryDao).incrementTestStorageV3();
    });
    it("Check values", async function () {
        (await controlTowerContractV3.owner()).should.be.equal(await treasuryDao.getAddress());
        (await controlTowerContractV3.testStorageV2()).should.be.equal(50);
        (await controlTowerContractV3.testStorageV3()).should.be.equal(1);
    });
});
