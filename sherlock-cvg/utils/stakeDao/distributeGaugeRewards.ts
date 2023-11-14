import {ERC20, ISdAssetGauge} from "../../typechain-types";
import {Signer} from "ethers";

export interface TokenAmount {
    token: ERC20;
    amount: bigint;
}
export async function distributeGaugeRewards(gauge: ISdAssetGauge, rewards: TokenAmount[], distributor: Signer) {
    for (let index = 0; index < rewards.length; index++) {
        await gauge.connect(distributor).deposit_reward_token(rewards[index].token, rewards[index].amount);
    }
}
