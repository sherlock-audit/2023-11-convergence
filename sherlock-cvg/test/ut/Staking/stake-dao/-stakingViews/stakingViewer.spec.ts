import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {
    CvgControlTower,
    SdtBlackHole,
    SdtStakingViewer,
    CloneFactory,
    SdtStakingPositionManager,
    ISdAssetGauge, SdtStakingPositionService, ERC20
} from "../../../../../typechain-types";
import {IContractsUser, IUsers} from "../../../../../utils/contractInterface";
import {deploySdtStakingFixture, increaseCvgCycle} from "../../../../fixtures/fixtures";
import {expect} from "chai";
import {TypedDeferredTopicFilter, TypedContractEvent} from "../../../../../typechain-types/common";
import {SdtStakingCreatedEvent} from "../../../../../typechain-types/contracts/CloneFactory";
import {
    TOKEN_ADDR_FRXETH_ETH_GAUGE, TOKEN_ADDR_SD_CRV_GAUGE,
    TOKEN_ADDR_TRICRYPTO_1_GAUGE,
    TOKEN_ADDR_TRICRYPTO_2_GAUGE,
    TOKEN_ADDR_TRICRYPTO_3_GAUGE,
} from "../../../../../resources/tokens/stake-dao";
import {getAllGaugeRewardsSdt} from "../../../../../utils/stakeDao/getGaugeRewardsSdt";
import {takesGaugeOwnershipAndSetDistributor} from "../../../../../utils/stakeDao/takesGaugeOwnershipAndSetDistributor";
import {Signer} from "ethers";
import {distributeGaugeRewards} from "../../../../../utils/stakeDao/distributeGaugeRewards";
import {ethers} from "hardhat";

