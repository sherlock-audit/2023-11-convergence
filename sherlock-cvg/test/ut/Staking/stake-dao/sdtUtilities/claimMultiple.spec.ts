import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {Signer, EventLog} from "ethers";
import hardhat, {ethers} from "hardhat";
import {
    ERC20,
    SdtStakingPositionService,
    ISdAssetGauge,
    SdtUtilities,
    SdtRewardReceiver,
    ILpStakeDaoStrat,
    CloneFactory,
    LockingPositionService,
    ICrvPoolPlain,
} from "../../../../../typechain-types";
import {IContractsUser, IUsers} from "../../../../../utils/contractInterface";
import {deploySdtStakingFixture, increaseCvgCycle} from "../../../../fixtures/fixtures";
import {takesGaugeOwnershipAndSetDistributor} from "../../../../../utils/stakeDao/takesGaugeOwnershipAndSetDistributor";
import {distributeGaugeRewards} from "../../../../../utils/stakeDao/distributeGaugeRewards";
import {
    CYCLE_2,
    CYCLE_3,
    CYCLE_4,
    MINT,
    TOKEN_1,
    TOKEN_10,
    TOKEN_11,
    TOKEN_12,
    TOKEN_3,
    TOKEN_4,
    TOKEN_5,
    TOKEN_6,
    TOKEN_7,
    TOKEN_8,
    TOKEN_9,
} from "../../../../../resources/constant";
import {expect} from "chai";
import {CRV_DUO_FRXETH_ETH, CRV_TRI_CRYPTO_LLAMA} from "../../../../../resources/lp";
import {
    TOKEN_ADDR_FRXETH_ETH_GAUGE,
    TOKEN_ADDR_FRXETH_ETH_STRAT,
    TOKEN_ADDR_TRILLAMA_GAUGE,
    TOKEN_ADDR_TRILLAMA_STRAT,
} from "../../../../../resources/tokens/stake-dao";
import {GaugeController} from "../../../../../typechain-types-vyper";
import {getExpectedCvgSdtRewards} from "../../../../../utils/stakeDao/getStakingShareForCycle";

