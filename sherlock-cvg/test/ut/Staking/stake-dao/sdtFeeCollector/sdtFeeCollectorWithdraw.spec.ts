import {loadFixture} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import {expect} from "chai";
import {ethers} from "hardhat";
import {Signer} from "ethers";
import {SdtFeeCollector, ERC20, CvgSdtBuffer} from "../../../../../typechain-types";
import {IContractsUser, IUsers} from "../../../../../utils/contractInterface";

import {deploySdtStakingFixture} from "../../../../fixtures/fixtures";

describe("SdtFeeCollector - Withdraw", () => {
    let contractsUsers: IContractsUser, users: IUsers;
    let treasuryBonds: Signer, treasuryDao: Signer;
    let sdtFeeCollector: SdtFeeCollector, cvgSdtBuffer: CvgSdtBuffer;
    let sdt: ERC20, usdc: ERC20;

    before(async () => {
        contractsUsers = await loadFixture(deploySdtStakingFixture);
        const tokens = contractsUsers.contracts.tokens;

        users = contractsUsers.users;

        treasuryBonds = users.treasuryBonds;
        treasuryDao = users.treasuryDao;

        sdtFeeCollector = contractsUsers.contracts.stakeDao.sdtFeeCollector;
        cvgSdtBuffer = contractsUsers.contracts.stakeDao.cvgSdtBuffer;

        sdt = tokens.sdt;
        usdc = tokens.usdc;
    });
    const sdtAmount = ethers.parseEther("10000");
    const usdcAmount = ethers.parseUnits("5000", 6);
    it("Success : Send some fees to the FeeCollector", async () => {
        await sdt.transfer(sdtFeeCollector, sdtAmount);
        await usdc.transfer(sdtFeeCollector, usdcAmount);
    });

    it("Success : Withdraw SDT & USDC fees", async () => {
        const withdrawTx = sdtFeeCollector.connect(treasuryDao).withdrawSdt();
        await expect(withdrawTx).to.changeTokenBalances(
            sdt,
            [sdtFeeCollector, cvgSdtBuffer, treasuryBonds],
            [-sdtAmount, (sdtAmount * 71_500n) / 100_000n, (sdtAmount * 28_500n) / 100_000n]
        );
    });
});
