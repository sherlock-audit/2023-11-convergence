import {BondPositionManager} from "../../../typechain-types/contracts/Bond";
import {IContractsUser} from "../../../utils/contractInterface";
import {deployProxy} from "../../../utils/global/deployProxy";
import {GlobalHelper} from "../../../utils/GlobalHelper";

export async function deployBondPositionManagerContract(contractsUsers: IContractsUser): Promise<IContractsUser> {
    const {users, contracts} = contractsUsers;
    const cvgControlTower = contracts.base.cvgControlTower;
    const sigParams = "address";
    const params = [await cvgControlTower.getAddress()];
    const bondPositionManagerContract = await deployProxy<BondPositionManager>(sigParams, params, "BondPositionManager", contracts.base.proxyAdmin);

    await (await cvgControlTower.connect(users.treasuryDao).setBondPositionManager(bondPositionManagerContract)).wait();

    return {
        ...contractsUsers,
        contracts: {
            ...contracts,
            bonds: {
                ...contracts.bonds,
                bondPositionManager: bondPositionManagerContract,
            },
        },
    };
}
