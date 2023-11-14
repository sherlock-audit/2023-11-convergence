import {ethers} from "hardhat";
import {IContractsUser} from "../../../utils/contractInterface";

export async function deployLockingLogo(contractsUsers: IContractsUser): Promise<IContractsUser> {
    const {users, contracts} = contractsUsers;
    const cvgControlTower = contracts.base.cvgControlTower;
    const LockingLogoFactory = await ethers.getContractFactory("LockingLogo");
    const lockingLogo = await LockingLogoFactory.deploy(cvgControlTower);
    await lockingLogo.waitForDeployment();

    await (await cvgControlTower.connect(users.treasuryDao).setLockingLogo(lockingLogo)).wait();

    return {
        ...contractsUsers,
        contracts: {
            ...contracts,
            locking: {
                ...contracts.locking,
                lockingLogo: lockingLogo,
            },
        },
    };
}
