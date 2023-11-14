import {ethers} from "hardhat";
import {IContractsUser} from "../../../utils/contractInterface";

export async function deployCvgAirdrop(contractsUsers: IContractsUser): Promise<IContractsUser> {
    const {users, contracts} = contractsUsers;
    const CvgAirdropFactory = await ethers.getContractFactory("CvgAirdrop");

    const cvgAirdrop = await CvgAirdropFactory.deploy(contracts.base.cvgControlTower);
    await cvgAirdrop.waitForDeployment();

    return {
        ...contractsUsers,
        contracts: {
            ...contracts,
            presaleVesting: {
                ...contracts.presaleVesting,
                cvgAirdrop: cvgAirdrop,
            },
        },
    };
}
