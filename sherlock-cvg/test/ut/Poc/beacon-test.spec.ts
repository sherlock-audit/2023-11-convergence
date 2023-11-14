import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import {Signer} from "ethers";
import {ethers} from "hardhat";
import {BeaconProxy, TestProxy, TestProxyV2, UpgradeableBeacon} from "../../../typechain-types";
import {configureAccounts} from "../../fixtures/testContext";
chai.use(chaiAsPromised).should();
const expect = chai.expect;

describe("Beacon tests", () => {
    let owner: Signer, user1: Signer, user2: Signer;

    let upgradeableBeacon: UpgradeableBeacon;

    let testProxyImplementation: TestProxy;
    let testProxyImplementationV2: TestProxyV2;

    let firstBeaconProxy: BeaconProxy;
    let firstContractV1: TestProxy;
    let firstContractV2: TestProxyV2;
    let secondBeaconProxy: BeaconProxy;
    let secondContractV1: TestProxy;
    let secondContractV2: TestProxyV2;

    before(async () => {
        let users = await configureAccounts();
        owner = users.owner;
        user1 = users.user1;
        user2 = users.user2;

        // implementation
        testProxyImplementation = await ethers.deployContract("TestProxy", []);
        await testProxyImplementation.waitForDeployment();

        // implementation V2
        testProxyImplementationV2 = await ethers.deployContract("TestProxyV2", []);
        await testProxyImplementationV2.waitForDeployment();

        //beacon
        upgradeableBeacon = await ethers.deployContract("UpgradeableBeacon", [await testProxyImplementation.getAddress(), await owner.getAddress()]);
        await upgradeableBeacon.waitForDeployment();

        //deploy proxys
        firstBeaconProxy = await ethers.deployContract("BeaconProxy", [await upgradeableBeacon.getAddress(), "0x"]);
        await firstBeaconProxy.waitForDeployment();

        secondBeaconProxy = await ethers.deployContract("BeaconProxy", [await upgradeableBeacon.getAddress(), "0x"]);
        await secondBeaconProxy.waitForDeployment();

        //interface proxys
        firstContractV1 = await ethers.getContractAt("TestProxy", await firstBeaconProxy.getAddress());
        secondContractV1 = await ethers.getContractAt("TestProxy", await secondBeaconProxy.getAddress());
    });
    it("test V1 function", async () => {
        await firstContractV1.valueOne();
        await secondContractV1.valueOne();
    });

    it("Upgrade to V2", async () => {
        await upgradeableBeacon.upgradeTo(await testProxyImplementationV2.getAddress());
        firstContractV2 = await ethers.getContractAt("TestProxyV2", await firstBeaconProxy.getAddress());
        secondContractV2 = await ethers.getContractAt("TestProxyV2", await secondBeaconProxy.getAddress());
    });

    it("test V2 function", async () => {
        console.log(await firstContractV2.valueTwo());
        console.log(await secondContractV2.valueTwo());
    });
});
