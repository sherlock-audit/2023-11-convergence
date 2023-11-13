import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {ethers} from "hardhat";
import {Signer} from "ethers";
import {expect} from "chai";
import {ERC20} from "../../../typechain-types/@openzeppelin/contracts/token/ERC20";
import {Cvg, CvgSDT} from "../../../typechain-types/contracts/Token";
import {deploySdtStakingFixture} from "../../fixtures/fixtures";
import {LockingPositionService} from "../../../typechain-types/contracts/Locking";
import {IContractsUser} from "../../../utils/contractInterface";
import {GaugeController} from "../../../typechain-types-vyper";
import {SdtStakingPositionService} from "../../../typechain-types";
import {MINT, TOKEN_4} from "../../../resources/constant";
import {time} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import {SdtStakingPositionManager} from "../../../typechain-types";
import {setStorageAt} from "@nomicfoundation/hardhat-network-helpers";

describe("Coverage Staking ", () => {
    let contractsUsers: IContractsUser;
    let owner: Signer, user1: Signer, user2: Signer, veSdtMultisig: Signer;
    let cvgSdtStakingContract: SdtStakingPositionService,
        gaugeController: GaugeController,
        lockingPositionService: LockingPositionService,
        sdtStakingPositionManager: SdtStakingPositionManager;
    let sdt: ERC20, cvg: Cvg, cvgSdt: CvgSDT;

    let depositedAmountToken4 = ethers.parseEther("5000"),
        depositedAmountToken5 = ethers.parseEther("100000"),
        withdrawAmount = ethers.parseEther("4000"),
        depositedAmount = ethers.parseEther("3000");
    before(async () => {
        contractsUsers = await loadFixture(deploySdtStakingFixture);

        const users = contractsUsers.users;
        const contracts = contractsUsers.contracts;
        const stakeDao = contracts.stakeDao;
        const tokens = contracts.tokens;
        const tokensStakeDao = contracts.tokensStakeDao;

        owner = users.owner;
        user1 = users.user1;
        user2 = users.user2;
        veSdtMultisig = users.veSdtMultisig;

        cvgSdtStakingContract = stakeDao.cvgSdtStaking;
        sdtStakingPositionManager = stakeDao.sdtStakingPositionManager;

        gaugeController = contracts.locking.gaugeController;
        lockingPositionService = contracts.locking.lockingPositionService;
        cvg = tokens.cvg;
        cvgSdt = tokens.cvgSdt;
        sdt = tokens.sdt;

        // mint locking position and vote for cvgSdtStaking gauge
        await cvg.approve(lockingPositionService, ethers.parseEther("300000"));
        await lockingPositionService.mintPosition(47, ethers.parseEther("100000"), 0, owner, true);
        await gaugeController.simple_vote(5, cvgSdtStakingContract, 1000);
        await sdt.approve(cvgSdt, ethers.MaxUint256);

        // mint cvgSdt
        await cvgSdt.mint(owner, ethers.parseEther("3000000"));

        // transfer cvgSdt to users
        await cvgSdt.transfer(user1, ethers.parseEther("1000000"));
        await cvgSdt.transfer(user2, ethers.parseEther("1000000"));
        await cvgSdt.transfer(veSdtMultisig, ethers.parseEther("1000000"));
        // approve cvgSdt spending from staking contract
        await cvgSdt.connect(user1).approve(cvgSdtStakingContract, ethers.MaxUint256);
        await cvgSdt.connect(user2).approve(cvgSdtStakingContract, ethers.MaxUint256);

        // deposit for user1 and user2
        await cvgSdtStakingContract.connect(user1).deposit(MINT, depositedAmountToken4, ethers.ZeroAddress);
        await cvgSdtStakingContract.connect(user2).deposit(MINT, depositedAmountToken5, ethers.ZeroAddress);
    });
    it("initialize stakingPositionManager should revert", async () => {
        await sdtStakingPositionManager.initialize(user1).should.be.revertedWith("Initializable: contract is already initialized");
    });

    it("change withdrawCallInfo addr storage", async () => {
        const structSlot = 160;
        const paddedSlot = ethers.zeroPadValue(ethers.toBeHex(structSlot), 32);
        const newAddressPadded = ethers.zeroPadValue(await sdtStakingPositionManager.getAddress(), 32);
        await setStorageAt(await cvgSdtStakingContract.getAddress(), paddedSlot, newAddressPadded);
    });
    it("Fail: withdraw with wrong withdrawCallInfo signature", async () => {
        await cvgSdtStakingContract.connect(user1).withdraw(TOKEN_4, depositedAmountToken4).should.be.revertedWith("Failed to withdraw");
    });

    it("Success: Set lock for token4", async () => {
        const timestamp = await time.latest();
        await sdtStakingPositionManager.connect(user1).setLock(TOKEN_4, timestamp + 86400);
    });

    it("Fail: withdraw with token locked", async () => {
        await cvgSdtStakingContract.connect(user1).withdraw(TOKEN_4, depositedAmountToken4).should.be.revertedWith("TOKEN_TIMELOCKED");
    });

    it("check stakingPerTokenId", async () => {
        const infoToken = await sdtStakingPositionManager.getComplianceInfo(TOKEN_4);
        expect(infoToken[1]).to.be.equal(await cvgSdtStakingContract.getAddress());
    });
    it("change stakingPerTokenId storage", async () => {
        const mappingSlot = 356;
        const HexNumber = ethers.toBeHex(TOKEN_4);
        const paddedNumber = ethers.zeroPadValue(ethers.toBeHex(HexNumber), 32);
        const paddedSlot = ethers.zeroPadValue(ethers.toBeHex(mappingSlot), 32);
        const concatenated = ethers.concat([paddedNumber, paddedSlot]);
        const storageSlot = ethers.keccak256(concatenated);
        await setStorageAt(await sdtStakingPositionManager.getAddress(), storageSlot, ethers.ZeroAddress);
        const infoToken = await sdtStakingPositionManager.getComplianceInfo(TOKEN_4);
        expect(infoToken[1]).to.be.equal(ethers.ZeroAddress);
    });
    it("Fail: withdraw with wrong staking associated to tokenId", async () => {
        await cvgSdtStakingContract.connect(user1).withdraw(TOKEN_4, depositedAmountToken4).should.be.revertedWith("WRONG_STAKING");
    });
    it("Fail: deposit with token locked", async () => {
        await cvgSdtStakingContract.connect(user1).deposit(TOKEN_4, depositedAmountToken4, ethers.ZeroAddress).should.be.revertedWith("WRONG_STAKING");
    });
});
