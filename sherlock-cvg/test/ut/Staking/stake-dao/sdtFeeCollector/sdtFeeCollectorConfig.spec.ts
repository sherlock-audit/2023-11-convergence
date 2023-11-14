import {loadFixture} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import {expect} from "chai";
import {ethers} from "hardhat";
import {Signer} from "ethers";
import {CvgSdtBuffer, SdtFeeCollector} from "../../../../../typechain-types";

import {IContractsUser, IUsers} from "../../../../../utils/contractInterface";

import {deploySdtStakingFixture} from "../../../../fixtures/fixtures";

describe("SdtFeeCollector - Config", () => {
    let contractsUsers: IContractsUser, users: IUsers;
    let user1: Signer, user2: Signer, treasuryBonds: Signer, treasuryDao: Signer;
    let sdtFeeCollector: SdtFeeCollector, cvgSdtBuffer: CvgSdtBuffer;

    before(async () => {
        contractsUsers = await loadFixture(deploySdtStakingFixture);

        users = contractsUsers.users;
        user1 = users.user1;
        user2 = users.user2;
        treasuryDao = users.treasuryDao;
        treasuryBonds = users.treasuryBonds;

        sdtFeeCollector = contractsUsers.contracts.stakeDao.sdtFeeCollector;
        cvgSdtBuffer = contractsUsers.contracts.stakeDao.cvgSdtBuffer;
    });

    it("Success : Verify initial parameters", async () => {
        expect(await sdtFeeCollector.rootFees()).to.be.eq(17_500);

        const fee0 = await sdtFeeCollector.feesRepartition(0);
        const fee1 = await sdtFeeCollector.feesRepartition(1);

        expect(fee0.receiver).to.be.eq(await cvgSdtBuffer.getAddress());
        expect(fee0.feePercentage).to.be.eq(71_500n);

        expect(fee1.receiver).to.be.eq(await treasuryBonds.getAddress());
        expect(fee1.feePercentage).to.be.eq(28_500n);
    });

    it("Fails : Setup root fees above 20%", async () => {
        await expect(sdtFeeCollector.connect(treasuryDao).setUpRootFees(20_001)).to.be.rejectedWith("FEES_TOO_BIG");
    });

    it("Fails : Setup root fees as random user", async () => {
        await expect(sdtFeeCollector.setUpRootFees(15_000)).to.be.rejectedWith("Ownable: caller is not the owner");
    });

    it("Success : Setup root fees as not the owner", async () => {
        await sdtFeeCollector.connect(treasuryDao).setUpRootFees(15_000);
        expect(await sdtFeeCollector.rootFees()).to.be.eq(15_000n);
    });

    it("Fails : Setup fee repartitions as not the owner", async () => {
        await expect(
            sdtFeeCollector.setUpFeesRepartition([
                {
                    receiver: user1,
                    feePercentage: 10_000,
                },
            ])
        ).to.be.rejectedWith("Ownable: caller is not the owner");
    });

    it("Fails : Setup fee repartitions with a receiver as 0x00 address", async () => {
        await expect(
            sdtFeeCollector.connect(treasuryDao).setUpFeesRepartition([
                {
                    receiver: ethers.ZeroAddress,
                    feePercentage: 10_000,
                },
            ])
        ).to.be.rejectedWith("ZERO_RECEIVER");
    });

    it("Fails : Setup fee repartitions with a sum not equal to 100%", async () => {
        await expect(
            sdtFeeCollector.connect(treasuryDao).setUpFeesRepartition([
                {
                    receiver: user1,
                    feePercentage: 10_000,
                },
                {
                    receiver: user2,
                    feePercentage: 90_000,
                },
                {
                    receiver: users.user3,
                    feePercentage: 1_000,
                },
            ])
        ).to.be.rejectedWith("TOTAL_NOT_100");
    });

    it("Success : Setup fee repartitions", async () => {
        await sdtFeeCollector.connect(treasuryDao).setUpFeesRepartition([
            {
                receiver: user1,
                feePercentage: 10_000,
            },
            {
                receiver: user2,
                feePercentage: 60_000,
            },
            {
                receiver: users.user3,
                feePercentage: 10_000,
            },
            {
                receiver: users.user4,
                feePercentage: 20_000,
            },
        ]);

        const fee0 = await sdtFeeCollector.feesRepartition(0);
        const fee1 = await sdtFeeCollector.feesRepartition(1);
        const fee2 = await sdtFeeCollector.feesRepartition(2);
        const fee3 = await sdtFeeCollector.feesRepartition(3);

        expect(fee0.receiver).to.be.eq(await user1.getAddress());
        expect(fee0.feePercentage).to.be.eq(10_000n);

        expect(fee1.receiver).to.be.eq(await user2.getAddress());
        expect(fee1.feePercentage).to.be.eq(60_000);

        expect(fee2.receiver).to.be.eq(await users.user3.getAddress());
        expect(fee2.feePercentage).to.be.eq(10_000);

        expect(fee3.receiver).to.be.eq(await users.user4.getAddress());
        expect(fee3.feePercentage).to.be.eq(20_000);
    });
});
