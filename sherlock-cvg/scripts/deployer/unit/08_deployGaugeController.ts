import {GaugeController} from "../../../typechain-types-vyper/GaugeController";
import {IContractsUser} from "../../../utils/contractInterface";
import {deployProxy} from "../../../utils/global/deployProxy";
import {GlobalHelper} from "../../../utils/GlobalHelper";

export async function deployGaugeControllerContract(contractsUsers: IContractsUser): Promise<IContractsUser> {
    const {users, contracts} = contractsUsers;
    const cvgControlTower = contracts.base.cvgControlTower;

    const sigParams = "address";
    const params = [await cvgControlTower.getAddress()];
    const gaugeController = await deployProxy<GaugeController>(sigParams, params, "GaugeController", contracts.base.proxyAdmin, false);

    //transfer ownership
    await gaugeController.commit_transfer_ownership(users.treasuryDao);
    await gaugeController.connect(users.treasuryDao).apply_transfer_ownership();

    await (await cvgControlTower.connect(users.treasuryDao).setGaugeController(gaugeController)).wait();

    return {
        ...contractsUsers,
        contracts: {
            ...contracts,
            locking: {
                ...contracts.locking,
                gaugeController: gaugeController,
            },
        },
    };
}
