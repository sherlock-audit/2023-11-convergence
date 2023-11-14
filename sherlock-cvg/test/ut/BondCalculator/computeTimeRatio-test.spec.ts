import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {expect} from "chai";
import {ethers} from "hardhat";

import {BondCalculator} from "../../../typechain-types/contracts/Bond";
import {deployBondCalculatorFixture} from "../../fixtures/fixtures";

describe("BondCalculator / computeTimeRatio", function () {
    let bondCalculatorContract: BondCalculator;
    let timeRatio;

    const BOND_DURATION = 86_400;

    const PERIOD = 8640;

    before(async () => {
        const {contracts, users} = await loadFixture(deployBondCalculatorFixture);
        bondCalculatorContract = contracts.bonds.bondCalculator;
    });

    it("compute a time ratio at the beginning", async () => {
        timeRatio = await bondCalculatorContract.computeTimeRatioUInt(1, BOND_DURATION);
        expect(timeRatio).to.be.eq(11); //  0.000011%
    });

    it("compute a time ratio of 10%", async () => {
        timeRatio = await bondCalculatorContract.computeTimeRatioUInt(PERIOD, BOND_DURATION);
        expect(timeRatio).to.be.eq(99999); // 9.99%
    });

    it("compute a time ratio of 20%", async () => {
        timeRatio = await bondCalculatorContract.computeTimeRatioUInt(2 * PERIOD, BOND_DURATION);
        expect(timeRatio).to.be.eq(199999); // 3.5714%
    });

    it("compute a time ratio of 30%", async () => {
        timeRatio = await bondCalculatorContract.computeTimeRatioUInt(3 * PERIOD, BOND_DURATION);
        expect(timeRatio).to.be.eq(299999); // 50.89%
    });

    it("compute a time ratio of 100%", async () => {
        timeRatio = await bondCalculatorContract.computeTimeRatioUInt(BOND_DURATION, BOND_DURATION);
        expect(timeRatio).to.be.eq(1000000); // 86.6071%
    });
});
