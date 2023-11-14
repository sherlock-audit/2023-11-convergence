import {AddressLike} from "ethers";
import {ethers} from "hardhat";

interface TokenAddress {
    token: string;
    addresses: string[];
}

export interface Balances {
    token: string;
    balances: AddressAmount[];
}

interface AddressAmount {
    address: string;
    amount: bigint;
}

export async function getBalances(tokensAccounts: TokenAddress[]): Promise<Balances[]> {
    const result: Balances[] = [];

    for (let i = 0; i < tokensAccounts.length; i++) {
        const token = tokensAccounts[i].token;
        const erc20Token = await ethers.getContractAt("ERC20", token);
        const balances: Balances = {
            token: token,
            balances: [],
        };
        const addresses = tokensAccounts[i].addresses;
        for (let j = 0; j < addresses.length; j++) {
            balances.balances.push({
                address: addresses[j],
                amount: await erc20Token.balanceOf(addresses[j]),
            });
        }
        result.push(balances);
    }

    return result;
}
