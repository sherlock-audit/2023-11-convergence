import {AddressLike} from "ethers";
import {ethers} from "hardhat";
import {GlobalHelper} from "../GlobalHelper";
import {setStorageAt} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import {THIEF_TOKEN_CONFIG} from "../thief/thiefConfig";

interface Tokens {
    address: string;
    isVyper: boolean;
}

interface BalanceOfSlot {
    token: AddressLike;
    slot: number;
}

const RANDOM_ADDRESS = "0x47b4Dd903bC719D689a3a9391186c5deAaC5D8Ff";
export async function getSlot(tokens: Tokens[]): Promise<BalanceOfSlot[]> {
    const result: BalanceOfSlot[] = [];
    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        const erc20 = await ethers.getContractAt("ERC20", tokens[i].address);
        for (let k = 0; k < 150; k++) {
            let storageSlot;
            if (token.isVyper) {
                storageSlot = await GlobalHelper.calculateStorageSlotEthersVyper(RANDOM_ADDRESS, k);
            } else {
                storageSlot = await GlobalHelper.calculateStorageSlotEthersSolidity(RANDOM_ADDRESS, k);
            }
            await setStorageAt(token.address, storageSlot, ethers.parseEther("1"));
            if ((await erc20.balanceOf(RANDOM_ADDRESS)) === ethers.parseEther("1")) {
                result.push({
                    token: await erc20.name(),
                    slot: k,
                });
                break;
            }
        }
    }
    console.log(result);
    return result;
}

getSlot([THIEF_TOKEN_CONFIG._80_BAL_20_WETH]).catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
