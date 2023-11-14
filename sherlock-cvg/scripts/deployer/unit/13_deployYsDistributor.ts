import {YsDistributor} from "../../../typechain-types/contracts/Rewards";
import {IContractsUser} from "../../../utils/contractInterface";
import {deployProxy} from "../../../utils/global/deployProxy";
import {GlobalHelper} from "../../../utils/GlobalHelper";

export async function deployYsDistributor(contractsUsers: IContractsUser): Promise<IContractsUser> {
    const {users, contracts} = contractsUsers;
    const cvgControlTower = contracts.base.cvgControlTower;

    const sigParams = "address";
    const params = [await cvgControlTower.getAddress()];
    const ysdistributor = await deployProxy<YsDistributor>(sigParams, params, "YsDistributor", contracts.base.proxyAdmin);

    await (await cvgControlTower.connect(users.treasuryDao).setYsDistributor(ysdistributor)).wait();

    return {
        ...contractsUsers,
        contracts: {
            ...contracts,
            rewards: {
                ...contracts.rewards,
                ysDistributor: ysdistributor,
            },
        },
    };
}
