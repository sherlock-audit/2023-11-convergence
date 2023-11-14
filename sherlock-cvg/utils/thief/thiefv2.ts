import {setStorageAt} from "@nomicfoundation/hardhat-network-helpers";
import {GlobalHelper} from "../GlobalHelper";

import {Signer, toQuantity} from "ethers";

interface TokenAmounts {
    token: {
        slotBalance: number;
        address: string;
        isVyper: boolean;
    };
    amount: bigint;
}
// tokens used must be in the TOKEN config to be able to retrieve the slot of the balanceMapping
export async function giveTokensToAddresses(users: Signer[], tokensAmounts: TokenAmounts[]) {
    for (let i = 0; i < users.length; i++) {
        const userAddress = await users[i].getAddress();

        for (let j = 0; j < tokensAmounts.length; j++) {
            const tokenAmount = tokensAmounts[j];
            let storageSlot = "";
            if (tokenAmount.token.isVyper) {
                storageSlot = await GlobalHelper.calculateStorageSlotEthersVyper(userAddress, tokenAmount.token.slotBalance);
            } else {
                storageSlot = await GlobalHelper.calculateStorageSlotEthersSolidity(userAddress, tokenAmount.token.slotBalance);
            }
            await setStorageAt(tokenAmount.token.address, storageSlot, toQuantity(tokenAmount.amount));
        }
    }
}
