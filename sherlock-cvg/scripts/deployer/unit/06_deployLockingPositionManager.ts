import {LockingPositionDelegate, LockingPositionManager, LockingPositionService} from "../../../typechain-types/contracts/Locking";
import {IContractsUser} from "../../../utils/contractInterface";
import {deployProxy} from "../../../utils/global/deployProxy";

export async function deployLockingPositionManagerContract(contractsUsers: IContractsUser): Promise<IContractsUser> {
    const {users, contracts} = contractsUsers;

    const cvgControlTower = contracts.base.cvgControlTower;
    const proxyAdmin = contracts.base.proxyAdmin;

    const sigParams = "address";
    const params = [await contracts.base.cvgControlTower.getAddress()];
    const lockingPositionManagerContract = await deployProxy<LockingPositionManager>(sigParams, params, "LockingPositionManager", proxyAdmin);

    await (await cvgControlTower.connect(users.treasuryDao).setLockingPositionManager(lockingPositionManagerContract)).wait();
    const lockingPositionServiceContract = await deployProxy<LockingPositionService>(sigParams, params, "LockingPositionService", proxyAdmin);

    //transfer ownership
    await lockingPositionServiceContract.transferOwnership(users.treasuryDao);
    await lockingPositionServiceContract.connect(users.treasuryDao).acceptOwnership();

    await (await cvgControlTower.connect(users.treasuryDao).setLockingPositionService(lockingPositionServiceContract)).wait();

    const lockingPositionDelegateContract = await deployProxy<LockingPositionDelegate>(sigParams, params, "LockingPositionDelegate", proxyAdmin);

    await (await cvgControlTower.connect(users.treasuryDao).setLockingPositionDelegate(lockingPositionDelegateContract)).wait();

    return {
        ...contractsUsers,
        contracts: {
            ...contracts,
            locking: {
                ...contracts.locking,
                lockingPositionManager: lockingPositionManagerContract,
                lockingPositionService: lockingPositionServiceContract,
                lockingPositionDelegate: lockingPositionDelegateContract,
            },
        },
    };
}
