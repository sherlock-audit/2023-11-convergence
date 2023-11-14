import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {deployRewardsFixture} from "../../fixtures/fixtures";
import {ethers, upgrades} from "hardhat";
import {Signer, EventLog} from "ethers";
import {CloneFactory, CvgControlTower} from "../../../typechain-types/contracts";
import {BaseTest, cloneFactoryV2Sol} from "../../../typechain-types/contracts/mocks";
import {Mock_CloneFactoryV2} from "../../../typechain-types/contracts/mocks/CloneFactoryV2.sol";
import {ProxyAdmin} from "../../../typechain-types/contracts/Upgradeable/ProxyAdmin.sol";
import {IContracts, IUsers, IContractsUser} from "../../../utils/contractInterface";

chai.use(chaiAsPromised).should();
const expect = chai.expect;

describe("CloneFactory Proxy", () => {
    let treasuryDao: Signer;
    let controlTowerContract: CvgControlTower;
    let cloneFactoryContract: CloneFactory;
    let cloneFactoryContractV2: Mock_CloneFactoryV2;
    let baseTestContract: BaseTest;
    let testContract: any;
    let proxyAdmin: ProxyAdmin;
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

    it("Initialize base contract should be reverted", async () => {
        await baseTestContract.initialize(controlTowerContract).should.be.revertedWith("Initializable: contract is already initialized");
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
        cloneFactoryContractV2 = (await ethers.getContractAt("mock_CloneFactoryV2", await cloneFactoryContract.getAddress())) as unknown as Mock_CloneFactoryV2;

        (await cloneFactoryContractV2.cvgControlTower()).should.be.equal(await controlTowerContract.getAddress());
        (await cloneFactoryContractV2.owner()).should.be.equal(await treasuryDao.getAddress());
    });

    it("Test new function create test contract", async () => {
        const tx = await cloneFactoryContractV2.connect(treasuryDao).createBaseTest(baseTestContract);
        await expect(tx).to.emit(cloneFactoryContractV2, "TestCreated");

        const receipt = await tx.wait();
        const event = (receipt!.logs as EventLog[]).find((e) => e?.fragment?.name === "TestCreated");
        testContract = await ethers.getContractAt("BaseTest", event?.args.clone);

        const counter = await testContract.counter();
        expect(counter).to.be.equal(0);
    });

    it("Increment counter on test contract", async () => {
        await testContract.connect(treasuryDao).incrementCounter();
        const counter = await testContract.counter();
        expect(counter).to.be.equal(1);
    });
});
