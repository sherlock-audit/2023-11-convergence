import chai from "chai";
import {Signer} from "ethers";
import chaiAsPromised from "chai-as-promised";
chai.use(chaiAsPromised).should();
const expect = chai.expect;

import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {deploySdtStakingFixture} from "../../fixtures/fixtures";
import {CvgRewards} from "../../../typechain-types/contracts/Rewards";
import {calcStakingInflation} from "../../../utils/global/computeCvgStakingInflation";

const END_INFLATION_CYCLE = 1041;
const END_INFLATION_AMOUNT = 1893028846153846164575n;

describe("CvgRewards / staking inflation", function () {
    let cvgRewardsContract: CvgRewards;
    let treasuryDao: Signer, user1: Signer;

    before(async () => {
        const {contracts, users} = await loadFixture(deploySdtStakingFixture);

        cvgRewardsContract = contracts.rewards.cvgRewards;

        treasuryDao = users.treasuryDao;
        user1 = users.user1;
    });

    it("Success : Verify staking inflation yearly reduction", async () => {
        const inflationCycle1 = await cvgRewardsContract.stakingInflationAtCycle(1);
        expect(inflationCycle1).to.be.eq("0");
        for (let index = 1; index < 35; index++) {
            const cycle = index * 52;
            const resultExpected = cycle >= END_INFLATION_CYCLE ? END_INFLATION_AMOUNT : calcStakingInflation(cycle);
            const rewardsContract = await cvgRewardsContract.stakingInflationAtCycle(cycle);

            expect(rewardsContract).to.be.eq(resultExpected);
        }

        const inflationCycleAfter27Years = await cvgRewardsContract.stakingInflationAtCycle(27 * 52);
        expect(inflationCycleAfter27Years).to.be.eq("1893028846153846164575");

        const inflationCycleAfter28Years = await cvgRewardsContract.stakingInflationAtCycle(28 * 52);
        expect(inflationCycleAfter28Years).to.be.eq("1893028846153846164575");

        const inflationCycleAfter29Years = await cvgRewardsContract.stakingInflationAtCycle(29 * 52);
        expect(inflationCycleAfter29Years).to.be.eq("1893028846153846164575");

        const inflationCycleAfter60Years = await cvgRewardsContract.stakingInflationAtCycle(60 * 52);
        expect(inflationCycleAfter60Years).to.be.eq(END_INFLATION_AMOUNT);
    });

    it("Fails : Try to change the inflation ratio as not the DAO.", async () => {
        await expect(cvgRewardsContract.connect(user1).setInflationRatio(8000)).to.be.rejectedWith("Ownable: caller is not the owner");
    });

    it("Success : Changes the inflation ratio to 80%.", async () => {
        await cvgRewardsContract.connect(treasuryDao).setInflationRatio(8000);
    });

    it("Success : Verify staking inflation with reduced ratio", async () => {
        const inflationRatio = await cvgRewardsContract.inflationRatio();
        const inflationCycle1 = await cvgRewardsContract.stakingInflationAtCycle(1);
        expect(inflationCycle1).to.be.eq("0");
        for (let index = 1; index < 35; index++) {
            const cycle = index * 52;
            const resultExpected = cycle >= END_INFLATION_CYCLE ? END_INFLATION_AMOUNT : calcStakingInflation(cycle);
            const rewardsContract = await cvgRewardsContract.stakingInflationAtCycle(cycle);

            expect(rewardsContract).to.be.eq((resultExpected * inflationRatio) / 10_000n);
        }

        const inflationCycleAfter27Years = await cvgRewardsContract.stakingInflationAtCycle(27 * 52);
        expect(inflationCycleAfter27Years).to.be.eq((1893028846153846164575n * inflationRatio) / 10_000n);

        const inflationCycleAfter28Years = await cvgRewardsContract.stakingInflationAtCycle(28 * 52);
        expect(inflationCycleAfter28Years).to.be.eq((1893028846153846164575n * inflationRatio) / 10_000n);

        const inflationCycleAfter29Years = await cvgRewardsContract.stakingInflationAtCycle(29 * 52);
        expect(inflationCycleAfter29Years).to.be.eq((1893028846153846164575n * inflationRatio) / 10_000n);

        const inflationCycleAfter60Years = await cvgRewardsContract.stakingInflationAtCycle(60 * 52);
        expect(inflationCycleAfter60Years).to.be.eq((END_INFLATION_AMOUNT * inflationRatio) / 10_000n);
    });
});
