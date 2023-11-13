import chai from "chai";
import {MAX_INTEGER} from "@nomicfoundation/ethereumjs-util";

import chaiAsPromised from "chai-as-promised";
import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {deployBondFixture} from "../../fixtures/fixtures";
import {time} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import {Signer, EventLog} from "ethers";
import {ethers} from "hardhat";
import {ERC20} from "../../../typechain-types/@openzeppelin/contracts/token/ERC20";
import {CloneFactory} from "../../../typechain-types/contracts";
import {BondDepository} from "../../../typechain-types/contracts/Bond";
import {CvgUtilities} from "../../../typechain-types/contracts/utils";
import {IContractsUser} from "../../../utils/contractInterface";

chai.use(chaiAsPromised).should();
const expect = chai.expect;

describe("CvgUtilities - test Multiclaiming Bonds", () => {
    let dai: ERC20, wETH: ERC20, crv: ERC20;
    let cloneFactoryContract: CloneFactory;
    let daiBondContract: BondDepository, wETHBondContract: BondDepository, crvBondContract: BondDepository;

    let cvgUtilities: CvgUtilities;

    let user1: Signer, user2: Signer, treasuryDao: Signer;
    let tokens;

    let contractsUsers: IContractsUser;
    before(async () => {
        const {contracts, users} = await loadFixture(deployBondFixture);

        user1 = users.user1;
        user2 = users.user2;
        treasuryDao = users.treasuryDao;

        cvgUtilities = contracts.base.cvgUtilities;

        tokens = contracts.tokens;

        dai = tokens.dai;
        wETH = tokens.weth;
        crv = tokens.crv;

        cloneFactoryContract = contracts.base.cloneFactory;
    });

    it("Should create bond Stable", async () => {
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
        const receipt1 = await tx1.wait();
        const events1 = (receipt1!.logs as EventLog[]).filter((e) => e?.fragment?.name === "BondCreated");
        expect(events1).is.not.empty;
        daiBondContract = await ethers.getContractAt("BondDepository", events1[0].args[1]);
        const daiBondContractOwner = await daiBondContract.owner();
        expect(await daiBondContract.getAddress()).is.not.empty;
        expect(daiBondContractOwner).to.equal(await treasuryDao.getAddress());
    });

    it("Should create bond ETH", async () => {
        const tx2 = await cloneFactoryContract.connect(treasuryDao).createBond(
            {
                bondDuration: 86400 * 70,
                maxCvgToMint: ethers.parseEther("1000000"),
                minRoi: 5_000,
                maxRoi: 65_000,
                composedFunction: "0",
                vestingTerm: 7_600,
                token: wETH,
                percentageMaxCvgToMint: 150, // 15% of the total of the bond
                gamma: 250_000,
                scale: 5_000,
            },
            1
        );
        const receipt2 = await tx2.wait();
        const events2 = (receipt2!.logs as EventLog[]).filter((e) => e?.fragment?.name === "BondCreated");
        expect(events2).is.not.empty;

        wETHBondContract = await ethers.getContractAt("BondDepository", events2[0].args[1]);
        expect(await wETHBondContract.getAddress()).is.not.empty;
        const wETHBondContractOwner = await wETHBondContract.owner();
        expect(wETHBondContractOwner).to.equal(await treasuryDao.getAddress());
    });

    it("Should create a bond not stable on CRV", async () => {
        const tx = await cloneFactoryContract.connect(treasuryDao).createBond(
            {
                bondDuration: 86400 * 70,
                maxCvgToMint: ethers.parseEther("1000000"),
                minRoi: 5_000,
                maxRoi: 65_000,
                composedFunction: "0",
                vestingTerm: 7_600,
                token: crv,
                percentageMaxCvgToMint: 150, // 15% of the total of the bond
                gamma: 250_000,
                scale: 5_000,
            },
            1
        );
        const receipt = await tx.wait();
        const events = (receipt!.logs as EventLog[]).filter((e) => e?.fragment?.name === "BondCreated");
        expect(events).is.not.empty;

        crvBondContract = await ethers.getContractAt("BondDepository", events[0].args[1]);
        expect(await crvBondContract.getAddress()).is.not.empty;
        expect(await crvBondContract.owner()).to.equal(await treasuryDao.getAddress());
    });

    it("Deposit for several contracts and tokens", async () => {
        await dai.transfer(await user2.getAddress(), ethers.parseEther("10000"));
        await dai.connect(user2).approve(daiBondContract, MAX_INTEGER);

        await dai.transfer(await user1.getAddress(), ethers.parseEther("10000"));
        await dai.connect(user1).approve(daiBondContract, MAX_INTEGER);

        await crv.transfer(await user2.getAddress(), ethers.parseEther("10000"));
        await crv.connect(user2).approve(crvBondContract, MAX_INTEGER);

        await wETH.transfer(await user2.getAddress(), ethers.parseEther("10000"));
        await wETH.connect(user2).approve(wETHBondContract, MAX_INTEGER);
        await daiBondContract.connect(user2).deposit(0, ethers.parseEther("5000"), await user2.getAddress());
        await daiBondContract.connect(user2).deposit(0, ethers.parseEther("2500"), await user2.getAddress());
        await daiBondContract.connect(user1).deposit(0, ethers.parseEther("10000"), await user1.getAddress());

        await wETHBondContract.connect(user2).deposit(0, ethers.parseEther("2"), user2.getAddress());
        await wETHBondContract.connect(user2).deposit(0, ethers.parseEther("1"), user2.getAddress());

        await crvBondContract.connect(user2).deposit(0, ethers.parseEther("169"), user2.getAddress());
        await crvBondContract.connect(user2).deposit(0, ethers.parseEther("200"), user2.getAddress());
    });

    it("Update time by 2 weeks", async () => {
        await time.increase(14 * 86400);
    });

    it("Fail : Claim for a token not owned ", async () => {
        await expect(
            cvgUtilities.connect(user2).claimMultipleBonds(
                [
                    {
                        bondAddress: daiBondContract,
                        tokenIds: [1, 2, 3],
                    },
                    {
                        bondAddress: wETHBondContract,
                        tokenIds: [4, 5],
                    },
                    {
                        bondAddress: crvBondContract,
                        tokenIds: [6, 7],
                    },
                ],
                await user2.getAddress()
            )
        ).to.be.revertedWith("TOKEN_NOT_OWNED");
    });

    it("Success : Claim for several cycles ", async () => {
        await cvgUtilities.connect(user2).claimMultipleBonds(
            [
                {
                    bondAddress: daiBondContract,
                    tokenIds: [1, 2],
                },
                {
                    bondAddress: wETHBondContract,
                    tokenIds: [4, 5],
                },
                {
                    bondAddress: crvBondContract,
                    tokenIds: [6, 7],
                },
            ],
            await user2.getAddress()
        );
    });
});
