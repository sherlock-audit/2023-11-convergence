import {ethers} from "hardhat";
import {IContractsUser} from "../../../utils/contractInterface";

export async function deployMockPositionLocker(contractsUsers: IContractsUser): Promise<IContractsUser> {
    const {users, contracts} = contractsUsers;
    const PositionLockerFactory = await ethers.getContractFactory("PositionLocker");
    const positionLocker = await PositionLockerFactory.deploy(contracts.base.cvgControlTower);
    await positionLocker.waitForDeployment();

    return {
        ...contractsUsers,
        contracts: {
            ...contracts,
            tests: {
                ...contracts.tests,
                positionLocker: positionLocker,
            },
        },
    };
}
