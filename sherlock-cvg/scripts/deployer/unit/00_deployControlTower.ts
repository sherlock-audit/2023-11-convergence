import {CvgControlTower} from "../../../typechain-types/contracts";
import {IContractsUser} from "../../../utils/contractInterface";
import {deployProxy} from "../../../utils/global/deployProxy";

export async function deployControlTowerContract(contractsUsers: IContractsUser): Promise<IContractsUser> {
    const {users, contracts} = contractsUsers;

    const sigParams = "address,address,address,address,address";
    const params = [
        await users.treasuryBonds.getAddress(),
        await users.veSdtMultisig.getAddress(),
        await users.treasuryDao.getAddress(),
        await users.treasuryAirdrop.getAddress(),
        await users.treasuryCore.getAddress(),
    ];
    const cvgControlTower = await deployProxy<CvgControlTower>(sigParams, params, "CvgControlTower", contracts.base.proxyAdmin);

    //transfer ownership
    await cvgControlTower.transferOwnership(users.treasuryDao);
    await cvgControlTower.connect(users.treasuryDao).acceptOwnership();

    return {
        users: users,
        contracts: {
            ...contracts,
            base: {
                ...contracts.base,
                cvgControlTower: cvgControlTower,
            },
        },
    };
}
