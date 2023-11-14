import {ethers} from "hardhat";
import {InternalDao} from "../../../typechain-types";
import {IContractsUser} from "../../../utils/contractInterface";

export async function deployInternalDaoContract(contractsUsers: IContractsUser): Promise<IContractsUser> {
    const TOKENS_URI = "ipfs://internal-dao-uri/";

    const InternalDaoFactory = await ethers.getContractFactory("InternalDao");
    const internalDaoContract = await InternalDaoFactory.deploy(TOKENS_URI);
    await internalDaoContract.waitForDeployment();

    return {
        users: contractsUsers.users,
        contracts: {
            ...contractsUsers.contracts,
            dao: {
                ...contractsUsers.contracts.dao,
                internalDao: internalDaoContract,
            },
        },
    };
}
