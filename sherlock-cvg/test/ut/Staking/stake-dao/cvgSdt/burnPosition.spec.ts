import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {ethers} from "hardhat";
import {Signer} from "ethers";
import {expect} from "chai";
import {CvgControlTower, IFeeDistributor, SdtStakingPositionManager} from "../../../../../typechain-types";

import {ERC20} from "../../../../../typechain-types/@openzeppelin/contracts/token/ERC20";
import {Cvg, CvgSDT} from "../../../../../typechain-types/contracts/Token";
import {deploySdtStakingFixture} from "../../../../fixtures/fixtures";
import {LockingPositionService} from "../../../../../typechain-types/contracts/Locking";
import {IContractsUser} from "../../../../../utils/contractInterface";
import {GaugeController} from "../../../../../typechain-types-vyper/GaugeController";
import {CvgSdtBuffer, SdtStakingPositionService} from "../../../../../typechain-types";
import {MINT, TOKEN_4} from "../../../../../resources/constant";
import {TypedContractEvent, TypedDeferredTopicFilter} from "../../../../../typechain-types/common";
import {ClaimCvgMultipleEvent, ClaimCvgSdtMultipleEvent} from "../../../../../typechain-types/contracts/Staking/StakeDAO/SdtStakingPositionService";

describe("cvgSdtStaking - Burn Position ", () => {
    let contractsUsers: IContractsUser;
    let owner: Signer, user3: Signer, veSdtMultisig: Signer;
    let cvgSdtStakingContract: SdtStakingPositionService,
        gaugeController: GaugeController,
        lockingPositionService: LockingPositionService,
        sdtStakingPositionManager: SdtStakingPositionManager;

    let sdt: ERC20, cvg: Cvg, cvgSdt: CvgSDT;

    let depositedAmountToken4 = ethers.parseEther("5000"),
        depositedAmountToken5 = ethers.parseEther("100000");
    before(async () => {
        contractsUsers = await loadFixture(deploySdtStakingFixture);

        const users = contractsUsers.users;
        const contracts = contractsUsers.contracts;
        const stakeDao = contracts.stakeDao;
        const tokens = contracts.tokens;
        const tokensStakeDao = contracts.tokensStakeDao;

        owner = users.owner;
        user3 = users.user3;
        veSdtMultisig = users.veSdtMultisig;

        sdtStakingPositionManager = stakeDao.sdtStakingPositionManager;
        cvgSdtStakingContract = stakeDao.cvgSdtStaking;

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
        await cvgSdt.transfer(user3, ethers.parseEther("1000000"));
        await cvgSdt.transfer(veSdtMultisig, ethers.parseEther("1000000"));
        // approve cvgSdt spending from staking contract
        await cvgSdt.connect(user3).approve(cvgSdtStakingContract, ethers.MaxUint256);

        // deposit for user3
        await cvgSdtStakingContract.connect(user3).deposit(MINT, depositedAmountToken4, ethers.ZeroAddress);
    });

    it("Fail: try to mint directly through the stakingPositionManager should revert", async () => {
        await sdtStakingPositionManager.mint(owner).should.be.revertedWith("NOT_STAKING");
    });

    it("Fail: burn tokenId with non tokenId owner should revert", async () => {
        await sdtStakingPositionManager.burn(TOKEN_4).should.be.revertedWith("TOKEN_NOT_OWNED");
    });

    it("Fail: burn tokenId with staked amount should revert", async () => {
        await sdtStakingPositionManager.connect(user3).burn(TOKEN_4).should.be.revertedWith("TOTAL_STAKED_NOT_EMPTY");
    });

    it("Success: withdraw all staked amount", async () => {
        await cvgSdtStakingContract.connect(user3).withdraw(TOKEN_4, depositedAmountToken4);
    });

    it("Success: burn tokenId without staked amount", async () => {
        expect(await sdtStakingPositionManager.balanceOf(user3)).to.be.equal(1);
        await sdtStakingPositionManager.connect(user3).burn(TOKEN_4);
        expect(await sdtStakingPositionManager.balanceOf(user3)).to.be.equal(0);
    });
});
