import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {Signer} from "ethers";
import {ethers} from "hardhat";
import {ERC20, SdtStakingPositionService, SdtUtilities, CloneFactory, CvgSDT, ICrvPoolPlain} from "../../../../../typechain-types";
import {IContractsUser, IUsers} from "../../../../../utils/contractInterface";
import {deploySdtStakingFixture} from "../../../../fixtures/fixtures";
import {
    CYCLE_2,
    ONE_ETHER,
    ONE_HUNDRED_ETHER,
    TEN_ETHER,
    TEN_THOUSEN_ETHER,
    THREE_ETHER,
    TOKEN_4,
    TOKEN_5,
    TOKEN_6,
    TWO_ETHER,
} from "../../../../../resources/constant";
import {expect} from "chai";

describe("SdtUtilities - Convert & stake CvgSdt", () => {
    let contractsUsers: IContractsUser, users: IUsers;
    let user1: Signer, treasuryDao: Signer, veSdtMultisig: Signer;

    let sdt: ERC20, cvgSdt: CvgSDT;
    let sdtUtilities: SdtUtilities, stablePoolCvgSdt: ICrvPoolPlain;
    let cvgSdtStaking: SdtStakingPositionService;

    before(async () => {
        contractsUsers = await loadFixture(deploySdtStakingFixture);
        const tokens = contractsUsers.contracts.tokens;

        users = contractsUsers.users;
        veSdtMultisig = users.veSdtMultisig;
        user1 = users.user1;
        treasuryDao = users.treasuryDao;
        sdtUtilities = contractsUsers.contracts.stakeDao.sdtUtilities;

        cvgSdtStaking = contractsUsers.contracts.stakeDao.cvgSdtStaking;
        sdt = tokens.sdt;
        cvgSdt = tokens.cvgSdt;

        stablePoolCvgSdt = contractsUsers.contracts.lp.stablePoolCvgSdt;

        await sdtUtilities.setStablePool(cvgSdt, stablePoolCvgSdt);
    });

    it("Success : Approve tokens", async () => {
        await sdtUtilities.approveTokens([
            {token: cvgSdt, spender: cvgSdtStaking, amount: ethers.MaxUint256},
            {token: sdt, spender: cvgSdt, amount: ethers.MaxUint256},
            {token: sdt, spender: stablePoolCvgSdt, amount: ethers.MaxUint256},
        ]);

        await sdt.connect(user1).approve(cvgSdt, ethers.MaxUint256);
        await sdt.connect(user1).approve(sdtUtilities, ethers.MaxUint256);
        await cvgSdt.connect(user1).approve(sdtUtilities, ethers.MaxUint256);
    });

    it("Success : Get some CvgSdt", async () => {
        const tx = cvgSdt.connect(user1).mint(user1, TEN_THOUSEN_ETHER);

        await expect(tx).to.changeTokenBalances(sdt, [user1, veSdtMultisig], [-TEN_THOUSEN_ETHER, TEN_THOUSEN_ETHER]);
        await expect(tx).to.changeTokenBalance(cvgSdt, user1, TEN_THOUSEN_ETHER);
    });

    it("Success : Create position X/X", async () => {
        const tx = sdtUtilities.connect(user1).convertAndStakeCvgSdt(0, ONE_ETHER, ONE_HUNDRED_ETHER);

        await expect(tx).to.changeTokenBalances(sdt, [user1, veSdtMultisig], [-ONE_HUNDRED_ETHER, ONE_HUNDRED_ETHER]);
        await expect(tx).to.changeTokenBalances(cvgSdt, [user1, cvgSdtStaking], [-ONE_ETHER, ONE_HUNDRED_ETHER + ONE_ETHER]);

        expect(await cvgSdtStaking.tokenInfoByCycle(CYCLE_2, TOKEN_4)).to.deep.eq([ONE_HUNDRED_ETHER + ONE_ETHER, ONE_HUNDRED_ETHER + ONE_ETHER]);
    });

    it("Success : Create position 0/X", async () => {
        const tx = await sdtUtilities.connect(user1).convertAndStakeCvgSdt(0, 0, TEN_ETHER);

        await expect(tx).to.changeTokenBalances(sdt, [user1, veSdtMultisig], [-TEN_ETHER, TEN_ETHER]);
        await expect(tx).to.changeTokenBalances(cvgSdt, [cvgSdtStaking], [TEN_ETHER]);

        expect(await cvgSdtStaking.tokenInfoByCycle(CYCLE_2, TOKEN_5)).to.deep.eq([TEN_ETHER, TEN_ETHER]);
    });

    it("Success : Create position X/0", async () => {
        const tx = await sdtUtilities.connect(user1).convertAndStakeCvgSdt(0, THREE_ETHER, 0);

        await expect(tx).to.changeTokenBalances(cvgSdt, [user1, cvgSdtStaking], [-THREE_ETHER, THREE_ETHER]);

        expect(await cvgSdtStaking.tokenInfoByCycle(CYCLE_2, TOKEN_6)).to.deep.eq([THREE_ETHER, THREE_ETHER]);
    });

    it("Success : Reverse the Peg by selling some CvgSdt", async () => {
        const lpStable = await ethers.getContractAt("ICrvPoolPlain", stablePoolCvgSdt);
        await sdt.connect(user1).approve(lpStable, ethers.MaxUint256);
        await cvgSdt.connect(user1).approve(lpStable, ethers.MaxUint256);

        await lpStable.connect(user1).exchange(1, 0, ethers.parseEther("500"), 0, user1);
    });

    it("Success : Swap & stake CvgSdt through swapping in LP", async () => {
        let balanceDelta = await cvgSdt.balanceOf(cvgSdtStaking);

        const tx = sdtUtilities.connect(user1).convertAndStakeCvgSdt(4, THREE_ETHER, THREE_ETHER);

        // Here veSdtMultisig doesn't receive any Sdt because the swap is performed through the LP
        await expect(tx).to.changeTokenBalances(sdt, [user1, veSdtMultisig], [-THREE_ETHER, 0]);
        balanceDelta = (await cvgSdt.balanceOf(cvgSdtStaking)) - balanceDelta;
        expect(balanceDelta).to.be.gte((THREE_ETHER * 105n) / 100n);

        await expect(tx).to.changeTokenBalances(cvgSdt, [user1, cvgSdtStaking], [-THREE_ETHER, balanceDelta]);

        expect(await cvgSdtStaking.tokenInfoByCycle(CYCLE_2, TOKEN_4)).to.deep.eq([
            ONE_HUNDRED_ETHER + ONE_ETHER + balanceDelta,
            ONE_HUNDRED_ETHER + ONE_ETHER + balanceDelta,
        ]);
    });
});
