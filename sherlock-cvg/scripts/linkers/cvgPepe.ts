import {ethers} from "hardhat";
import {IContractsUser} from "../../utils/contractInterface";
import {CVG_PEPE} from "../../resources/cvg-mainnet";

export async function linkCvgPepe(contractsUsers: IContractsUser): Promise<IContractsUser> {
    const cvgPepeContract = await ethers.getContractAt("CvgPepe", CVG_PEPE);

    return {
        ...contractsUsers,
        contracts: {
            ...contractsUsers.contracts,
            mainnetDeployed: {
                ...contractsUsers.contracts.mainnetDeployed,
                cvgPepe: cvgPepeContract,
            },
        },
    };
}
