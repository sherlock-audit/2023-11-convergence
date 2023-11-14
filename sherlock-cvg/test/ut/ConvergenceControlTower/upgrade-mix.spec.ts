import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {deployRewardsFixture, increaseCvgCycle} from "../../fixtures/fixtures";
import {ethers, upgrades} from "hardhat";
import {Signer} from "ethers";
import {CvgControlTower, CloneFactory} from "../../../typechain-types/contracts";
import {ProxyAdmin} from "../../../typechain-types/contracts/Upgradeable/ProxyAdmin.sol";
import {IContracts, IUsers, IContractsUser} from "../../../utils/contractInterface";
import {Mock_CloneFactoryV2, Mock_CvgControlTowerV2} from "../../../typechain-types";

chai.use(chaiAsPromised).should();
const expect = chai.expect;

describe("Upgradeable mix contracts", () => {
    let treasuryDao: Signer;
    let controlTowerContract: CvgControlTower;
    let cloneFactoryContract: CloneFactory;
    let cloneFactoryContractV2: Mock_CloneFactoryV2;
    let controlTowerContractV2: Mock_CvgControlTowerV2;
    let proxyAdmin: ProxyAdmin;
    let baseTestContract: any;
    let contractsUsers: IContractsUser, contracts: IContracts, users: IUsers;

    before(async () => {
        contractsUsers = await loadFixture(deployRewardsFixture);
        contracts = contractsUsers.contracts;
        users = contractsUsers.users;

        baseTestContract = await ethers.deployContract("BaseTest", []);
        await baseTestContract.waitForDeployment();

        treasuryDao = users.treasuryDao;
        proxyAdmin = contracts.base.proxyAdmin;
        controlTowerContract = contracts.base.cvgControlTower;
        cloneFactoryContract = contracts.base.cloneFactory;
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
    it("Upgrade with a V2 implementation", async () => {
        //implementation
        const CloneFactoryImplementation = await ethers.getContractFactory("CloneFactory");
        const CloneFactoryV2Implementation = await ethers.getContractFactory("mock_CloneFactoryV2");
        await upgrades.validateUpgrade(CloneFactoryImplementation, CloneFactoryV2Implementation);

        const cloneFactoryV2Implementation = await ethers.deployContract("mock_CloneFactoryV2", []);
        await cloneFactoryV2Implementation.waitForDeployment();

        //upgrade proxy
        await proxyAdmin.connect(treasuryDao).upgrade(cloneFactoryContract, cloneFactoryV2Implementation);
        cloneFactoryContractV2 = (await ethers.getContractAt("mock_CloneFactoryV2", cloneFactoryContract)) as unknown as Mock_CloneFactoryV2;
        (await cloneFactoryContractV2.cvgControlTower()).should.be.equal(await controlTowerContractV2.getAddress());
        (await cloneFactoryContractV2.owner()).should.be.equal(await treasuryDao.getAddress());
    });

    it("Update mapping in controlTower V2 via cloneFactory", async () => {
        const resultBefore = await controlTowerContractV2.testMapping(cloneFactoryContractV2);
        await cloneFactoryContractV2.connect(treasuryDao).changeMapping();
        const resultAfter = await controlTowerContractV2.testMapping(cloneFactoryContract);
        expect(resultBefore).to.be.false;
        expect(resultAfter).to.be.true;
    });
});
