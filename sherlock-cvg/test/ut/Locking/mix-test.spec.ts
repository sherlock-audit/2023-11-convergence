import {expect} from "chai";
import {zeroAddress} from "@nomicfoundation/ethereumjs-util";

import fs from "fs";
import {loadFixture, time} from "@nomicfoundation/hardhat-network-helpers";
import {deployYsDistributorFixture} from "../../fixtures/fixtures";
import {ethers} from "hardhat";
import {increaseCvgCycleAndWriteForPlotting, plotTokenSuppliesMgCvg, plotTokenSuppliesYsCvg} from "../../../utils/charts/lockingChart";
import {LOCKING_POSITIONS} from "./config/lockingTestConfig";
import {LockingPositionManager, LockingPositionService} from "../../../typechain-types/contracts/Locking";
import {Cvg} from "../../../typechain-types/contracts/Token";
import {CvgControlTower} from "../../../typechain-types/contracts";
import {IContracts, IContractsUser, IUsers} from "../../../utils/contractInterface";
import {Signer} from "ethers";

// Usecase description
// - In cycle 5
//      - Create lock position for 43 cycle duration / to cycle 48 / with 200 Cvg / for 50% ysCvg & 50% veCvg
//      - Increase amount of token of 200 Cvg
//      - Increase time to cycle 60
// - In cycle 7
//      - Increase amount of token of 400 Cvg
// - In cycle 43
//      - Increase amount of token of 100 Cvg
// - In cycle 60
//      - Increase time to cycle 96 ( MAXIMUM for this NFT)
//      - Inrease amount of token of 200 Cvg