describe("SdtUtilities - Claim Multiple Sdt", () => {
    let contractsUsers: IContractsUser, users: IUsers;
    let owner: Signer, user1: Signer;

    let sdt: ERC20,
        crv: ERC20,
        _3crv: ERC20,
        bal: ERC20,
        bbAUsd: ERC20,
        crvCRVUSDTBTCWSTETHLp: ERC20,
        fraxEthEthLp: ERC20,
        cvg: ERC20,
        cvgSdt: ERC20,
        usdc: ERC20;
    let sdCRVStaking: SdtStakingPositionService,
        sdBALStaking: SdtStakingPositionService,
        triCryptoLlamaStaking: SdtStakingPositionService,
        fraxEthEthStaking: SdtStakingPositionService,
        sdtRewardReceiver: SdtRewardReceiver;
    let crvCRVUSDTBTCWSTETHStrat: ILpStakeDaoStrat, fraxEthEthStrat: ILpStakeDaoStrat, cvgSdtPool: ICrvPoolPlain;
    let sdCrvGauge: ISdAssetGauge,
        sdBALGauge: ISdAssetGauge,
        sdFXSGauge: ISdAssetGauge,
        crvCRVUSDTBTCWSTETHGauge: ISdAssetGauge,
        fraxEthEthGauge: ISdAssetGauge;
    let cloneFactory: CloneFactory, gaugeController: GaugeController, lockingPositionService: LockingPositionService;

    before(async () => {
        contractsUsers = await loadFixture(deploySdtStakingFixture);
        const tokens = contractsUsers.contracts.tokens;
        const tokensStakeDao = contractsUsers.contracts.tokensStakeDao;

        cloneFactory = contractsUsers.contracts.base.cloneFactory;

        gaugeController = contractsUsers.contracts.locking.gaugeController;
        lockingPositionService = contractsUsers.contracts.locking.lockingPositionService;
        users = contractsUsers.users;
        owner = users.owner;
        user1 = users.user1;

        sdCRVStaking = contractsUsers.contracts.stakeDao.sdAssetsStaking.sdCRVStaking;
        sdBALStaking = contractsUsers.contracts.stakeDao.sdAssetsStaking.sdBALStaking;
        sdBALStaking = contractsUsers.contracts.stakeDao.sdAssetsStaking.sdBALStaking;

        sdtRewardReceiver = contractsUsers.contracts.stakeDao.sdtRewardReceiver;

        sdCrvGauge = tokensStakeDao.sdCrvGauge;
        sdBALGauge = tokensStakeDao.sdBalGauge;
        sdFXSGauge = tokensStakeDao.sdFxsGauge;

        cvgSdtPool = contractsUsers.contracts.lp.stablePoolCvgSdt;

        crvCRVUSDTBTCWSTETHLp = await ethers.getContractAt("ERC20", CRV_TRI_CRYPTO_LLAMA);
        crvCRVUSDTBTCWSTETHStrat = await ethers.getContractAt("ILpStakeDaoStrat", TOKEN_ADDR_TRILLAMA_STRAT);
        crvCRVUSDTBTCWSTETHGauge = await ethers.getContractAt("ISdAssetGauge", TOKEN_ADDR_TRILLAMA_GAUGE);

        fraxEthEthLp = await ethers.getContractAt("ERC20", CRV_DUO_FRXETH_ETH);
        fraxEthEthStrat = await ethers.getContractAt("ILpStakeDaoStrat", TOKEN_ADDR_FRXETH_ETH_STRAT);
        fraxEthEthGauge = await ethers.getContractAt("ISdAssetGauge", TOKEN_ADDR_FRXETH_ETH_GAUGE);

        cvg = tokens.cvg;
        sdt = tokens.sdt;
        _3crv = tokens._3crv;
        crv = tokens.crv;
        cvgSdt = tokens.cvgSdt;
        usdc = tokens.usdc;

        sdt = tokens.sdt;
        bal = tokensStakeDao.bal;
        bbAUsd = tokensStakeDao.bbAUsd;
    });

    it("Success : Get a locking position for voting", async () => {
        await lockingPositionService.connect(users.user2).mintPosition(95, ethers.parseEther("10"), 0, users.user2, true);
    });

    it("Success : Mint some positions on sdCRV", async () => {
        await sdCRVStaking.connect(user1).deposit(MINT, ethers.parseEther("200"), ethers.ZeroAddress);
        await sdCRVStaking.connect(user1).deposit(MINT, ethers.parseEther("90000"), ethers.ZeroAddress);
        await sdCRVStaking.connect(user1).deposit(MINT, ethers.parseEther("90000"), ethers.ZeroAddress);
        await sdCRVStaking.connect(user1).deposit(MINT, ethers.parseEther("90000"), ethers.ZeroAddress);
        await sdCRVStaking.connect(user1).deposit(MINT, ethers.parseEther("90000"), ethers.ZeroAddress);
    });

    it("Success : Takes the ownership of the gauge contract and set reward distributor", async () => {
        await takesGaugeOwnershipAndSetDistributor(sdCrvGauge, owner);
        await takesGaugeOwnershipAndSetDistributor(sdBALGauge, owner);
        await takesGaugeOwnershipAndSetDistributor(sdFXSGauge, owner);
        await takesGaugeOwnershipAndSetDistributor(crvCRVUSDTBTCWSTETHGauge, owner);
        await takesGaugeOwnershipAndSetDistributor(fraxEthEthGauge, owner);
    });

    /**
     *
     *              CYCLE 2
     *
     */

    it("Success : Go to cycle 2", async () => {
        await increaseCvgCycle(contractsUsers, 1);
    });

    it("Success : Distributes gauges rewards for sdCRV", async () => {
        await distributeGaugeRewards(
            sdCrvGauge,
            [
                {token: sdt, amount: ethers.parseEther("2000")},
                {token: crv, amount: ethers.parseEther("100000")},
                {token: _3crv, amount: ethers.parseEther("10")},
            ],
            owner
        );
    });

    it("Success : Distributing gauges rewards for sdBAL", async () => {
        await distributeGaugeRewards(
            sdBALGauge,
            [
                {token: sdt, amount: ethers.parseEther("2000")},
                {token: bbAUsd, amount: ethers.parseEther("100000")},
                {token: usdc, amount: ethers.parseUnits("1000", 6)},
                {token: bal, amount: ethers.parseEther("10")},
            ],
            owner
        );
    });

    it("Success : Distributes gauges rewards for Trillama", async () => {
        await distributeGaugeRewards(
            crvCRVUSDTBTCWSTETHGauge,
            [
                {token: sdt, amount: ethers.parseEther("2000")},
                {token: crv, amount: ethers.parseEther("100000")},
            ],
            owner
        );
    });

    it("Success : Distributes gauges rewards for FraxEthEth", async () => {
        await distributeGaugeRewards(
            fraxEthEthGauge,
            [
                {token: sdt, amount: ethers.parseEther("5000")},
                {token: crv, amount: ethers.parseEther("100000")},
            ],
            owner
        );
    });
    /**
     *
     *              CYCLE 3
     *
     */
    it("Success : Go to cycle 3", async () => {
        await increaseCvgCycle(contractsUsers, 1);
    });

    it("Success : processing rewards on CRV for cycle 2", async () => {
        await sdCRVStaking.processSdtRewards();
        await sdBALStaking.processSdtRewards();
    });

    it("Success : Claim the Cvg for Token 4 for cycle 2", async () => {
        const rewards = await getExpectedCvgSdtRewards(sdCRVStaking, TOKEN_4, CYCLE_2);
        const claimCvgTx = sdCRVStaking.connect(users.user1).claimCvgRewards(TOKEN_4);

        await expect(claimCvgTx).to.changeTokenBalance(cvg, users.user1, rewards[0]);
    });

    it("Success : Claim the CvgSdt for Token 5 for cycle 2", async () => {
        const rewards = await getExpectedCvgSdtRewards(sdCRVStaking, TOKEN_5, CYCLE_2);
        const claimCvgSdtTx = sdCRVStaking.connect(users.user1).claimCvgSdtRewards(TOKEN_5, false, false);

        await expect(claimCvgSdtTx).to.changeTokenBalance(cvg, users.user1, rewards[0]);
        await expect(claimCvgSdtTx).to.changeTokenBalances(sdt, [sdtRewardReceiver, users.user1], [-rewards[1], rewards[1]]);
        await expect(claimCvgSdtTx).to.changeTokenBalances(_3crv, [sdtRewardReceiver, users.user1], [-rewards[2], rewards[2]]);
        await expect(claimCvgSdtTx).to.changeTokenBalances(crv, [sdtRewardReceiver, users.user1], [-rewards[3], rewards[3]]);
    });

    it("Success : Distributes gauges rewards in SDT, CRV & 3CRV ", async () => {
        await distributeGaugeRewards(
            sdCrvGauge,
            [
                {token: sdt, amount: ethers.parseEther("2000")},
                {token: crv, amount: ethers.parseEther("100000")},
                {token: _3crv, amount: ethers.parseEther("10")},
            ],
            owner
        );
    });

    it("Success : Distributing gauges rewards in SDT, BBAUSD & BAL ", async () => {
        await distributeGaugeRewards(
            sdBALGauge,
            [
                {token: sdt, amount: ethers.parseEther("2000")},
                {token: usdc, amount: ethers.parseUnits("100000", 6)},
                {token: bal, amount: ethers.parseEther("10")},
            ],
            owner
        );
    });

    /**
     *
     *  DEPLOY NEW STAKING CONTRACT
     *
     */
    it("Success : Get Gauge token Trillama through Strategy", async () => {
        await crvCRVUSDTBTCWSTETHLp.connect(user1).approve(crvCRVUSDTBTCWSTETHStrat, ethers.MaxUint256);
        await crvCRVUSDTBTCWSTETHStrat.connect(user1).deposit(user1, ethers.parseEther("1000000"), true);
    });

    it("Success : Get Gauge FraxEthEth through Strategy", async () => {
        await fraxEthEthLp.connect(user1).approve(fraxEthEthStrat, ethers.MaxUint256);
        await fraxEthEthStrat.connect(user1).deposit(user1, ethers.parseEther("1000000"), true);
    });

    it("Success : Create Staking contract Trillama at cycle 3", async () => {
        const createTx = await cloneFactory.connect(users.treasuryDao).createSdtStakingAndBuffer(crvCRVUSDTBTCWSTETHGauge, "CVG_LAMA");

        const receipt1 = await createTx.wait();
        const logs = receipt1?.logs as EventLog[];
        const events1 = logs.filter((e) => e.fragment && e.fragment.name === "SdtStakingCreated");
        const args = events1[0].args;

        triCryptoLlamaStaking = await ethers.getContractAt("SdtStakingPositionService", args.stakingClone);
        // triCryptoLlamaStaking = await ethers.getContractAt("SdtBuffer", args.bufferClone);

        await gaugeController.connect(users.treasuryDao).add_gauge(triCryptoLlamaStaking, 0, 0);
    });

    it("Success : Create Staking contract fraxEthEth at cycle 3", async () => {
        const createTx = await cloneFactory.connect(users.treasuryDao).createSdtStakingAndBuffer(fraxEthEthGauge, "fraxETH");

        const receipt1 = await createTx.wait();
        const logs = receipt1?.logs as EventLog[];
        const events1 = logs.filter((e) => e.fragment && e.fragment.name === "SdtStakingCreated");
        const args = events1[0].args;

        fraxEthEthStaking = await ethers.getContractAt("SdtStakingPositionService", args.stakingClone);
        // triCryptoLlamaStaking = await ethers.getContractAt("SdtBuffer", args.bufferClone);

        await gaugeController.connect(users.treasuryDao).add_gauge(fraxEthEthStaking, 0, 0);
    });

    /**
     *
     *  ----------------------------------------------------------------
     *
     */

    it("Success : Mint some positions on fraxEthEth & Trillama", async () => {
        await fraxEthEthGauge.connect(user1).approve(fraxEthEthStaking, ethers.MaxUint256);
        await crvCRVUSDTBTCWSTETHGauge.connect(user1).approve(triCryptoLlamaStaking, ethers.MaxUint256);

        await triCryptoLlamaStaking.connect(user1).deposit(MINT, 1, ethers.ZeroAddress);
        await triCryptoLlamaStaking.connect(user1).deposit(MINT, ethers.parseEther("10000"), ethers.ZeroAddress);
        await triCryptoLlamaStaking.connect(user1).deposit(MINT, ethers.parseEther("45.36"), ethers.ZeroAddress);

        await fraxEthEthStaking.connect(user1).deposit(MINT, ethers.parseEther("200"), ethers.ZeroAddress);
        await fraxEthEthStaking.connect(user1).deposit(MINT, ethers.parseEther("5000"), ethers.ZeroAddress);
        await fraxEthEthStaking.connect(user1).deposit(MINT, ethers.parseEther("1"), ethers.ZeroAddress);
    });

    it("Fails : Try processing rewards on contracts just deployed", async () => {
        await expect(triCryptoLlamaStaking.processSdtRewards()).to.be.rejectedWith("NO_STAKERS");
        await expect(fraxEthEthStaking.processSdtRewards()).to.be.rejectedWith("NO_STAKERS");
    });

    it("Fails : Try to claim on some token claimable and 1 not claimable", async () => {
        await expect(
            sdtRewardReceiver.connect(user1).claimMultipleStaking(
                [
                    {stakingContract: sdCRVStaking, tokenIds: [TOKEN_1, TOKEN_4, TOKEN_5, TOKEN_6, TOKEN_7, TOKEN_8]},
                    {stakingContract: triCryptoLlamaStaking, tokenIds: [TOKEN_9]},
                ],
                false,
                false,
                6
            )
        ).to.be.rejectedWith("ALL_SDT_CLAIMED_FOR_NOW");
    });

    /**
     *
     *              CYCLE 4
     *
     */

    it("Success : Go to cycle 4", async () => {
        await increaseCvgCycle(contractsUsers, 1);
    });

    it("Success : processing rewards on sdCRV for cycle 3. Don't process BAL.", async () => {
        await sdCRVStaking.processSdtRewards();
    });

    it("Success : Claim on sdCRV and sdBAL. BAL doesn't receive cycle 4.", async () => {
        const [rewardsToken1Cycle2, rewardsToken1Cycle3, rewardsToken3Cycle2, rewardsToken3Cycle3] = await Promise.all([
            await getExpectedCvgSdtRewards(sdCRVStaking, TOKEN_1, CYCLE_2),
            await getExpectedCvgSdtRewards(sdCRVStaking, TOKEN_1, CYCLE_3),

            await getExpectedCvgSdtRewards(sdBALStaking, TOKEN_3, CYCLE_2),
            await getExpectedCvgSdtRewards(sdBALStaking, TOKEN_3, CYCLE_3),
        ]);
        // Cycle 2 & 3 claimed on both tokens
        const cvgExpected = rewardsToken1Cycle2[0] + rewardsToken3Cycle2[0] + rewardsToken1Cycle3[0] + rewardsToken3Cycle3[0];

        // Only Cycle 2 is claimable for Token 3 as not yet processed on sdBal
        const sdtExpected = rewardsToken1Cycle2[1] + rewardsToken3Cycle2[1] + rewardsToken1Cycle3[1];

        // Rewards of cycle 2 & 3 from SdCRV
        const _3CrvClaimable = rewardsToken1Cycle2[2] + rewardsToken1Cycle3[2];
        const crvClaimable = rewardsToken1Cycle2[3] + rewardsToken1Cycle3[3];

        // Rewards of cycle 2 only from sdBAL
        const bbaUsdClaimable = rewardsToken3Cycle2[2];
        const balClaimable = rewardsToken3Cycle2[3];
        const usdcClaimable = rewardsToken3Cycle2[4];

        const claimTx = sdtRewardReceiver.connect(user1).claimMultipleStaking(
            [
                {stakingContract: sdCRVStaking, tokenIds: [TOKEN_1]},
                {stakingContract: sdBALStaking, tokenIds: [TOKEN_3]},
            ],
            true,
            true,
            6
        );

        await expect(claimTx).to.be.changeTokenBalance(cvg, user1, cvgExpected);

        await expect(claimTx).to.be.changeTokenBalance(cvgSdt, user1, sdtExpected);
        await expect(claimTx).to.be.changeTokenBalances(sdt, [sdtRewardReceiver, users.veSdtMultisig], [-sdtExpected, sdtExpected]);

        await expect(claimTx).to.be.changeTokenBalances(_3crv, [sdtRewardReceiver, user1], [-_3CrvClaimable, _3CrvClaimable]);
        await expect(claimTx).to.be.changeTokenBalances(crv, [sdtRewardReceiver, user1], [-crvClaimable, crvClaimable]);

        await expect(claimTx).to.be.changeTokenBalances(bbAUsd, [sdtRewardReceiver, user1], [-bbaUsdClaimable, bbaUsdClaimable]);
        await expect(claimTx).to.be.changeTokenBalances(bal, [sdtRewardReceiver, user1], [-balClaimable, balClaimable]);
        await expect(claimTx).to.be.changeTokenBalances(usdc, [sdtRewardReceiver, user1], [-usdcClaimable, usdcClaimable]);
    });

    it("Success : Activate votes on the deployed gauges 1 cycle later & vote on it ", async () => {
        await gaugeController.connect(users.treasuryDao).toggle_vote_pause(triCryptoLlamaStaking);
        await gaugeController.connect(users.treasuryDao).toggle_vote_pause(fraxEthEthStaking);

        await gaugeController.connect(users.user2).multi_vote([
            {
                tokenId: TOKEN_5,
                votes: [
                    {gauge_address: triCryptoLlamaStaking, weight: 20n},
                    {gauge_address: fraxEthEthStaking, weight: 20n},
                ],
            },
        ]);
    });

    it("Fails : Try to claim Cvg & CvgSdt on a Staking created on the cycle before, didn't accumulate rewards", async () => {
        await expect(triCryptoLlamaStaking.connect(user1).claimCvgRewards(TOKEN_9)).to.be.rejectedWith("ALL_CVG_CLAIMED_FOR_NOW");
        await expect(triCryptoLlamaStaking.connect(user1).claimCvgSdtRewards(TOKEN_9, false, false)).to.be.rejectedWith("ALL_SDT_CLAIMED_FOR_NOW");
    });

    it("Success : Distributes gauges rewards in SDCRV ", async () => {
        await distributeGaugeRewards(
            sdCrvGauge,
            [
                {token: sdt, amount: ethers.parseEther("2000")},
                {token: crv, amount: ethers.parseEther("100000")},
                {token: _3crv, amount: ethers.parseEther("10")},
            ],
            owner
        );
    });

    it("Success : Distributing gauges rewards in SDBAL ", async () => {
        await distributeGaugeRewards(
            sdBALGauge,
            [
                {token: sdt, amount: ethers.parseEther("2000")},
                {token: bbAUsd, amount: ethers.parseEther("100000")},
                {token: bal, amount: ethers.parseEther("10")},
            ],
            owner
        );
    });

    it("Success : Distributes gauges rewards in Trillama  ", async () => {
        await distributeGaugeRewards(
            crvCRVUSDTBTCWSTETHGauge,
            [
                {token: sdt, amount: ethers.parseEther("2000")},
                {token: crv, amount: ethers.parseEther("1")},
            ],
            owner
        );
    });

    it("Success : Distributing gauges rewards in FraxETHETH ", async () => {
        await distributeGaugeRewards(
            fraxEthEthGauge,
            [
                {token: sdt, amount: ethers.parseEther("10")},
                {token: crv, amount: ethers.parseEther("500")},
            ],
            owner
        );
    });

    /**
     *
     *              CYCLE 5
     *
     */

    it("Success : Go to cycle 5", async () => {
        await increaseCvgCycle(contractsUsers, 1);
    });

    it("Success : processing rewards on CRV for cycle 4 for all ", async () => {
        await sdCRVStaking.processSdtRewards();
        await sdBALStaking.processSdtRewards();
        await triCryptoLlamaStaking.processSdtRewards();
        await fraxEthEthStaking.processSdtRewards();
    });

    it("Fails : Claim on a very small position. No cvg are claimable", async () => {
        await expect(triCryptoLlamaStaking.connect(user1).claimCvgRewards(TOKEN_9)).to.be.rejectedWith("NO_CVG_TO_CLAIM");
    });

    it("Success : Claim the Cvg for the cycle 4 on TriLLama.", async () => {
        const rewards = await getExpectedCvgSdtRewards(triCryptoLlamaStaking, TOKEN_10, CYCLE_4);

        const claimTx = triCryptoLlamaStaking.connect(user1).claimCvgRewards(TOKEN_10);

        await expect(claimTx).to.changeTokenBalance(cvg, user1, rewards[0]);
    });

    it("Success : Claim on one contract", async () => {
        const [
            rewardsToken1Cycle4,

            // rewardsToken3Cycle2,
            // rewardsToken3Cycle3,
            rewardsToken3Cycle4,

            rewardsToken4Cycle2,
            rewardsToken4Cycle3,
            rewardsToken4Cycle4,

            rewardsToken5Cycle3,
            rewardsToken5Cycle4,

            rewardsToken9Cycle4,

            rewardsToken12Cycle4,
        ] = await Promise.all([
            await getExpectedCvgSdtRewards(sdCRVStaking, TOKEN_1, CYCLE_4),

            // await getExpectedCvgSdtRewards(sdCRVStaking, TOKEN_3, CYCLE_2),
            // await getExpectedCvgSdtRewards(sdCRVStaking, TOKEN_3, CYCLE_3),
            await getExpectedCvgSdtRewards(sdBALStaking, TOKEN_3, CYCLE_4),

            await getExpectedCvgSdtRewards(sdCRVStaking, TOKEN_4, CYCLE_2),
            await getExpectedCvgSdtRewards(sdCRVStaking, TOKEN_4, CYCLE_3),
            await getExpectedCvgSdtRewards(sdCRVStaking, TOKEN_4, CYCLE_4),

            await getExpectedCvgSdtRewards(sdCRVStaking, TOKEN_5, CYCLE_3),
            await getExpectedCvgSdtRewards(sdCRVStaking, TOKEN_5, CYCLE_4),

            await getExpectedCvgSdtRewards(sdCRVStaking, TOKEN_9, CYCLE_4),
            await getExpectedCvgSdtRewards(sdCRVStaking, TOKEN_12, CYCLE_4),
        ]);

        const cvgExpected =
            rewardsToken1Cycle4[0] +
            rewardsToken3Cycle4[0] +
            rewardsToken4Cycle3[0] +
            rewardsToken4Cycle4[0] +
            rewardsToken5Cycle3[0] +
            rewardsToken5Cycle4[0] +
            rewardsToken9Cycle4[0] +
            rewardsToken12Cycle4[0];

        const sdtExpected =
            rewardsToken1Cycle4[1] +
            rewardsToken3Cycle4[1] +
            rewardsToken4Cycle2[1] +
            rewardsToken4Cycle3[1] +
            rewardsToken4Cycle4[1] +
            rewardsToken5Cycle3[1] +
            rewardsToken5Cycle4[1] +
            rewardsToken9Cycle4[1] +
            rewardsToken12Cycle4[1];

        // // Only Cycle 2 is claimable for Token 3 as not yet processed on sdBal
        // const sdtExpected = rewardsToken1Cycle2[1] + rewardsToken3Cycle2[1] + rewardsToken1Cycle3[1];

        // // Rewards of cycle 2 & 3 from SdCRV
        // const _3CrvClaimable = rewardsToken1Cycle2[2] + rewardsToken1Cycle3[2];
        // const crvClaimable = rewardsToken1Cycle2[3] + rewardsToken1Cycle3[3];

        // // Rewards of cycle 2 only from sdBAL
        // const bbaUsdClaimable = rewardsToken3Cycle2[2];
        // const balClaimable = rewardsToken3Cycle2[3];
        // const usdcClaimable = rewardsToken3Cycle2[4];

        const claimTx = sdtRewardReceiver.connect(user1).claimMultipleStaking(
            [
                {stakingContract: sdCRVStaking, tokenIds: [TOKEN_1, TOKEN_4, TOKEN_5]},
                {stakingContract: sdBALStaking, tokenIds: [TOKEN_3]},
                // {stakingContract: triCryptoLlamaStaking, tokenIds: [TOKEN_9]},
                // {stakingContract: fraxEthEthStaking, tokenIds: [TOKEN_12]},
            ],
            true,
            false,
            6
        );

        await expect(claimTx).to.changeTokenBalance(cvg, user1, cvgExpected);
        await expect(claimTx).to.changeTokenBalances(sdt, [sdtRewardReceiver, cvgSdtPool], [-sdtExpected, sdtExpected]);
    });
});