describe("SdtStakingViewer - Test view function SDT", () => {
    let contractsUsers: IContractsUser, users: IUsers, owner: Signer;
    let cloneFactory: CloneFactory,
        sdtBlackHole: SdtBlackHole,
        sdtStakingViewer: SdtStakingViewer,
        cvgControlTower: CvgControlTower,
        sdtStakingPositionManager: SdtStakingPositionManager,
        sdCrvGauge: ISdAssetGauge,
        sdCrvStaking: SdtStakingPositionService;

    let sdt: ERC20, crv: ERC20, _3crv: ERC20;

    let sdCrvStakingAddress: string,
        sdAngleStakingAddress: string,
        sdFxsStakingAddress: string,
        sdBalStakingAddress: string,
        sdPendleStakingAddress: string,
        cvgSdtStakingAddress: string;
    let filterCreateSdtStaking: TypedDeferredTopicFilter<
        TypedContractEvent<SdtStakingCreatedEvent.InputTuple, SdtStakingCreatedEvent.OutputTuple, SdtStakingCreatedEvent.OutputObject>
    >;

    let rootFees: bigint;

    before(async () => {
        contractsUsers = await loadFixture(deploySdtStakingFixture);

        users = contractsUsers.users;
        owner = users.owner;
        const stakeDao = contractsUsers.contracts.stakeDao;
        const sdAssetStakings = stakeDao.sdAssetsStaking;

        sdtBlackHole = stakeDao.sdtBlackHole;
        cvgControlTower = contractsUsers.contracts.base.cvgControlTower;
        cloneFactory = contractsUsers.contracts.base.cloneFactory;
        sdtStakingViewer = stakeDao.sdtStakingViewer;
        sdtStakingPositionManager = stakeDao.sdtStakingPositionManager;
        sdCrvGauge = contractsUsers.contracts.tokensStakeDao.sdCrvGauge;
        sdCrvStaking = sdAssetStakings.sdCRVStaking;

        sdt = contractsUsers.contracts.tokens.sdt;
        _3crv = contractsUsers.contracts.tokens._3crv;
        crv = contractsUsers.contracts.tokens.crv;

        sdCrvStakingAddress = await sdAssetStakings.sdCRVStaking.getAddress();
        sdAngleStakingAddress = await sdAssetStakings.sdANGLEStaking.getAddress();
        sdFxsStakingAddress = await sdAssetStakings.sdFXSStaking.getAddress();
        sdBalStakingAddress = await sdAssetStakings.sdBALStaking.getAddress();
        sdPendleStakingAddress = await sdAssetStakings.sdPENDLEStaking.getAddress();
        cvgSdtStakingAddress = await stakeDao.cvgSdtStaking.getAddress();
        filterCreateSdtStaking = contractsUsers.contracts.base.cloneFactory.filters.SdtStakingCreated(undefined, undefined, undefined);

        rootFees = await stakeDao.sdtFeeCollector.rootFees();
    });

    it("Success : Getting all SdAssets informations", async () => {
        const sdAssets = await cvgControlTower.getSdtStakings(0, 5);
        expect(sdAssets).to.deep.eq([
            [sdCrvStakingAddress, "Stake DAO sdCRV Gauge"],
            [sdAngleStakingAddress, "Stake DAO sdANGLE Gauge"],
            [sdFxsStakingAddress, "Stake DAO sdFXS Gauge"],
            [sdBalStakingAddress, "Stake DAO sdBal Gauge"],
            [sdPendleStakingAddress, "Stake DAO sdPENDLE Gauge"],
        ]);

        const sdAssetStakingView = await sdtStakingViewer.getGlobalViewSdAssetStaking(sdAssets.map((sdAsset) => sdAsset.stakingContract));
    });

    it("Success : Creating several LP assets", async () => {
        await cloneFactory.connect(users.treasuryDao).createSdtStakingAndBuffer(TOKEN_ADDR_TRICRYPTO_1_GAUGE, "TriCrypto1");
        await cloneFactory.connect(users.treasuryDao).createSdtStakingAndBuffer(TOKEN_ADDR_TRICRYPTO_2_GAUGE, "TriCrypto2");
        await cloneFactory.connect(users.treasuryDao).createSdtStakingAndBuffer(TOKEN_ADDR_TRICRYPTO_3_GAUGE, "TriCrypto3");
        await cloneFactory.connect(users.treasuryDao).createSdtStakingAndBuffer(TOKEN_ADDR_FRXETH_ETH_GAUGE, "FrxEth_Eth");
    });

    it("Success : Getting all LpAssets informations", async () => {
        const lpAssets = await cvgControlTower.getSdtStakings(6, 4);
        const lpAssetStakingView = await sdtStakingViewer.getGlobalViewLpAssetStaking(lpAssets.map((lpAsset) => lpAsset.stakingContract));
    });

    it("Success : Getting CvgSdt Staking", async () => {
        const cvgSdtStaking = await sdtStakingViewer.getGlobalViewCvgSdtStaking(cvgSdtStakingAddress);
    });

    it("Success : Getting token infos", async () => {
        const tokensUser1 = await sdtStakingPositionManager.getTokenIdsAndStakingContracts(users.user1);
        const tokensUser2 = await sdtStakingPositionManager.getTokenIdsAndStakingContracts(users.user2);

        const param1 = tokensUser1.map((tokenUser) => {
            return {stakingContract: tokenUser.stakingContract, tokenId: tokenUser.tokenId};
        });

        const param2 = tokensUser2.map((tokenUser) => {
            return {stakingContract: tokenUser.stakingContract, tokenId: tokenUser.tokenId};
        });

        const tokenViewUser1 = await sdtStakingViewer.getTokenViewSdtStaking(param1);
        const tokenViewUser2 = await sdtStakingViewer.getTokenViewSdtStaking(param2);
    });

    it('Checks claimable rewards amount for each sdAsset-gauge', async () => {
        await takesGaugeOwnershipAndSetDistributor(sdCrvGauge, owner);
        await increaseCvgCycle(contractsUsers, 1); // cycle 2
        await distributeGaugeRewards(
            sdCrvGauge,
            [
                {token: sdt, amount: ethers.parseEther("2000")},
                {token: crv, amount: ethers.parseEther("100000")},
                {token: _3crv, amount: ethers.parseEther("10")},
            ],
            owner
        );
        await increaseCvgCycle(contractsUsers, 1); // cycle 3

        const stakingContracts = await cvgControlTower.getSdtStakings(0, 100);
        const stakingProcessableRewards = await sdtStakingViewer.getProcessableRewardsOnSdtStakingContracts(stakingContracts.map(c => c.stakingContract));
        const sdCrvProcessableRewards = stakingProcessableRewards.find(reward => reward.sdAssetGauge === TOKEN_ADDR_SD_CRV_GAUGE);

        const gaugeRewards = await getAllGaugeRewardsSdt(sdCrvGauge, sdtBlackHole, rootFees);

        const processableRewards = sdCrvProcessableRewards?.processableData.map(data => ({
            token: data.rewardToken,
            amount: data.processableAmount
        }));
        const expectedClaimableRewards = await Promise.all(gaugeRewards.map(async rewards => ({
            token: await rewards.token.getAddress(),
            amount: rewards.total
        })));

        expect(processableRewards).to.deep.eq(expectedClaimableRewards);
    });
  
    it("Success : Getting apr data cvg/sdt", async () => {
        const aprDataCvg = await sdtStakingViewer.getAprDataCvg(1, [cvgSdtStakingAddress]);
        const aprDataSdt = await sdtStakingViewer.getAprDataSdt(1, [cvgSdtStakingAddress]);
    });
});