describe("LockingPositionManager / Mix usecases", () => {
    let lockingPositionManagerContract: LockingPositionManager,
        lockingPositionServiceContract: LockingPositionService,
        cvgContract: Cvg,
        controlTowerContract: CvgControlTower;
    let contractUsers: IContractsUser, contracts: IContracts, users: IUsers;
    let user1: Signer, user2: Signer;
    const pathTotalSupplies = "./utils/charts/totalSuppliesData.json";
    const pathTokenYsCvg = "./utils/charts/tokenSuppliesYsCvg.json";
    const pathTokenMgCvg = "./utils/charts/tokenSuppliesMgCvg.json";
    if (fs.existsSync(pathTotalSupplies)) {
        fs.unlinkSync(pathTotalSupplies);
    }
    if (fs.existsSync(pathTokenYsCvg)) {
        fs.unlinkSync(pathTokenYsCvg);
    }
    if (fs.existsSync(pathTokenMgCvg)) {
        fs.unlinkSync(pathTokenMgCvg);
    }

    before(async () => {
        contractUsers = await loadFixture(deployYsDistributorFixture);
        contracts = contractUsers.contracts;
        users = contractUsers.users;

        lockingPositionServiceContract = contracts.locking.lockingPositionService;
        lockingPositionManagerContract = contracts.locking.lockingPositionManager;
        cvgContract = contracts.tokens.cvg;
        controlTowerContract = contracts.base.cvgControlTower;
        user1 = users.user1;
        user2 = users.user2;

        await (await cvgContract.transfer(user1, ethers.parseEther("100000"))).wait();
        await (await cvgContract.transfer(user2, ethers.parseEther("100000"))).wait();
    });

    it("increase staking cycle to 5", async () => {
        await increaseCvgCycleAndWriteForPlotting({contracts, users}, 4);
        const actualCycle = await controlTowerContract.cvgCycle();
        expect(actualCycle).to.be.eq(LOCKING_POSITIONS[0].lockCycle);
    });

    it("CYCLE 5 - Check balances at invalid cycle id", async () => {
        const callFailYsCvg = lockingPositionServiceContract.balanceOfYsCvgAt(1, 0);
        await expect(callFailYsCvg).to.be.revertedWith("NOT_EXISTING_CYCLE");

        const callFailMgCvg = lockingPositionServiceContract.balanceOfMgCvgAt(1, 0);
        await expect(callFailMgCvg).to.be.revertedWith("NOT_EXISTING_CYCLE");

        const callFailTotalYsCvg = lockingPositionServiceContract.totalSupplyOfYsCvgAt(0);
        await expect(callFailTotalYsCvg).to.be.revertedWith("NOT_EXISTING_CYCLE");
    });

    it("CYCLE 5 - mint position 1 at cycle 5 for 43 cycles : 200 CVG", async () => {
        const balanceOfMgCvgBefore = await lockingPositionServiceContract.balanceOfMgCvg(1);
        expect(balanceOfMgCvgBefore).to.be.eq("0");

        let balanceOfMgCvgAt5 = await lockingPositionServiceContract.balanceOfMgCvgAt(1, 5);
        expect(balanceOfMgCvgAt5).to.be.eq("0");

        let balanceOfYsCvgAt5 = await lockingPositionServiceContract.balanceOfYsCvgAt(1, 5);
        expect(balanceOfYsCvgAt5).to.be.eq("0");

        let balanceOfYsCvgAt6 = await lockingPositionServiceContract.balanceOfYsCvgAt(1, 6);
        expect(balanceOfYsCvgAt6).to.be.eq("0");

        await (await cvgContract.connect(user1).approve(lockingPositionServiceContract, ethers.parseEther("200"))).wait();
        await (await lockingPositionServiceContract.connect(user1).mintPosition(43, ethers.parseEther("200"), 50, user1, true)).wait(); // Lock 100 CVG for 43 cycles

        // Check vote balances
        const balanceOfMgCvgAfter = await lockingPositionServiceContract.balanceOfMgCvg(1);
        expect(balanceOfMgCvgAfter).to.be.eq("44791666666666666666");

        balanceOfMgCvgAt5 = await lockingPositionServiceContract.balanceOfMgCvgAt(1, 5);
        expect(balanceOfMgCvgAt5).to.be.eq("44791666666666666666");

        const veCvgBalance = await lockingPositionServiceContract.balanceOfVeCvg(1);
        expect(veCvgBalance).to.be.closeTo("45543359719463365661", "5000000000000000000"); // 44.25 modulo 5

        // Check Ys balance of NFT 1
        balanceOfYsCvgAt6 = await lockingPositionServiceContract.balanceOfYsCvgAt(1, 6);
        expect(balanceOfYsCvgAt6).to.be.eq("26128472222222222221");

        const balanceOfYsCvgAt11 = await lockingPositionServiceContract.balanceOfYsCvgAt(1, 11);
        expect(balanceOfYsCvgAt11).to.be.eq("26128472222222222221");

        const balanceOfYsCvgAt12 = await lockingPositionServiceContract.balanceOfYsCvgAt(1, 12);
        expect(balanceOfYsCvgAt12).to.be.eq("26128472222222222221");

        const balanceOfYsCvgAt13 = await lockingPositionServiceContract.balanceOfYsCvgAt(1, 13);
        expect(balanceOfYsCvgAt13).to.be.eq("44791666666666666666");

        const balanceOfYsCvgAt48 = await lockingPositionServiceContract.balanceOfYsCvgAt(1, 48);
        expect(balanceOfYsCvgAt48).to.be.eq("44791666666666666666");

        const balanceOfYsCvgAt49 = await lockingPositionServiceContract.balanceOfYsCvgAt(1, 49);
        expect(balanceOfYsCvgAt49).to.be.eq("0");

        // Check YsTotalSupply
        const totalSupplyOfYsCvgAt6 = await lockingPositionServiceContract.totalSupplyOfYsCvgAt(6);
        expect(totalSupplyOfYsCvgAt6).to.be.eq("26128472222222222221");

        const totalSupplyOfYsCvgAt12 = await lockingPositionServiceContract.totalSupplyOfYsCvgAt(12);
        expect(totalSupplyOfYsCvgAt12).to.be.eq("26128472222222222221");

        const totalSupplyOfYsCvgAt13 = await lockingPositionServiceContract.totalSupplyOfYsCvgAt(13);
        expect(totalSupplyOfYsCvgAt13).to.be.eq("44791666666666666666");

        const totalSupplyOfYsCvgAt48 = await lockingPositionServiceContract.totalSupplyOfYsCvgAt(48);
        expect(totalSupplyOfYsCvgAt48).to.be.eq("44791666666666666666");

        const totalSupplyOfYsCvgAt49 = await lockingPositionServiceContract.totalSupplyOfYsCvgAt(49);
        expect(totalSupplyOfYsCvgAt49).to.be.eq("0");
    });

    it("CYCLE 5 - increase amount of token 1 of 200 CVG ", async () => {
        await (await cvgContract.connect(user1).approve(lockingPositionServiceContract, ethers.parseEther("200"))).wait();
        await (await lockingPositionServiceContract.connect(user1).increaseLockAmount(1, ethers.parseEther("200"), zeroAddress())).wait();

        const balanceOfMgCvg = await lockingPositionServiceContract.balanceOfMgCvg(1);
        expect(balanceOfMgCvg).to.be.eq("89583333333333333332");

        const balanceOfMgCvgAt5 = await lockingPositionServiceContract.balanceOfMgCvgAt(1, 5);
        expect(balanceOfMgCvgAt5).to.be.eq("89583333333333333332");

        const balanceOfMgCvgAt48 = await lockingPositionServiceContract.balanceOfMgCvgAt(1, 48);
        expect(balanceOfMgCvgAt48).to.be.eq("89583333333333333332");

        const balanceOfMgCvgAt49 = await lockingPositionServiceContract.balanceOfMgCvgAt(1, 49);
        expect(balanceOfMgCvgAt49).to.be.eq("0");

        const veCvgBalance = await lockingPositionServiceContract.balanceOfVeCvg(1);
        expect(veCvgBalance).to.be.closeTo("91083612351184227126", ethers.parseEther("5"));

        // YsCvg Supply

        const balanceOfYsCvgAt6 = await lockingPositionServiceContract.balanceOfYsCvgAt(1, 6);
        expect(balanceOfYsCvgAt6).to.be.eq("52256944444444444442");

        const balanceOfYsCvgAt12 = await lockingPositionServiceContract.balanceOfYsCvgAt(1, 12);
        expect(balanceOfYsCvgAt12).to.be.eq("52256944444444444442");

        const balanceOfYsCvgAt13 = await lockingPositionServiceContract.balanceOfYsCvgAt(1, 13);
        expect(balanceOfYsCvgAt13).to.be.eq("89583333333333333332");

        const balanceOfYsCvgAt48 = await lockingPositionServiceContract.balanceOfYsCvgAt(1, 48);
        expect(balanceOfYsCvgAt48).to.be.eq("89583333333333333332");

        const balanceOfYsCvgAt49 = await lockingPositionServiceContract.balanceOfYsCvgAt(1, 49);
        expect(balanceOfYsCvgAt49).to.be.eq("0");

        const totalSupplyOfYsCvgAt12 = await lockingPositionServiceContract.totalSupplyOfYsCvgAt(12);
        expect(totalSupplyOfYsCvgAt12).to.be.eq("52256944444444444442");

        const totalSupplyOfYsCvgAt13 = await lockingPositionServiceContract.totalSupplyOfYsCvgAt(13);
        expect(totalSupplyOfYsCvgAt13).to.be.eq("89583333333333333332");

        const totalSupplyOfYsCvgAt48 = await lockingPositionServiceContract.totalSupplyOfYsCvgAt(48);
        expect(totalSupplyOfYsCvgAt48).to.be.eq("89583333333333333332");

        const totalSupplyOfYsCvgAt49 = await lockingPositionServiceContract.totalSupplyOfYsCvgAt(49);
        expect(totalSupplyOfYsCvgAt49).to.be.eq("0");
    });

    it("CYCLE 5 - increase time of token 1 to 60 (+12 cycles)", async () => {
        await (await lockingPositionServiceContract.connect(user1).increaseLockTime(1, 12)).wait();

        // MgCvg

        const balanceOfMgCvg = await lockingPositionServiceContract.balanceOfMgCvg(1);
        expect(balanceOfMgCvg).to.be.eq("89583333333333333332");

        const balanceOfMgCvgAt5 = await lockingPositionServiceContract.balanceOfMgCvgAt(1, 5);
        expect(balanceOfMgCvgAt5).to.be.eq("89583333333333333332");

        const balanceOfMgCvgAt48 = await lockingPositionServiceContract.balanceOfMgCvgAt(1, 48);
        expect(balanceOfMgCvgAt48).to.be.eq("89583333333333333332");

        const balanceOfMgCvgAt49 = await lockingPositionServiceContract.balanceOfMgCvgAt(1, 49);
        expect(balanceOfMgCvgAt49).to.be.eq("89583333333333333332");

        const balanceOfMgCvgAt60 = await lockingPositionServiceContract.balanceOfMgCvgAt(1, 60);
        expect(balanceOfMgCvgAt60).to.be.eq("89583333333333333332");

        const balanceOfMgCvgAt61 = await lockingPositionServiceContract.balanceOfMgCvgAt(1, 61);
        expect(balanceOfMgCvgAt61).to.be.eq("0");

        const veCvgBalance = await lockingPositionServiceContract.balanceOfVeCvg(1);
        expect(veCvgBalance).to.be.closeTo("116083236882708085144", ethers.parseEther("5"));

        // Ys Cvg
        const totalSupplyYsCvg = await lockingPositionServiceContract.totalSupplyYsCvg();
        expect(totalSupplyYsCvg).to.eq("0");

        const balanceOfYsCvgAt6 = await lockingPositionServiceContract.balanceOfYsCvgAt(1, 6);
        expect(balanceOfYsCvgAt6).to.be.eq("52256944444444444442");

        const balanceOfYsCvgAt12 = await lockingPositionServiceContract.balanceOfYsCvgAt(1, 12);
        expect(balanceOfYsCvgAt12).to.be.eq("52256944444444444442");

        const balanceOfYsCvgAt13 = await lockingPositionServiceContract.balanceOfYsCvgAt(1, 13);
        expect(balanceOfYsCvgAt13).to.be.eq("89583333333333333332");

        const totalSupplyOfYsCvgAt12 = await lockingPositionServiceContract.totalSupplyOfYsCvgAt(12);
        expect(totalSupplyOfYsCvgAt12).to.be.eq("52256944444444444442");

        const totalSupplyOfYsCvgAt13 = await lockingPositionServiceContract.totalSupplyOfYsCvgAt(13);
        expect(totalSupplyOfYsCvgAt13).to.be.eq("89583333333333333332");

        const totalSupplyOfYsCvgAt48 = await lockingPositionServiceContract.totalSupplyOfYsCvgAt(48);
        expect(totalSupplyOfYsCvgAt48).to.be.eq("89583333333333333332");

        const totalSupplyOfYsCvgAt60 = await lockingPositionServiceContract.totalSupplyOfYsCvgAt(60);
        expect(totalSupplyOfYsCvgAt60).to.be.eq("89583333333333333332");

        const totalSupplyOfYsCvgAt61 = await lockingPositionServiceContract.totalSupplyOfYsCvgAt(61);
        expect(totalSupplyOfYsCvgAt61).to.be.eq("0");
    });

    it("CYCLE 7 - go on cycle 7 - increase amount on token 1 for 400", async () => {
        await increaseCvgCycleAndWriteForPlotting({contracts, users}, 2);
        await (await cvgContract.connect(user1).approve(lockingPositionServiceContract, ethers.parseEther("400"))).wait();
        await (await lockingPositionServiceContract.connect(user1).increaseLockAmount(1, ethers.parseEther("400"), zeroAddress())).wait();

        const veCvgBalance = await lockingPositionServiceContract.balanceOfVeCvg(1);
        expect(veCvgBalance).to.be.closeTo("223830288249543726344", ethers.parseEther("10"));

        // MgCvg
        const balanceOfMgCvg = await lockingPositionServiceContract.balanceOfMgCvg(1);
        expect(balanceOfMgCvg).to.be.eq("199999999999999999998");

        const balanceOfMgCvgAt5 = await lockingPositionServiceContract.balanceOfMgCvgAt(1, 5);
        expect(balanceOfMgCvgAt5).to.be.eq("89583333333333333332");

        const balanceOfMgCvgAt7 = await lockingPositionServiceContract.balanceOfMgCvgAt(1, 7);
        expect(balanceOfMgCvgAt7).to.be.eq("199999999999999999998");

        const balanceOfMgCvgAt60 = await lockingPositionServiceContract.balanceOfMgCvgAt(1, 60);
        expect(balanceOfMgCvgAt60).to.be.eq("199999999999999999998");

        const balanceOfMgCvgAt61 = await lockingPositionServiceContract.balanceOfMgCvgAt(1, 61);
        expect(balanceOfMgCvgAt61).to.be.eq("0");

        // Ys Cvg
        const totalSupplyYsCvg = await lockingPositionServiceContract.totalSupplyYsCvg();
        expect(totalSupplyYsCvg).to.eq("52256944444444444442");

        const balanceOfYsCvgAt6 = await lockingPositionServiceContract.balanceOfYsCvgAt(1, 6);
        expect(balanceOfYsCvgAt6).to.be.eq("52256944444444444442");

        const balanceOfYsCvgAt12 = await lockingPositionServiceContract.balanceOfYsCvgAt(1, 12);
        expect(balanceOfYsCvgAt12).to.be.eq("98263888888888888886");

        const balanceOfYsCvgAt13 = await lockingPositionServiceContract.balanceOfYsCvgAt(1, 13);
        expect(balanceOfYsCvgAt13).to.be.eq("199999999999999999998");

        const balanceOfYsCvgAt60 = await lockingPositionServiceContract.balanceOfYsCvgAt(1, 60);
        expect(balanceOfYsCvgAt60).to.be.eq("199999999999999999998");

        const balanceOfYsCvgAt61 = await lockingPositionServiceContract.balanceOfYsCvgAt(1, 61);
        expect(balanceOfYsCvgAt61).to.be.eq("0");

        const totalSupplyOfYsCvgAt12 = await lockingPositionServiceContract.totalSupplyOfYsCvgAt(12);
        expect(totalSupplyOfYsCvgAt12).to.be.eq("98263888888888888886");

        const totalSupplyOfYsCvgAt13 = await lockingPositionServiceContract.totalSupplyOfYsCvgAt(13);
        expect(totalSupplyOfYsCvgAt13).to.be.eq("199999999999999999998");

        const totalSupplyOfYsCvgAt48 = await lockingPositionServiceContract.totalSupplyOfYsCvgAt(48);
        expect(totalSupplyOfYsCvgAt48).to.be.eq("199999999999999999998");

        const totalSupplyOfYsCvgAt60 = await lockingPositionServiceContract.totalSupplyOfYsCvgAt(60);
        expect(totalSupplyOfYsCvgAt60).to.be.eq("199999999999999999998");

        const totalSupplyOfYsCvgAt61 = await lockingPositionServiceContract.totalSupplyOfYsCvgAt(61);
        expect(totalSupplyOfYsCvgAt61).to.be.eq("0");
    });

    it("CYCLE 7 - MINT token 2 on cycle 7", async () => {
        // MINT TOKEN 2
        await (await cvgContract.connect(user1).approve(lockingPositionServiceContract, ethers.parseEther("1000"))).wait();
        await (await lockingPositionServiceContract.connect(user1).mintPosition(89, ethers.parseEther("1000"), 20, user1, true)).wait();

        const veCvgBalance = await lockingPositionServiceContract.balanceOfVeCvg(2);
        expect(veCvgBalance).to.be.closeTo("741930087081077845456", ethers.parseEther("20"));

        // MgCvg
        const balanceOfMgCvg = await lockingPositionServiceContract.balanceOfMgCvg(2);
        expect(balanceOfMgCvg).to.be.eq("741666666666666666666");

        const balanceOfMgCvgAt5 = await lockingPositionServiceContract.balanceOfMgCvgAt(2, 5);
        expect(balanceOfMgCvgAt5).to.be.eq("0");

        const balanceOfMgCvgAt7 = await lockingPositionServiceContract.balanceOfMgCvgAt(2, 7);
        expect(balanceOfMgCvgAt7).to.be.eq("741666666666666666666");

        const balanceOfMgCvgAt96 = await lockingPositionServiceContract.balanceOfMgCvgAt(2, 96);
        expect(balanceOfMgCvgAt96).to.be.eq("741666666666666666666");

        const balanceOfMgCvgAt97 = await lockingPositionServiceContract.balanceOfMgCvgAt(2, 97);
        expect(balanceOfMgCvgAt97).to.be.eq("0");

        // YsCvg Token
        const balanceOfYsCvgAt7 = await lockingPositionServiceContract.balanceOfYsCvgAt(2, 7);
        expect(balanceOfYsCvgAt7).to.be.eq("0");

        const balanceOfYsCvgAt8 = await lockingPositionServiceContract.balanceOfYsCvgAt(2, 8);
        expect(balanceOfYsCvgAt8).to.be.eq("77256944444444444444");

        const balanceOfYsCvgAt12 = await lockingPositionServiceContract.balanceOfYsCvgAt(2, 12);
        expect(balanceOfYsCvgAt12).to.be.eq("77256944444444444444");

        const balanceOfYsCvgAt13 = await lockingPositionServiceContract.balanceOfYsCvgAt(2, 13);
        expect(balanceOfYsCvgAt13).to.be.eq("185416666666666666666");

        const balanceOfYsCvgAt96 = await lockingPositionServiceContract.balanceOfYsCvgAt(2, 96);
        expect(balanceOfYsCvgAt96).to.be.eq("185416666666666666666");

        const balanceOfYsCvgAt97 = await lockingPositionServiceContract.balanceOfYsCvgAt(2, 97);
        expect(balanceOfYsCvgAt97).to.be.eq("0");

        // YsCvg TotalSupply

        const totalSupplyYsCvg = await lockingPositionServiceContract.totalSupplyYsCvg();
        expect(totalSupplyYsCvg).to.be.eq("52256944444444444442");

        const totalSupplyOfYsCvgAt6 = await lockingPositionServiceContract.totalSupplyOfYsCvgAt(6);
        expect(totalSupplyOfYsCvgAt6).to.be.eq("52256944444444444442");

        const totalSupplyOfYsCvgAt8 = await lockingPositionServiceContract.totalSupplyOfYsCvgAt(8);
        expect(totalSupplyOfYsCvgAt8).to.be.eq("175520833333333333330");

        const totalSupplyOfYsCvgAt12 = await lockingPositionServiceContract.totalSupplyOfYsCvgAt(12);
        expect(totalSupplyOfYsCvgAt12).to.be.eq("175520833333333333330");

        const totalSupplyOfYsCvgAt13 = await lockingPositionServiceContract.totalSupplyOfYsCvgAt(13);
        expect(totalSupplyOfYsCvgAt13).to.be.eq("385416666666666666664");

        const totalSupplyOfYsCvgAt48 = await lockingPositionServiceContract.totalSupplyOfYsCvgAt(48);
        expect(totalSupplyOfYsCvgAt48).to.be.eq("385416666666666666664");

        const totalSupplyOfYsCvgAt49 = await lockingPositionServiceContract.totalSupplyOfYsCvgAt(49);
        expect(totalSupplyOfYsCvgAt49).to.be.eq("385416666666666666664");

        const totalSupplyOfYsCvgAt60 = await lockingPositionServiceContract.totalSupplyOfYsCvgAt(60);
        expect(totalSupplyOfYsCvgAt60).to.be.eq("385416666666666666664");

        const totalSupplyOfYsCvgAt61 = await lockingPositionServiceContract.totalSupplyOfYsCvgAt(61);
        expect(totalSupplyOfYsCvgAt61).to.be.eq("185416666666666666666");

        const totalSupplyOfYsCvgAt96 = await lockingPositionServiceContract.totalSupplyOfYsCvgAt(96);
        expect(totalSupplyOfYsCvgAt96).to.be.eq("185416666666666666666");

        const totalSupplyOfYsCvgAt97 = await lockingPositionServiceContract.totalSupplyOfYsCvgAt(97);
        expect(totalSupplyOfYsCvgAt97).to.be.eq("0");
    });

    it("go on cycle 25 - MINT token 3 ", async () => {
        await increaseCvgCycleAndWriteForPlotting({contracts, users}, 18);

        await (await cvgContract.connect(user1).approve(lockingPositionServiceContract, ethers.parseEther("1000"))).wait();
        await (await lockingPositionServiceContract.connect(user1).mintPosition(23, ethers.parseEther("1000"), 100, user1, true)).wait();

        const veCvgBalance = await lockingPositionServiceContract.balanceOfVeCvg(3);
        expect(veCvgBalance).to.be.eq("0");

        // MgCvg
        const balanceOfMgCvg = await lockingPositionServiceContract.balanceOfMgCvg(3);
        expect(balanceOfMgCvg).to.be.eq("0");

        const balanceOfMgCvgAt25 = await lockingPositionServiceContract.balanceOfMgCvgAt(3, 25);
        expect(balanceOfMgCvgAt25).to.be.eq("0");

        const balanceOfMgCvgAt48 = await lockingPositionServiceContract.balanceOfMgCvgAt(3, 48);
        expect(balanceOfMgCvgAt48).to.be.eq("0");

        const balanceOfMgCvgAt49 = await lockingPositionServiceContract.balanceOfMgCvgAt(3, 49);
        expect(balanceOfMgCvgAt49).to.be.eq("0");

        // YsCvg

        const balanceOfYsCvgAt25 = await lockingPositionServiceContract.balanceOfYsCvgAt(3, 25);
        expect(balanceOfYsCvgAt25).to.be.eq("0");

        const balanceOfYsCvgAt48 = await lockingPositionServiceContract.balanceOfYsCvgAt(3, 48);
        expect(balanceOfYsCvgAt48).to.be.eq("239583333333333333333");

        const balanceOfYsCvgAt49 = await lockingPositionServiceContract.balanceOfYsCvgAt(3, 49);
        expect(balanceOfYsCvgAt49).to.be.eq("0");

        // YsCvg TotalSupply

        const totalSupplyYsCvg = await lockingPositionServiceContract.totalSupplyYsCvg();
        expect(totalSupplyYsCvg).to.be.eq("385416666666666666664");

        const totalSupplyOfYsCvgAt26 = await lockingPositionServiceContract.totalSupplyOfYsCvgAt(26);
        expect(totalSupplyOfYsCvgAt26).to.be.eq("605034722222222222219");

        const totalSupplyOfYsCvgAt48 = await lockingPositionServiceContract.totalSupplyOfYsCvgAt(48);
        expect(totalSupplyOfYsCvgAt48).to.be.eq("624999999999999999997");

        const totalSupplyOfYsCvgAt49 = await lockingPositionServiceContract.totalSupplyOfYsCvgAt(49);
        expect(totalSupplyOfYsCvgAt49).to.be.eq("385416666666666666664");

        const totalSupplyOfYsCvgAt60 = await lockingPositionServiceContract.totalSupplyOfYsCvgAt(60);
        expect(totalSupplyOfYsCvgAt60).to.be.eq("385416666666666666664");

        const totalSupplyOfYsCvgAt61 = await lockingPositionServiceContract.totalSupplyOfYsCvgAt(61);
        expect(totalSupplyOfYsCvgAt61).to.be.eq("185416666666666666666");

        const totalSupplyOfYsCvgAt96 = await lockingPositionServiceContract.totalSupplyOfYsCvgAt(96);
        expect(totalSupplyOfYsCvgAt96).to.be.eq("185416666666666666666");
    });

    it("CYCLE 30 - go on 30 - INCREASE_AMOUNT of 500 on token 3 ", async () => {
        await increaseCvgCycleAndWriteForPlotting({contracts, users}, 5);

        await (await cvgContract.connect(user1).approve(lockingPositionServiceContract, ethers.parseEther("500"))).wait();
        await (await lockingPositionServiceContract.connect(user1).increaseLockAmount(3, ethers.parseEther("500"), zeroAddress())).wait();

        const totalSupplyYsCvg = await lockingPositionServiceContract.totalSupplyYsCvg();
        expect(totalSupplyYsCvg).to.be.eq("605034722222222222219");

        const veCvgBalance = await lockingPositionServiceContract.balanceOfVeCvg(3);
        expect(veCvgBalance).to.be.eq("0");
    });

    it("CYCLE 43 - go on 43 - MINT 4", async () => {
        await increaseCvgCycleAndWriteForPlotting({contracts, users}, 13);

        await (await cvgContract.connect(user1).approve(lockingPositionServiceContract, ethers.parseEther("5000"))).wait();
        await (await lockingPositionServiceContract.connect(user1).mintPosition(5, ethers.parseEther("5000"), 70, user1, true)).wait();

        const veCvgBalance = await lockingPositionServiceContract.balanceOfVeCvg(4);
        expect(veCvgBalance).to.be.closeTo("87475947627312199214", ethers.parseEther("15"));
    });

    it("CYCLE 43 - INCREASE_AMOUNT 100 on token 1", async () => {
        await (await cvgContract.connect(user1).approve(lockingPositionServiceContract, ethers.parseEther("100"))).wait();
        await (await lockingPositionServiceContract.connect(user1).increaseLockAmount(1, ethers.parseEther("100"), zeroAddress())).wait();

        const veCvgBalance = await lockingPositionServiceContract.balanceOfVeCvg(1);
        expect(veCvgBalance).to.be.closeTo("83043728298610770964", ethers.parseEther("5"));

        const totalSupplyYsCvg = await lockingPositionServiceContract.totalSupplyYsCvg();
        expect(totalSupplyYsCvg).to.be.eq("718749999999999999997"); // 43 => 718,75
    });

    it("CYCLE 60 - go on 60 - INCREASE_TIME for 3 TDEs 5000 on token 1", async () => {
        await increaseCvgCycleAndWriteForPlotting({contracts, users}, 17);

        await (await lockingPositionServiceContract.connect(user1).increaseLockTime(1, 36)).wait();
        const totalSupplyYsCvg = await lockingPositionServiceContract.totalSupplyYsCvg();
        expect(totalSupplyYsCvg).to.be.eq("394270833333333333330"); // 60 => 394,271

        const veCvgBalance = await lockingPositionServiceContract.balanceOfVeCvg(1);
        expect(veCvgBalance).to.be.closeTo("172104468936011199822", ethers.parseEther("10"));
    });

    it("CYCLE 60 - INCREASE_AMOUNT 5000 on token 1", async () => {
        await (await cvgContract.connect(user1).approve(lockingPositionServiceContract, ethers.parseEther("200"))).wait();
        await (await lockingPositionServiceContract.connect(user1).increaseLockAmount(1, ethers.parseEther("200"), zeroAddress())).wait();

        const totalSupplyYsCvg = await lockingPositionServiceContract.totalSupplyYsCvg();
        expect(totalSupplyYsCvg).to.be.eq("394270833333333333330"); // 60 => 394,271

        const veCvgBalance = await lockingPositionServiceContract.balanceOfVeCvg(1);
        expect(veCvgBalance).to.be.closeTo("210348172949732120880", ethers.parseEther("10"));
    });

    it("CYCLE 69 - go on 69 - MINT token 5", async () => {
        await increaseCvgCycleAndWriteForPlotting({contracts, users}, 9);

        await (await cvgContract.connect(user1).approve(lockingPositionServiceContract, ethers.parseEther("10000"))).wait();
        await (await lockingPositionServiceContract.connect(user1).mintPosition(51, ethers.parseEther("10000"), 40, user1, true)).wait();

        const totalSupplyYsCvg = await lockingPositionServiceContract.totalSupplyYsCvg();
        expect(totalSupplyYsCvg).to.be.eq("431770833333333333330"); // 60 => 394,271

        const veCvgBalance = await lockingPositionServiceContract.balanceOfVeCvg(5);
        expect(veCvgBalance).to.be.closeTo("3232068969080685017495", ethers.parseEther("200"));
    });

    it("CYCLE 72 - go on 72 - INCREASE_AMOUNT 5000 on token 5", async () => {
        await increaseCvgCycleAndWriteForPlotting({contracts, users}, 3);

        await (await cvgContract.connect(user1).approve(lockingPositionServiceContract, ethers.parseEther("10000"))).wait();
        await (await lockingPositionServiceContract.connect(user1).increaseLockAmount(5, ethers.parseEther("5000"), zeroAddress())).wait();

        const totalSupplyYsCvg = await lockingPositionServiceContract.totalSupplyYsCvg();
        expect(totalSupplyYsCvg).to.be.eq("963020833333333333330"); // 60 => 394,271

        const veCvgBalance = await lockingPositionServiceContract.balanceOfVeCvg(5);
        expect(veCvgBalance).to.be.closeTo("4565706225198393997280", ethers.parseEther("150"));
    });

    it("CYCLE 75 - go on 75 - MINT token 6", async () => {
        await increaseCvgCycleAndWriteForPlotting({contracts, users}, 3);

        await (await cvgContract.connect(user1).approve(lockingPositionServiceContract, ethers.parseEther("2500"))).wait();
        await (await lockingPositionServiceContract.connect(user1).mintPosition(93, ethers.parseEther("2500"), 0, user1, true)).wait();

        const totalSupplyYsCvg = await lockingPositionServiceContract.totalSupplyYsCvg();
        expect(totalSupplyYsCvg).to.be.eq("3556770833333333333330"); // 60 => 394,271

        const veCvgBalance = await lockingPositionServiceContract.balanceOfVeCvg(6);
        expect(veCvgBalance).to.be.closeTo("2440444714850585251113", ethers.parseEther("50"));
    });

    it("CYCLE 80 - go on 80 - MINT token 7 with very little amount of pussy", async () => {
        await increaseCvgCycleAndWriteForPlotting({contracts, users}, 5);

        await (await cvgContract.connect(user1).approve(lockingPositionServiceContract, ethers.parseEther("10000"))).wait();
        await (await lockingPositionServiceContract.connect(user1).mintPosition(52, "12", 80, user1, true)).wait();

        const totalSupplyYsCvg = await lockingPositionServiceContract.totalSupplyYsCvg();
        expect(totalSupplyYsCvg).to.be.eq("3556770833333333333330"); // 60 => 394,271

        const veCvgBalance = await lockingPositionServiceContract.balanceOfVeCvg(7);
        expect(veCvgBalance).to.be.closeTo("0", ethers.parseEther("1"));
    });

    it("CYCLE 85 - go on 85 - MINT token 8", async () => {
        await increaseCvgCycleAndWriteForPlotting({contracts, users}, 5);

        await (await cvgContract.connect(user1).approve(lockingPositionServiceContract, ethers.parseEther("10000"))).wait();
        await (await lockingPositionServiceContract.connect(user1).mintPosition(47, ethers.parseEther("10000"), 80, user1, true)).wait();

        const totalSupplyYsCvg = await lockingPositionServiceContract.totalSupplyYsCvg();
        expect(totalSupplyYsCvg).to.be.eq("3556770833333333333334"); // 85 => 3556,77

        const veCvgBalance = await lockingPositionServiceContract.balanceOfVeCvg(8);
        expect(veCvgBalance).to.be.closeTo("994012896825386341344", ethers.parseEther("50"));
    });

    it("CYCLE 90 - go on 90 - INCREASE_AMOUNT 5000 on token 5", async () => {
        await increaseCvgCycleAndWriteForPlotting({contracts, users}, 5);

        await (await cvgContract.connect(user1).approve(lockingPositionServiceContract, ethers.parseEther("10000"))).wait();
        await (await lockingPositionServiceContract.connect(user1).increaseLockTime(5, 24)).wait();

        const veCvgBalance = await lockingPositionServiceContract.balanceOfVeCvg(5);
        expect(veCvgBalance).to.be.closeTo("5128175068204344074360", ethers.parseEther("150"));
    });

    it("CYCLE 90 - MINT token 9", async () => {
        await (await cvgContract.connect(user1).approve(lockingPositionServiceContract, ethers.parseEther("5000"))).wait();
        await (await lockingPositionServiceContract.connect(user1).mintPosition(18, ethers.parseEther("5000"), 50, user1, true)).wait();

        const totalSupplyYsCvg = await lockingPositionServiceContract.totalSupplyYsCvg();
        expect(totalSupplyYsCvg).to.be.eq("7147048611111111111111"); // 85 => 3556,77

        const veCvgBalance = await lockingPositionServiceContract.balanceOfVeCvg(9);
        expect(veCvgBalance).to.be.closeTo("487255471850187615429", ethers.parseEther("50"));
    });

    it("CYCLE 95 - go on  95 - increase amount of 5000 cvg", async () => {
        await increaseCvgCycleAndWriteForPlotting({contracts, users}, 5);

        await (await cvgContract.connect(user1).approve(lockingPositionServiceContract, ethers.parseEther("10000"))).wait();
        await (await lockingPositionServiceContract.connect(user1).increaseLockAmount(5, ethers.parseEther("5000"), zeroAddress())).wait();

        const totalSupplyYsCvg = await lockingPositionServiceContract.totalSupplyYsCvg();
        expect(totalSupplyYsCvg).to.be.eq("7381423611111111111111"); // 85 => 3556,77

        const veCvgBalance = await lockingPositionServiceContract.balanceOfVeCvg(5);
        expect(veCvgBalance).to.be.closeTo("6212563864087296179886", ethers.parseEther("300"));
    });

    it("CYCLE 96 - go on  96 ", async () => {
        await increaseCvgCycleAndWriteForPlotting({contracts, users}, 1);

        const totalSupplyYsCvg = await lockingPositionServiceContract.totalSupplyYsCvg();
        expect(totalSupplyYsCvg).to.be.eq("7466493055555555555555");

        const veCvgBalance = await lockingPositionServiceContract.balanceOfVeCvg(1);
        expect(veCvgBalance).to.be.closeTo("3705718832671703430", ethers.parseEther("50"));
    });

    it("CYCLE 97 - go on 97", async () => {
        await increaseCvgCycleAndWriteForPlotting({contracts, users}, 1);

        const totalSupplyYsCvg = await lockingPositionServiceContract.totalSupplyYsCvg();
        expect(totalSupplyYsCvg).to.be.eq("8531250000000000000003");

        const veCvgBalance1 = await lockingPositionServiceContract.balanceOfVeCvg(1);
        expect(veCvgBalance1).to.be.closeTo("0", ethers.parseEther("1"));

        const veCvgBalance2 = await lockingPositionServiceContract.balanceOfVeCvg(1);
        expect(veCvgBalance2).to.be.closeTo("0", ethers.parseEther("1"));
    });

    it("CYCLE 98 - go on  98 - increase lock amount of token 8", async () => {
        await increaseCvgCycleAndWriteForPlotting({contracts, users}, 1);
        await (await lockingPositionServiceContract.connect(user1).increaseLockAmount(8, ethers.parseEther("2000"), zeroAddress())).wait();

        const totalSupplyYsCvg = await lockingPositionServiceContract.totalSupplyYsCvg();
        expect(totalSupplyYsCvg).to.be.eq("8531250000000000000003");

        const veCvgBalance = await lockingPositionServiceContract.balanceOfVeCvg(8);
        expect(veCvgBalance).to.be.closeTo("867722842261887213078", ethers.parseEther("50"));
    });

    it("go in cycle 100, extend lock of token 8 to 168 THEN extend lock amount at cycle 100 of token 8", async () => {
        await increaseCvgCycleAndWriteForPlotting({contracts, users}, 2);
        await (await lockingPositionServiceContract.connect(user1).increaseLockTime(8, 36)).wait();

        await (await cvgContract.connect(user1).approve(lockingPositionServiceContract, ethers.parseEther("10000"))).wait();
        await (await lockingPositionServiceContract.connect(user1).increaseLockAmount(8, ethers.parseEther("5000"), zeroAddress())).wait();

        const totalSupplyYsCvg = await lockingPositionServiceContract.totalSupplyYsCvg();
        expect(totalSupplyYsCvg).to.be.eq("9003472222222222222224");

        const veCvgBalance = await lockingPositionServiceContract.balanceOfVeCvg(8);
        expect(veCvgBalance).to.be.closeTo("2433433256172838773280", ethers.parseEther("50"));
    });

    it("go in cycle 105, last cycle of the lock", async () => {
        await increaseCvgCycleAndWriteForPlotting({contracts, users}, 5);
        await (await lockingPositionServiceContract.connect(user1).increaseLockTime(6, 24)).wait();

        const totalSupplyYsCvg = await lockingPositionServiceContract.totalSupplyYsCvg();
        expect(totalSupplyYsCvg).to.be.eq("10892361111111111111112");

        const veCvgBalance = await lockingPositionServiceContract.balanceOfVeCvg(6);
        expect(veCvgBalance).to.be.closeTo("2284159363977021694896", ethers.parseEther("50"));
    });

    it("go in cycle 108, and increase to 72 cycles", async () => {
        await increaseCvgCycleAndWriteForPlotting({contracts, users}, 3);
        await (await lockingPositionServiceContract.connect(user1).increaseLockTime(9, 72)).wait();

        const totalSupplyYsCvg = await lockingPositionServiceContract.totalSupplyYsCvg();
        expect(totalSupplyYsCvg).to.be.eq("10892361111111111111112");

        const veCvgBalance = await lockingPositionServiceContract.balanceOfVeCvg(9);
        expect(veCvgBalance).to.be.closeTo("1893534062568851338557", ethers.parseEther("50"));
    });

    it("go in cycle 143, increase amount of token 9 to 14k", async () => {
        await increaseCvgCycleAndWriteForPlotting({contracts, users}, 35);
        await (await cvgContract.connect(user1).approve(lockingPositionServiceContract, ethers.parseEther("20000"))).wait();
        await (await lockingPositionServiceContract.connect(user1).increaseLockAmount(9, ethers.parseEther("14000"), zeroAddress())).wait();

        const totalSupplyYsCvg = await lockingPositionServiceContract.totalSupplyYsCvg();
        expect(totalSupplyYsCvg).to.be.eq("11931249999999999999998");

        const veCvgBalance = await lockingPositionServiceContract.balanceOfVeCvg(9);
        expect(veCvgBalance).to.be.closeTo("3757300820863641200512", ethers.parseEther("150"));
    });

    it("go in cycle 144, increase time and amount of token 9 to 14k", async () => {
        await increaseCvgCycleAndWriteForPlotting({contracts, users}, 1);

        await (await cvgContract.connect(user1).approve(lockingPositionServiceContract, ethers.parseEther("14000"))).wait();
        await (await lockingPositionServiceContract.connect(user1).increaseLockTimeAndAmount(9, 12, ethers.parseEther("14000"), zeroAddress())).wait();

        const totalSupplyYsCvg = await lockingPositionServiceContract.totalSupplyYsCvg();
        expect(totalSupplyYsCvg).to.be.eq("12156076388888888888886");

        const veCvgBalance = await lockingPositionServiceContract.balanceOfVeCvg(9);
        expect(veCvgBalance).to.be.closeTo("8386114314649456222856", ethers.parseEther("500"));
    });

    it("go in cycle 192, increase amount of token 9 to 5k", async () => {
        await increaseCvgCycleAndWriteForPlotting({contracts, users}, 48);

        await (await cvgContract.connect(user1).approve(lockingPositionServiceContract, ethers.parseEther("14000"))).wait();
        await (await lockingPositionServiceContract.connect(user1).increaseLockTimeAndAmount(9, 48, ethers.parseEther("14000"), zeroAddress())).wait();

        const totalSupplyYsCvg = await lockingPositionServiceContract.totalSupplyYsCvg();
        expect(totalSupplyYsCvg).to.be.eq("6666666666666666666666");

        const veCvgBalance = await lockingPositionServiceContract.balanceOfVeCvg(9);
        expect(veCvgBalance).to.be.closeTo("11987049239762433134732", ethers.parseEther("400"));
    });

    it("PLOT LAST POINTS", async () => {
        await increaseCvgCycleAndWriteForPlotting({contracts, users}, 60);
    });

    it("mgCvgBalance per token", async () => {
        const totalSupplyToken = await lockingPositionManagerContract.totalSupply();
        for (let index = 1; index <= totalSupplyToken; index++) {
            await plotTokenSuppliesMgCvg(contractUsers, index);
        }
    });

    it("ysCvgBalance per token", async () => {
        const totalSupplyToken = await lockingPositionManagerContract.totalSupply();
        for (let index = 1; index <= totalSupplyToken; index++) {
            await plotTokenSuppliesYsCvg(contractUsers, index);
        }
    });
});
