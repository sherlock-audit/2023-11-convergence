import {ethers} from "hardhat";
import {InternalDao} from "../../../typechain-types";
import {IContractsUser} from "../../../utils/contractInterface";
import {TOKEN_ADDR_SD_FRAX_3CRV} from "../../../resources/tokens/stake-dao";

export async function deployMockFeeDistributor(contractsUsers: IContractsUser): Promise<IContractsUser> {
    const MockFeeDistributor = await ethers.getContractFactory("MockFeeDistributor");
    const mockFeeDistributor = await MockFeeDistributor.deploy(ethers.ZeroAddress);
    await mockFeeDistributor.waitForDeployment();

    return {
        users: contractsUsers.users,
        contracts: {
            ...contractsUsers.contracts,
            tests: {
                ...contractsUsers.contracts.tests,
                mockFeeDistributor: mockFeeDistributor,
            },
        },
    };
}
