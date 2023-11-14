import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import {ethers} from "hardhat";
import {Signer, EventLog} from "ethers";
import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {deployCloneFactoryFixture, deploySdtStakingFixture} from "../../fixtures/fixtures";
import {CloneFactory, CvgControlTower, SdtStakingPositionService} from "../../../typechain-types";
import {IContracts, IUsers, IContractsUser} from "../../../utils/contractInterface";
import {TOKEN_ADDR_SD_CRV_GAUGE} from "../../../resources/tokens/stake-dao";
import {TRANSFER_ERC20} from "../../../resources/signatures";
chai.use(chaiAsPromised).should();
const expect = chai.expect;

describe("Clone Factory Create sdtStaking", () => {
    let treasuryDao: Signer;
    let controlTowerContract: CvgControlTower;
    let cloneFactoryContract: CloneFactory;
    let baseSdAssetStakingContract: SdtStakingPositionService;
    let contractsUsers: IContractsUser, contracts: IContracts, users: IUsers;

    const stakingTokenAddress = TOKEN_ADDR_SD_CRV_GAUGE; // sdCRV-gauge

    before(async () => {
        contractsUsers = await loadFixture(deploySdtStakingFixture);
        contracts = contractsUsers.contracts;
        users = contractsUsers.users;

        controlTowerContract = contracts.base.cvgControlTower;
        cloneFactoryContract = contracts.base.cloneFactory;
        baseSdAssetStakingContract = contracts.stakeDao.baseSdAssetStaking;

        treasuryDao = users.treasuryDao;
    });

    it("Initialize base sdAssetStaking contract should be reverted", async () => {
        const sigWithdraw = TRANSFER_ERC20;
        const withdrawCallInfo = {
            addr: ethers.ZeroAddress,
            signature: sigWithdraw,
        };
        await baseSdAssetStakingContract
            .initialize(await controlTowerContract.getAddress(), stakingTokenAddress, "STK-sdCRV-gauge", true, withdrawCallInfo)
            .should.be.revertedWith("Initializable: contract is already initialized");
    });

    it("Creates staking contract", async () => {
        // cannot check event args because we can't anticipate the address of the created contract
        const tx = await cloneFactoryContract.connect(treasuryDao).createSdtStakingAndBuffer(stakingTokenAddress, "STK-sdCRV-gauge");
        await expect(tx, "Create staking contract should emit SdtStakingCreated event").to.emit(cloneFactoryContract, "SdtStakingCreated");

        const receipt = await tx.wait();
        const event = (receipt!.logs as EventLog[]).find((e) => e?.fragment?.name === "SdtStakingCreated");
        const stakingContract = await ethers.getContractAt("SdtStakingPositionService", event?.args.stakingClone);
        const stakingContractAddress = await stakingContract.getAddress();

        expect(await stakingContract.symbol()).to.be.eq("STK-sdCRV-gauge");
        expect(await stakingContract.stakingAsset()).to.be.eq(event?.args.gaugeAsset);
        expect(await stakingContract.buffer()).to.be.eq(event?.args.bufferClone);

        expect(await controlTowerContract.isSdtStaking(stakingContractAddress)).to.be.true;
        expect(await controlTowerContract.sdAndLpAssetStaking(6)).to.be.equal(stakingContractAddress);
    });
});
