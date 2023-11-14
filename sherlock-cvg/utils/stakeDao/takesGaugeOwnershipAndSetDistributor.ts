import {ERC20, ISdAssetGauge} from "../../typechain-types";
import {Signer} from "ethers";
import {ethers} from "hardhat";
import {impersonateAccount, stopImpersonatingAccount} from "@nomicfoundation/hardhat-network-helpers";

export async function takesGaugeOwnershipAndSetDistributor(gauge: ISdAssetGauge, newDistributor: Signer) {
    const cvgRewardsAmount = await gauge.reward_count();
    const admin = await gauge.admin();
    await impersonateAccount(admin);

    for (let index = 0; index < cvgRewardsAmount; index++) {
        const token = await ethers.getContractAt("ERC20", await gauge.reward_tokens(index));
        await token.connect(newDistributor).approve(gauge, ethers.MaxUint256);
        await gauge.connect(await ethers.getSigner(admin)).set_reward_distributor(token, newDistributor);
    }

    await stopImpersonatingAccount(admin);
}
