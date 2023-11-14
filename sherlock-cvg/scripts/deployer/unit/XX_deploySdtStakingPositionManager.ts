import {IContractsUser} from "../../../utils/contractInterface";
import {GlobalHelper} from "../../../utils/GlobalHelper";
import {SdtStakingPositionManager} from "../../../typechain-types/contracts/Staking/StakeDAO";
import {deployProxy} from "../../../utils/global/deployProxy";

export async function deploySdtStakingPositionManager(contractsUsers: IContractsUser): Promise<IContractsUser> {
    const {users, contracts} = contractsUsers;
    const cvgControlTower = contracts.base.cvgControlTower;

    const sigParams = "address";
    const params = [await cvgControlTower.getAddress()];
    const sdtStakingPositionManager = await deployProxy<SdtStakingPositionManager>(sigParams, params, "SdtStakingPositionManager", contracts.base.proxyAdmin);

    await (await cvgControlTower.connect(users.treasuryDao).setSdtStakingPositionManager(sdtStakingPositionManager)).wait();

    return {
        ...contractsUsers,
        contracts: {
            ...contracts,
            stakeDao: {
                ...contracts.stakeDao,
                sdtStakingPositionManager: sdtStakingPositionManager,
            },
        },
    };
}
