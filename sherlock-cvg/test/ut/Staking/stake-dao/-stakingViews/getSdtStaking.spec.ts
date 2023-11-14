import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {SdtFeeCollector, CvgControlTower, SdtBlackHole, SdtStakingViewer} from "../../../../../typechain-types";
import {IContractsUser, IUsers} from "../../../../../utils/contractInterface";
import {deploySdtStakingFixture} from "../../../../fixtures/fixtures";
import {expect} from "chai";

describe("CvgControlTower - Test view function SDT", () => {
    let contractsUsers: IContractsUser, users: IUsers;
    let sdtFeeCollector: SdtFeeCollector, sdtBlackHole: SdtBlackHole, sdtStakingViewer: SdtStakingViewer, cvgControlTower: CvgControlTower;
    let sdCrvStakingAddress: string,
        sdAngleStakingAddress: string,
        sdFxsStakingAddress: string,
        sdBalStakingAddress: string,
        sdPendleStakingAddress: string,
        sdFXNStakingAddress: string;

    before(async () => {
        contractsUsers = await loadFixture(deploySdtStakingFixture);

        users = contractsUsers.users;
        const stakeDao = contractsUsers.contracts.stakeDao;
        const sdAssetStakings = stakeDao.sdAssetsStaking;

        sdtBlackHole = stakeDao.sdtBlackHole;
        cvgControlTower = contractsUsers.contracts.base.cvgControlTower;
        sdtFeeCollector = stakeDao.sdtFeeCollector;
        sdtStakingViewer = stakeDao.sdtStakingViewer;

        sdCrvStakingAddress = await sdAssetStakings.sdCRVStaking.getAddress();
        sdAngleStakingAddress = await sdAssetStakings.sdANGLEStaking.getAddress();
        sdFxsStakingAddress = await sdAssetStakings.sdFXSStaking.getAddress();
        sdBalStakingAddress = await sdAssetStakings.sdBALStaking.getAddress();
        sdPendleStakingAddress = await sdAssetStakings.sdPENDLEStaking.getAddress();
        sdFXNStakingAddress = await sdAssetStakings.sdFXNStaking.getAddress();
    });

    it("Success : Getting all Sdt Staking contracts with length desired bigger than full length", async () => {
        expect(await cvgControlTower.getSdtStakings(0, 50)).to.deep.eq([
            [sdCrvStakingAddress, "Stake DAO sdCRV Gauge"],
            [sdAngleStakingAddress, "Stake DAO sdANGLE Gauge"],
            [sdFxsStakingAddress, "Stake DAO sdFXS Gauge"],
            [sdBalStakingAddress, "Stake DAO sdBal Gauge"],
            [sdPendleStakingAddress, "Stake DAO sdPENDLE Gauge"],
            [sdFXNStakingAddress, "Stake DAO sdFXN Gauge"],
        ]);
    });

    it("Success : Getting all Sdt Staking contracts with cursor not 0", async () => {
        expect(await cvgControlTower.getSdtStakings(2, 50)).to.deep.eq([
            [sdFxsStakingAddress, "Stake DAO sdFXS Gauge"],
            [sdBalStakingAddress, "Stake DAO sdBal Gauge"],
            [sdPendleStakingAddress, "Stake DAO sdPENDLE Gauge"],
            [sdFXNStakingAddress, "Stake DAO sdFXN Gauge"],
        ]);
    });

    it("Success : Getting all Sdt Staking contracts with length smaller than end of the array", async () => {
        expect(await cvgControlTower.getSdtStakings(2, 2)).to.deep.eq([
            [sdFxsStakingAddress, "Stake DAO sdFXS Gauge"],
            [sdBalStakingAddress, "Stake DAO sdBal Gauge"],
        ]);
    });

    it("Success : Getting all Sdt Staking contracts with length eq 1", async () => {
        expect(await cvgControlTower.getSdtStakings(3, 1)).to.deep.eq([[sdBalStakingAddress, "Stake DAO sdBal Gauge"]]);
    });
});
