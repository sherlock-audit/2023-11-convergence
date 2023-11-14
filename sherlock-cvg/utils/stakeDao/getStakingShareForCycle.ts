import {SdtStakingPositionService, SdtStakingPositionServiceV2} from "../../typechain-types";
import {BigNumberish} from "ethers";

export async function getExpectedCvgSdtRewards(
    stakingContract: SdtStakingPositionService | SdtStakingPositionServiceV2,
    tokenId: BigNumberish,
    cvgCycle: BigNumberish
): Promise<bigint[]> {
    const stakedAmountPerToken = await stakingContract.stakedAmountEligibleAtCycle(cvgCycle, tokenId, await stakingContract.stakingCycle());
    const cvgCycleInfo = await stakingContract.cycleInfo(cvgCycle);

    const totalStaked = cvgCycleInfo.totalStaked;

    const cvgRewards = cvgCycleInfo.cvgRewardsAmount;
    const sdtRewards = await stakingContract.getProcessedSdtRewards(cvgCycle);

    const expectedRewards = [(stakedAmountPerToken * cvgRewards) / totalStaked];

    for (let index = 0; index < sdtRewards.length; index++) {
        expectedRewards.push((stakedAmountPerToken * sdtRewards[index].amount) / totalStaked);
    }

    return expectedRewards;
}
