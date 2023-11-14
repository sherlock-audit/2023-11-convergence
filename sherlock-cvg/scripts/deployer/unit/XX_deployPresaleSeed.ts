import {ethers} from "hardhat";
import {IContractsUser} from "../../../utils/contractInterface";

export async function deployPresaleSeed(contractsUsers: IContractsUser): Promise<IContractsUser> {
    const {users, contracts} = contractsUsers;
    const tokens = contracts.tokens;
    const dai = tokens.dai;
    const frax = tokens.frax;
    // deploy presale SC
    const PresaleContractSeed = await ethers.getContractFactory("SeedPresaleCvg");
    const presaleContractSeed = await PresaleContractSeed.deploy(dai, frax, users.treasuryDao);
    await presaleContractSeed.waitForDeployment();

    return {
        ...contractsUsers,
        contracts: {
            ...contracts,
            presaleVesting: {
                ...contracts.presaleVesting,
                seedPresale: presaleContractSeed,
            },
        },
    };
}
