import {ethers} from "hardhat";
import {IContractsUser} from "../../utils/contractInterface";
import {PRESALE_SEED} from "../../resources/cvg-mainnet";

export async function linkPreseed(contractsUsers: IContractsUser): Promise<IContractsUser> {
    const presaleContractSeed = await ethers.getContractAt("SeedPresaleCvg", PRESALE_SEED);

    return {
        ...contractsUsers,
        contracts: {
            ...contractsUsers.contracts,
            presaleVesting: {
                ...contractsUsers.contracts.presaleVesting,
                seedPresale: presaleContractSeed,
            },
        },
    };
}
