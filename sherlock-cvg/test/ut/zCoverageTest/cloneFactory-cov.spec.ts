import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {ethers} from "hardhat";
import {Signer} from "ethers";
import {deployBondWithLockingFixture, deploySdtStakingFixture} from "../../fixtures/fixtures";
import {IContractsUser} from "../../../utils/contractInterface";
import {CloneFactory, CvgControlTower} from "../../../typechain-types";
import {WITHDRAW_SDT_BLACKHOLE} from "../../../resources/signatures";

describe("Coverage CloneFactory ", () => {
    let contractsUsers: IContractsUser;
    let owner: Signer, user1: Signer, user2: Signer, veSdtMultisig: Signer, treasuryDao: Signer;
    let cvgControlTower: CvgControlTower, cloneFactory: CloneFactory;

    before(async () => {
        contractsUsers = await loadFixture(deployBondWithLockingFixture);

        const users = contractsUsers.users;
        const contracts = contractsUsers.contracts;
        const stakeDao = contracts.stakeDao;
        const tokens = contracts.tokens;
        const tokensStakeDao = contracts.tokensStakeDao;

        owner = users.owner;
        user1 = users.user1;
        user2 = users.user2;
        treasuryDao = users.treasuryDao;
        veSdtMultisig = users.veSdtMultisig;
        cvgControlTower = contracts.base.cvgControlTower;
        cloneFactory = contracts.base.cloneFactory;
    });
    it("Fail: initialize cloneFactory", async () => {
        await cloneFactory.initialize(user1).should.be.revertedWith("Initializable: contract is already initialized");
    });
    it("Fail: createBond with random user", async () => {
        await cloneFactory
            .createBond(
                {
                    bondDuration: 86400 * 70,
                    maxCvgToMint: ethers.parseEther("1000000"),
                    minRoi: 5_000,
                    maxRoi: 65_000,
                    composedFunction: "0",
                    vestingTerm: 7_600,
                    token: contractsUsers.contracts.tokens.weth,
                    percentageMaxCvgToMint: 150, // 15% of the total of the bond
                    gamma: 250_000,
                    scale: 5_000,
                },
                1
            )
            .should.be.revertedWith("Ownable: caller is not the owner");
    });
    it("Fail: createSdtStakingAndBuffer with random user", async () => {
        await cloneFactory.createSdtStakingAndBuffer(owner, "test").should.be.revertedWith("Ownable: caller is not the owner");
    });
    it("Fail: setBeaconSdStaking with random user", async () => {
        await cloneFactory.setBeaconSdStaking(owner).should.be.revertedWith("Ownable: caller is not the owner");
    });
    it("Fail: setBeaconBuffer with random user", async () => {
        await cloneFactory.setBeaconBuffer(owner).should.be.revertedWith("Ownable: caller is not the owner");
    });
    it("Fail: setWithdrawCallInfo with random user", async () => {
        const withdrawCallInfo = {
            addr: await owner.getAddress(),
            signature: WITHDRAW_SDT_BLACKHOLE,
        };
        await cloneFactory.setWithdrawCallInfo(withdrawCallInfo).should.be.revertedWith("Ownable: caller is not the owner");
    });
});
