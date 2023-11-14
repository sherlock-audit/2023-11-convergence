import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {ethers} from "hardhat";
import {Signer} from "ethers";
import {expect} from "chai";
import {ICrvPoolPlain, IFeeDistributor} from "../../../../../typechain-types";

import {ERC20} from "../../../../../typechain-types/@openzeppelin/contracts/token/ERC20";
import {Cvg, CvgSDT} from "../../../../../typechain-types/contracts/Token";
import {deploySdtStakingFixture, increaseCvgCycle} from "../../../../fixtures/fixtures";
import {LockingPositionService} from "../../../../../typechain-types/contracts/Locking";
import {IContractsUser} from "../../../../../utils/contractInterface";
import {GaugeController} from "../../../../../typechain-types-vyper/GaugeController";
import {CvgSdtBuffer, SdtStakingPositionService} from "../../../../../typechain-types";
import {getExpectedCvgSdtRewards} from "../../../../../utils/stakeDao/getStakingShareForCycle";
import {CLAIMER_REWARDS_PERCENTAGE, CYCLE_2, CYCLE_3, DENOMINATOR, MINT, TOKEN_4, TOKEN_5} from "../../../../../resources/constant";
import {TypedContractEvent, TypedDeferredTopicFilter} from "../../../../../typechain-types/common";
import {ClaimCvgMultipleEvent, ClaimCvgSdtMultipleEvent} from "../../../../../typechain-types/contracts/Staking/StakeDAO/SdtStakingPositionService";

