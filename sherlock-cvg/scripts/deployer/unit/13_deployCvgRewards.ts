import {CvgRewards} from "../../../typechain-types/contracts/Rewards";
import {IContractsUser} from "../../../utils/contractInterface";
import {deployProxy} from "../../../utils/global/deployProxy";
import {GlobalHelper} from "../../../utils/GlobalHelper";

export async function deployCvgRewardsContract(contractsUsers: IContractsUser): Promise<IContractsUser> {
    const {users, contracts} = contractsUsers;
    const cvgControlTower = contracts.base.cvgControlTower;

    const sigParams = "address";
    const params = [await cvgControlTower.getAddress()];
    const cvgRewards = await deployProxy<CvgRewards>(sigParams, params, "CvgRewards", contracts.base.proxyAdmin);

    await (await cvgControlTower.connect(users.treasuryDao).setCvgRewards(cvgRewards)).wait();
    await (await contracts.locking.gaugeController.connect(users.treasuryDao).toggle_locker(cvgRewards)).wait();

    return {
        ...contractsUsers,
        contracts: {
            ...contracts,
            rewards: {
                ...contracts.rewards,
                cvgRewards: cvgRewards,
            },
        },
    };
}
