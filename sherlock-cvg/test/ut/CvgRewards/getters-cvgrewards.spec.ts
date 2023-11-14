import chai from "chai";
import chaiAsPromised from "chai-as-promised";
chai.use(chaiAsPromised).should();
const expect = chai.expect;

import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {deploySdtStakingFixture} from "../../fixtures/fixtures";
import {CvgRewards} from "../../../typechain-types/contracts/Rewards";
import {GaugeController} from "../../../typechain-types-vyper";

describe("CvgRewards / Get gauges info view", function () {
    let cvgRewardsContract: CvgRewards, gaugeController: GaugeController;

    before(async () => {
        const {contracts} = await loadFixture(deploySdtStakingFixture);

        cvgRewardsContract = contracts.rewards.cvgRewards;
        gaugeController = contracts.locking.gaugeController;
    });
    let gaugeAddresses: string[] = [];
    it("Success : Getint Gauges datas for front ", async () => {
        const gaugesData = await cvgRewardsContract.getGaugeChunk(0, 50);

        expect(gaugesData.length).to.be.eq(await cvgRewardsContract.gaugesLength());

        gaugeAddresses = gaugesData.map((a) => a.stakingAddress);
    });

    it("Success : Get Gauges function is working", async () => {
        const nftDatas = await gaugeController.get_nft_datas([
            {tokenId: 4, gaugeAddresses: gaugeAddresses},
            {tokenId: 1, gaugeAddresses: gaugeAddresses},
        ]);
        expect(nftDatas[0].tokenId).to.be.eq(4n);
        expect(nftDatas[1].tokenId).to.be.eq(1n);
    });
});