describe("cvgSdtStaking - Claim CvgSdt Rewards With Swap Or Mint", () => {
    let contractsUsers: IContractsUser;
    let owner: Signer, user1: Signer, user2: Signer, user3: Signer, veSdtMultisig: Signer;
    let cvgSdtStakingContract: SdtStakingPositionService,
        cvgSdtBuffer: CvgSdtBuffer,
        gaugeController: GaugeController,
        lockingPositionService: LockingPositionService;
    let poolCvgSdt: ICrvPoolPlain;
    let sdt: ERC20, cvg: Cvg, cvgSdt: CvgSDT, sdFRAX3CRV: ERC20;

    let depositedAmountToken4 = ethers.parseEther("5000"),
        depositedAmountToken5 = ethers.parseEther("100000"),
        withdrawAmount = ethers.parseEther("4000");
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
        user3 = users.user3;
        veSdtMultisig = users.veSdtMultisig;

        cvgSdtStakingContract = stakeDao.cvgSdtStaking;
        cvgSdtBuffer = stakeDao.cvgSdtBuffer;
        gaugeController = contracts.locking.gaugeController;
        lockingPositionService = contracts.locking.lockingPositionService;
        poolCvgSdt = contracts.lp.stablePoolCvgSdt;
        cvg = tokens.cvg;
        cvgSdt = tokens.cvgSdt;
        sdt = tokens.sdt;
        sdFRAX3CRV = tokensStakeDao.sdFrax3Crv;

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
        await cvgSdt.connect(user3).approve(cvgSdtStakingContract, ethers.MaxUint256);

        // deposit for user1 and user2
        await cvgSdtStakingContract.connect(user1).deposit(MINT, depositedAmountToken4, ethers.ZeroAddress);
        await cvgSdtStakingContract.connect(user2).deposit(MINT, depositedAmountToken5, ethers.ZeroAddress);
    });

    it("Success : Processing rewards & Updating cvg cycle to 1", async () => {
        await increaseCvgCycle(contractsUsers, 1);
        expect(await cvgSdtStakingContract.stakingCycle()).to.be.equal(CYCLE_2);
    });

    it("Success : Withdrawing user2 at cycle 2", async () => {
        await cvgSdtStakingContract.connect(user2).withdraw(TOKEN_5, withdrawAmount);
        expect(await cvgSdtStakingContract.stakingHistoryByToken(TOKEN_5, 0)).to.be.eq(CYCLE_2);
        expect(await cvgSdtStakingContract.tokenInfoByCycle(CYCLE_2, TOKEN_5)).to.be.deep.eq([depositedAmountToken5 - withdrawAmount, depositedAmountToken5]);
        expect(await cvgSdtStakingContract.tokenInfoByCycle(CYCLE_3, TOKEN_5)).to.be.deep.eq([depositedAmountToken5 - withdrawAmount, 0]);
        expect(await cvgSdtStakingContract.cycleInfo(CYCLE_2)).to.be.deep.eq([0, depositedAmountToken4 + depositedAmountToken5 - withdrawAmount, false, false]);
        expect(await cvgSdtStakingContract.cycleInfo(CYCLE_3)).to.be.deep.eq([0, depositedAmountToken4 + depositedAmountToken5 - withdrawAmount, false, false]);
    });

    it("Success : Processing rewards & update cvg cycle to 3 should compute right infos", async () => {
        await increaseCvgCycle(contractsUsers, 1);
        expect(await cvgSdtStakingContract.stakingCycle()).to.be.equal(CYCLE_3);
    });
    it("Success : Processing Sdt rewards for cycle 2 ", async () => {
        const amountSdt = ethers.parseEther("1000");
        const amountCvgSdt = ethers.parseEther("400");
        //rewards distribution
        await sdt.connect(veSdtMultisig).transfer(cvgSdtBuffer, amountSdt);
        await cvgSdt.connect(veSdtMultisig).transfer(cvgSdtBuffer, amountCvgSdt);
        //process
        await cvgSdtStakingContract.connect(veSdtMultisig).processSdtRewards();

        const rewardForCycle = await cvgSdtStakingContract.getProcessedSdtRewards(2);
        const expectedSdtAmount = (amountSdt * (DENOMINATOR - CLAIMER_REWARDS_PERCENTAGE)) / DENOMINATOR;
        const expectedCvgSdtAmount = (amountCvgSdt * (DENOMINATOR - CLAIMER_REWARDS_PERCENTAGE)) / DENOMINATOR;
        expect(rewardForCycle[0]).to.deep.eq([await sdt.getAddress(), expectedSdtAmount]);
        expect(rewardForCycle[1].token).to.be.equal(await sdFRAX3CRV.getAddress());
        expect(rewardForCycle[1].amount).to.be.gt("0"); //=> amount of SdFRAX3CRV that cannot be determinated
        expect(rewardForCycle[2]).to.deep.eq([await cvgSdt.getAddress(), expectedCvgSdtAmount]);
    });
    it("Success : ClaimCvgSdtRewards for cycle 2 with convert and mint", async () => {
        const cycle2RewardsExpected = await getExpectedCvgSdtRewards(cvgSdtStakingContract, TOKEN_4, CYCLE_2);
        const sdtRewards = cycle2RewardsExpected[1];
        const cvgSdtRewards = cycle2RewardsExpected[3];
        const tx = cvgSdtStakingContract.connect(user1).claimCvgSdtRewards(TOKEN_4, true, true);
        await expect(tx).to.changeTokenBalances(sdt, [user1], [0]);
        await expect(tx).to.changeTokenBalances(cvgSdt, [user1], [sdtRewards + cvgSdtRewards]);
    });
    it("Success : ClaimCvgSdtRewards for cycle 2 with convert only", async () => {
        const cycle2RewardsExpected = await getExpectedCvgSdtRewards(cvgSdtStakingContract, TOKEN_5, CYCLE_2);
        const sdtRewards = cycle2RewardsExpected[1];
        const sdt_dy = await poolCvgSdt.get_dy(0, 1, sdtRewards);
        const cvgSdtRewards = cycle2RewardsExpected[3];
        const tx = cvgSdtStakingContract.connect(user2).claimCvgSdtRewards(TOKEN_5, true, false);
        await expect(tx).to.changeTokenBalances(sdt, [user2], [0]);
        await expect(tx).to.changeTokenBalances(cvgSdt, [user2], [sdt_dy + cvgSdtRewards]);
    });
});
