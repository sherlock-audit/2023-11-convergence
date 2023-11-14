import {BaseTest__factory} from "../../../typechain-types/factories/contracts/mocks";
import {IContractsUser} from "../../../utils/contractInterface";

export async function deployBaseTest(contractsUsers: IContractsUser): Promise<IContractsUser> {
    const BaseTestFactory = new BaseTest__factory();
    const baseTestContract = await BaseTestFactory.deploy();
    await baseTestContract.waitForDeployment();

    return {
        ...contractsUsers,
        contracts: {
            ...contractsUsers.contracts,
            tests: {
                ...contractsUsers.contracts.tests,
                baseTest: baseTestContract,
            },
        },
    };
}
