import {ERC20, ISdAssetGauge} from "../../typechain-types";
import {AddressLike, BigNumberish} from "ethers";
import {ethers} from "hardhat";
import {TOKEN_ADDR_SDT} from "../../resources/tokens/common";
import {CLAIMER_REWARDS_PERCENTAGE, DENOMINATOR} from "../../resources/constant";

export interface TokenAmount {
    token: ERC20;
    total: bigint;
    amount: bigint;
    claimerRewards: bigint;
    feeAmount: bigint;
}
export async function getAllGaugeRewardsSdt(gauge: ISdAssetGauge, account: AddressLike, fee: BigNumberish): Promise<TokenAmount[]> {
    const tokenAmounts: TokenAmount[] = [];
    const cvgRewardsAmount = await gauge.reward_count();

    for (let index = 0; index < cvgRewardsAmount; index++) {
        const token = await ethers.getContractAt("ERC20", await gauge.reward_tokens(index));
        let amount = await gauge.claimable_reward(account, token);
        if (amount !== 0n) {
            const tokenAddress = await token.getAddress();
            const feeAmount = tokenAddress === TOKEN_ADDR_SDT ? (BigInt(fee) * amount / 100_000n) : 0n;
            const claimerRewards = amount * CLAIMER_REWARDS_PERCENTAGE / DENOMINATOR;
            const total = amount;
            amount -= feeAmount + claimerRewards;

            tokenAmounts.push({
                token,
                total,
                amount,
                feeAmount,
                claimerRewards
            });
        }
    }
    return tokenAmounts;
}
