import {CloneFactory} from "../../../typechain-types/contracts";
import {IContractsUser} from "../../../utils/contractInterface";
import {deployProxy} from "../../../utils/global/deployProxy";
import {GlobalHelper} from "../../../utils/GlobalHelper";

export async function deployCloneFactoryContract(contractsUsers: IContractsUser): Promise<IContractsUser> {
    const {users, contracts} = contractsUsers;

    const sigParams = "address";
    const cvgControlTower = contracts.base.cvgControlTower;
    const params = [await cvgControlTower.getAddress()];
    const cloneFactory = await deployProxy<CloneFactory>(sigParams, params, "CloneFactory", contracts.base.proxyAdmin);

    //transfer ownership
    await cloneFactory.transferOwnership(users.treasuryDao);
    await cloneFactory.connect(users.treasuryDao).acceptOwnership();

    await (await cvgControlTower.connect(users.treasuryDao).setCloneFactory(cloneFactory)).wait();

    return {
        users: users,
        contracts: {
            ...contracts,
            base: {
                ...contracts.base,
                cloneFactory: cloneFactory,
            },
        },
    };
}
