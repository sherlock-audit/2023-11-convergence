import {ethers} from "hardhat";
import {IContractsUser} from "../../../utils/contractInterface";
import {MockCvgUtilities} from "../../../typechain-types";

export async function deployMockCvgUtilities(contractsUsers: IContractsUser): Promise<IContractsUser> {
    const {users, contracts} = contractsUsers;
    const cvgControlTower = contracts.base.cvgControlTower;

    const MockCvgUtilitiesFactory = await ethers.getContractFactory("MockCvgUtilities");
    const mockCvgUtilities = await MockCvgUtilitiesFactory.deploy(cvgControlTower);
    await mockCvgUtilities.waitForDeployment();

    //transfer ownership
    await mockCvgUtilities.transferOwnership(users.treasuryDao);
    await mockCvgUtilities.connect(users.treasuryDao).acceptOwnership();

    return {
        ...contractsUsers,
        contracts: {
            ...contracts,
            tests: {
                ...contracts.tests,
                mockCvgUtilities: mockCvgUtilities,
            },
        },
    };
}
