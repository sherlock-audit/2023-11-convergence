import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {Signer} from "ethers";
import {ethers} from "hardhat";
import {
    SdtFeeCollector,
    CvgControlTower,
    SdtBuffer,
    ERC20,
    ISdAsset,
    IOperator,
    SdtStakingPositionService,
    ISdAssetGauge,
    SdtUtilities,
    SdtBlackHole,
} from "../../../../../typechain-types";
import {IContractsUser, IUsers} from "../../../../../utils/contractInterface";
import {deploySdtStakingFixture} from "../../../../fixtures/fixtures";
import {expect} from "chai";
import {
    CYCLE_2,
    ONE_ETHER,
    ONE_HUNDRED_ETHER,
    TEN_ETHER,
    THREE_ETHER,
    TOKEN_10,
    TOKEN_4,
    TOKEN_5,
    TOKEN_6,
    TOKEN_7,
    TOKEN_8,
    TOKEN_9,
    TWO_ETHER,
} from "../../../../../resources/constant";
import {CRV_DUO_SDCRV_CRV} from "../../../../../resources/lp";

describe("SdtUtilities - Convert & stake CRV", () => {
    let contractsUsers: IContractsUser, users: IUsers;
    let owner: Signer, user1: Signer, user2: Signer, treasuryDao: Signer;
    let sdtFeeCollector: SdtFeeCollector, sdtBlackHole: SdtBlackHole, cvgControlTower: CvgControlTower, sdCrvStakingBuffer: SdtBuffer;
    let sdt: ERC20, crv: ERC20, _3crv: ERC20, _80bal_20weth: ERC20, sdCrv: ISdAsset, sdBal: ISdAsset, operatorSdCrv: IOperator, operatorSdBal: IOperator;
    let sdCRVStaking: SdtStakingPositionService,
        sdBALStaking: SdtStakingPositionService,
        sdCrvGauge: ISdAssetGauge,
        sdBalGauge: ISdAssetGauge,
        sdtUtilities: SdtUtilities;

    before(async () => {
        contractsUsers = await loadFixture(deploySdtStakingFixture);
        const tokens = contractsUsers.contracts.tokens;
        const tokensStakeDao = contractsUsers.contracts.tokensStakeDao;

        users = contractsUsers.users;
        owner = users.owner;
        user1 = users.user1;
        user2 = users.user2;
        treasuryDao = users.treasuryDao;
        sdtBlackHole = contractsUsers.contracts.stakeDao.sdtBlackHole;
        cvgControlTower = contractsUsers.contracts.base.cvgControlTower;
        sdtFeeCollector = contractsUsers.contracts.stakeDao.sdtFeeCollector;
        sdtUtilities = contractsUsers.contracts.stakeDao.sdtUtilities;

        sdCRVStaking = contractsUsers.contracts.stakeDao.sdAssetsStaking.sdCRVStaking;
        sdBALStaking = contractsUsers.contracts.stakeDao.sdAssetsStaking.sdBALStaking;
        sdCrvStakingBuffer = await ethers.getContractAt("SdtBuffer", await sdCRVStaking.buffer());
        sdCrvGauge = tokensStakeDao.sdCrvGauge;
        sdCrv = tokensStakeDao.sdCrv;
        sdBal = tokensStakeDao.sdBal;
        sdBalGauge = tokensStakeDao.sdBalGauge;
        _80bal_20weth = tokensStakeDao._80bal_20weth;

        operatorSdCrv = await ethers.getContractAt("IOperator", await sdCrv.operator());
        operatorSdBal = await ethers.getContractAt("IOperator", await sdBal.operator());

        sdt = tokens.sdt;
        _3crv = tokens._3crv;
        crv = tokens.crv;

        await sdtUtilities.approveTokens([
            {token: sdCrvGauge, spender: sdCRVStaking, amount: ethers.MaxUint256},
            {token: sdCrv, spender: sdCrvGauge, amount: ethers.MaxUint256},
            {token: crv, spender: CRV_DUO_SDCRV_CRV, amount: ethers.MaxUint256},
            {token: crv, spender: operatorSdCrv, amount: ethers.MaxUint256},
            //
            {token: sdBalGauge, spender: sdBALStaking, amount: ethers.MaxUint256},
            {token: sdBal, spender: sdBalGauge, amount: ethers.MaxUint256},
            {token: _80bal_20weth, spender: operatorSdBal, amount: ethers.MaxUint256},
        ]);

        await sdtUtilities.setStablePool(sdCrv, CRV_DUO_SDCRV_CRV);

        await crv.connect(user1).approve(sdtUtilities, ethers.MaxUint256);
        await sdCrv.connect(user1).approve(sdtUtilities, ethers.MaxUint256);
        await sdCrvGauge.connect(user1).approve(sdtUtilities, ethers.MaxUint256);
        await _80bal_20weth.connect(user1).approve(sdtUtilities, ethers.MaxUint256);

        await crv.connect(user2).approve(sdtUtilities, ethers.MaxUint256);
        await sdCrv.connect(user2).approve(sdtUtilities, ethers.MaxUint256);
        await sdCrvGauge.connect(user2).approve(sdtUtilities, ethers.MaxUint256);
        await _80bal_20weth.connect(user2).approve(sdtUtilities, ethers.MaxUint256);
    });

    it("Success : Create position X/X/X", async () => {
        const sdCrvGaugeBalanceOfBlackHoleBefore = await sdCrvGauge.balanceOf(sdtBlackHole);
        const tx = sdtUtilities.connect(user1).convertAndStakeSdAsset(0, sdCRVStaking, ONE_ETHER, TWO_ETHER, THREE_ETHER, false);
        await expect(tx).to.changeTokenBalance(crv, user1, -THREE_ETHER);
        await expect(tx).to.changeTokenBalance(sdCrv, user1, -TWO_ETHER);
        const sdCrvGaugeDelta = (await sdCrvGauge.balanceOf(sdtBlackHole)) - sdCrvGaugeBalanceOfBlackHoleBefore;

        await expect(tx).to.changeTokenBalances(sdCrvGauge, [user1, sdtBlackHole], [-ONE_ETHER, sdCrvGaugeDelta]);

        expect(await sdCRVStaking.tokenInfoByCycle(CYCLE_2, TOKEN_4)).to.be.deep.eq([sdCrvGaugeDelta, sdCrvGaugeDelta]);
    });

    it("Success : Create position 0/0/X", async () => {
        const sdCrvGaugeBalanceOfBlackHoleBefore = await sdCrvGauge.balanceOf(sdtBlackHole);
        const tx = sdtUtilities.connect(user1).convertAndStakeSdAsset(0, sdCRVStaking, 0, 0, ONE_HUNDRED_ETHER, false);
        await expect(tx).to.changeTokenBalance(crv, user1, -ONE_HUNDRED_ETHER);
        const sdCrvGaugeDelta = (await sdCrvGauge.balanceOf(sdtBlackHole)) - sdCrvGaugeBalanceOfBlackHoleBefore;

        await expect(tx).to.changeTokenBalances(sdCrvGauge, [sdtBlackHole], [sdCrvGaugeDelta]);

        expect(await sdCRVStaking.tokenInfoByCycle(CYCLE_2, TOKEN_5)).to.be.deep.eq([sdCrvGaugeDelta, sdCrvGaugeDelta]);
    });

    it("Success : Create position X/0/X", async () => {
        const sdCrvGaugeBalanceOfBlackHoleBefore = await sdCrvGauge.balanceOf(sdtBlackHole);
        const tx = sdtUtilities.connect(user1).convertAndStakeSdAsset(0, sdCRVStaking, ONE_HUNDRED_ETHER, 0, TEN_ETHER, false);
        await expect(tx).to.changeTokenBalance(crv, user1, -TEN_ETHER);
        await expect(tx).to.changeTokenBalance(sdCrv, user1, 0);
        const sdCrvGaugeDelta = (await sdCrvGauge.balanceOf(sdtBlackHole)) - sdCrvGaugeBalanceOfBlackHoleBefore;
        await expect(tx).to.changeTokenBalances(sdCrvGauge, [user1, sdtBlackHole], [-ONE_HUNDRED_ETHER, sdCrvGaugeDelta]);

        expect(await sdCRVStaking.tokenInfoByCycle(CYCLE_2, TOKEN_6)).to.be.deep.eq([sdCrvGaugeDelta, sdCrvGaugeDelta]);
    });

    it("Success : Create position 0/X/0", async () => {
        const sdCrvGaugeBalanceOfBlackHoleBefore = await sdCrvGauge.balanceOf(sdtBlackHole);
        const tx = sdtUtilities.connect(user1).convertAndStakeSdAsset(0, sdCRVStaking, 0, TWO_ETHER, 0, false);
        await expect(tx).to.changeTokenBalance(crv, user1, 0);
        await expect(tx).to.changeTokenBalance(sdCrv, user1, -TWO_ETHER);
        const sdCrvGaugeDelta = (await sdCrvGauge.balanceOf(sdtBlackHole)) - sdCrvGaugeBalanceOfBlackHoleBefore;
        await expect(tx).to.changeTokenBalances(sdCrvGauge, [user1, sdtBlackHole], [0, sdCrvGaugeDelta]);

        expect(await sdCRVStaking.tokenInfoByCycle(CYCLE_2, TOKEN_7)).to.be.deep.eq([sdCrvGaugeDelta, sdCrvGaugeDelta]);
    });

    it("Success : Create position 0/X/X", async () => {
        const sdCrvGaugeBalanceOfBlackHoleBefore = await sdCrvGauge.balanceOf(sdtBlackHole);
        const tx = sdtUtilities.connect(user1).convertAndStakeSdAsset(0, sdCRVStaking, 0, TEN_ETHER, ONE_ETHER, false);
        await expect(tx).to.changeTokenBalance(crv, user1, -ONE_ETHER);
        await expect(tx).to.changeTokenBalance(sdCrv, user1, -TEN_ETHER);
        const sdCrvGaugeDelta = (await sdCrvGauge.balanceOf(sdtBlackHole)) - sdCrvGaugeBalanceOfBlackHoleBefore;
        await expect(tx).to.changeTokenBalances(sdCrvGauge, [user1, sdtBlackHole], [0, sdCrvGaugeDelta]);

        expect(await sdCRVStaking.tokenInfoByCycle(CYCLE_2, TOKEN_8)).to.be.deep.eq([sdCrvGaugeDelta, sdCrvGaugeDelta]);
    });

    it("Success : Create position X/0/0", async () => {
        const sdCrvGaugeBalanceOfBlackHoleBefore = await sdCrvGauge.balanceOf(sdtBlackHole);
        const tx = sdtUtilities.connect(user1).convertAndStakeSdAsset(0, sdCRVStaking, ONE_HUNDRED_ETHER, 0, 0, false);
        await expect(tx).to.changeTokenBalance(crv, user1, 0);
        await expect(tx).to.changeTokenBalance(sdCrv, user1, 0);
        const sdCrvGaugeDelta = (await sdCrvGauge.balanceOf(sdtBlackHole)) - sdCrvGaugeBalanceOfBlackHoleBefore;
        await expect(tx).to.changeTokenBalances(sdCrvGauge, [user1, sdtBlackHole], [-ONE_HUNDRED_ETHER, sdCrvGaugeDelta]);

        expect(await sdCRVStaking.tokenInfoByCycle(CYCLE_2, TOKEN_9)).to.be.deep.eq([sdCrvGaugeDelta, sdCrvGaugeDelta]);
    });

    it("Success : Reverse the Peg by selling 2M CRV", async () => {
        const lpStable = await ethers.getContractAt("ICrvPoolPlain", CRV_DUO_SDCRV_CRV);
        const amount = ethers.parseEther("1");
        const dybefore = await lpStable.get_dy(0, 1, amount);
        await sdCrv.connect(user1).approve(lpStable, ethers.MaxUint256);
        await lpStable.connect(user1).exchange(1, 0, ethers.parseEther("9000000"), 0, user1);
        const dy = await lpStable.get_dy(0, 1, amount);
    });

    it("Success : Create position though minting 1:1", async () => {
        const sdCrvGaugeBalanceOfBlackHoleBefore = await sdCrvGauge.balanceOf(sdtBlackHole);

        const tx = sdtUtilities.connect(user1).convertAndStakeSdAsset(0, sdCRVStaking, ONE_ETHER, TWO_ETHER, THREE_ETHER, false);
        await expect(tx).to.changeTokenBalance(crv, user1, -THREE_ETHER);
        await expect(tx).to.changeTokenBalance(sdCrv, user1, -TWO_ETHER);
        const sdCrvGaugeDelta = (await sdCrvGauge.balanceOf(sdtBlackHole)) - sdCrvGaugeBalanceOfBlackHoleBefore;

        await expect(tx).to.changeTokenBalances(sdCrvGauge, [user1, sdtBlackHole], [-ONE_ETHER, sdCrvGaugeDelta]);

        expect(await sdCRVStaking.tokenInfoByCycle(CYCLE_2, TOKEN_10)).to.be.deep.eq([sdCrvGaugeDelta, sdCrvGaugeDelta]);
    });

    it("Success : Create position 0/0/X without stable pool setted", async () => {
        const sdBalGaugeBalanceOfBlackHoleBefore = await sdBalGauge.balanceOf(sdtBlackHole);
        const tx = sdtUtilities.connect(user1).convertAndStakeSdAsset(0, sdBALStaking, 0, 0, ONE_HUNDRED_ETHER, false);
        await expect(tx).to.changeTokenBalance(_80bal_20weth, user1, -ONE_HUNDRED_ETHER);
        const sdBalGaugeDelta = (await sdBalGauge.balanceOf(sdtBlackHole)) - sdBalGaugeBalanceOfBlackHoleBefore;

        await expect(tx).to.changeTokenBalances(sdBalGauge, [sdtBlackHole], [sdBalGaugeDelta]);

        expect(await sdBALStaking.tokenInfoByCycle(CYCLE_2, 11)).to.be.deep.eq([sdBalGaugeDelta, sdBalGaugeDelta]);
    });
});
