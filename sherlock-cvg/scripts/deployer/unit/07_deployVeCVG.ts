import {VeCVG} from "../../../typechain-types";
import {IContractsUser} from "../../../utils/contractInterface";
import {deployProxy} from "../../../utils/global/deployProxy";

export async function deployVeCVGContract(contractsUsers: IContractsUser): Promise<IContractsUser> {
    const {users, contracts} = contractsUsers;
    const cvgControlTower = contracts.base.cvgControlTower;

    const sigParams = "address,string,string,string";
    const params = [await cvgControlTower.getAddress(), "Voting Power Convergence", "veCVG", 1];
    const veCVGContract = await deployProxy<VeCVG>(sigParams, params, "veCVG", contracts.base.proxyAdmin, false);

    await (await cvgControlTower.connect(users.treasuryDao).setVeCVG(veCVGContract)).wait();

    return {
        ...contractsUsers,
        contracts: {
            ...contracts,
            locking: {
                ...contracts.locking,
                veCvg: veCVGContract,
            },
        },
    };
}
