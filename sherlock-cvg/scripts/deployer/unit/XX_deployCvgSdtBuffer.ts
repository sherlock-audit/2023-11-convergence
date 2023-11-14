import {ethers} from "hardhat";
import {IContractsUser} from "../../../utils/contractInterface";
import {GlobalHelper} from "../../../utils/GlobalHelper";
import {CvgSdtBuffer} from "../../../typechain-types";
import {deployProxy} from "../../../utils/global/deployProxy";

export async function deployCvgSdtBuffer(contractsUsers: IContractsUser): Promise<IContractsUser> {
    const {users, contracts} = contractsUsers;
    const cvgControlTower = contracts.base.cvgControlTower;

    const sigParams = "address,address";
    const params = [await cvgControlTower.getAddress(), await contracts.stakeDao.feeDistributor.getAddress()];
    const cvgSdtBuffer = await deployProxy<CvgSdtBuffer>(sigParams, params, "CvgSdtBuffer", contracts.base.proxyAdmin);

    await (await cvgControlTower.connect(users.treasuryDao).setCvgSdtBuffer(cvgSdtBuffer)).wait();

    return {
        ...contractsUsers,
        contracts: {
            ...contracts,
            stakeDao: {
                ...contracts.stakeDao,
                cvgSdtBuffer: cvgSdtBuffer,
            },
        },
    };
}
