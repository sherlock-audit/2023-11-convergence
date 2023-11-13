import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import {encodeBytes32String} from "ethers";
chai.use(chaiAsPromised).should();
const expect = chai.expect;

import {Signer} from "ethers";
import {CvgSdtBuffer, ERC20, SdtBlackHole} from "../../../typechain-types";
import {loadFixture} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import {deploySdtStakingFixture} from "../../fixtures/fixtures";

describe("sdtBlackHole delegateSdPower", () => {
    let user1: Signer;
    let user2: Signer;
    let treasuryDao: Signer;
    let sdtBlackHole: SdtBlackHole;
    let blackHoleAddress: string;
    let cvgSdtBuffer: CvgSdtBuffer;
    let sdt: ERC20;

    before(async () => {
        const contractsUsers = await loadFixture(deploySdtStakingFixture);
        const users = contractsUsers.users;
        user1 = users.user1;
        user2 = users.user2;
        treasuryDao = users.treasuryDao;

        sdtBlackHole = contractsUsers.contracts.stakeDao.sdtBlackHole;
        blackHoleAddress = await sdtBlackHole.getAddress();
        cvgSdtBuffer = contractsUsers.contracts.stakeDao.cvgSdtBuffer;
        sdt = contractsUsers.contracts.tokens.sdt;

        await sdt.connect(user1).transfer(blackHoleAddress, 100n);
    });

    it("Failure : delegateSdPower with random user  should be revert the owner", async () => {
        const id = encodeBytes32String("1");
        await sdtBlackHole
            .connect(user1)
            .delegateSdPower(id, await user2.getAddress())
            .should.be.rejectedWith("Ownable: caller is not the owner");
    });

    it("Failure : withdraw directly should be revert ONLY_SD_ASSET_STAKING ", async () => {
        await sdtBlackHole.connect(user1).withdraw(sdtBlackHole, 100n).should.be.rejectedWith("ONLY_SD_ASSET_STAKING");
    });

    it("Success : delegateSdPower with none authorized user  should  emit  ", async () => {
        const id = encodeBytes32String("1");

        const tx = await sdtBlackHole.delegateSdPower(id, await user2.getAddress());
        await expect(tx)
            .to.emit(sdtBlackHole, "DelegateSdPower")
            .withArgs(id, await user2.getAddress());
    });
});
