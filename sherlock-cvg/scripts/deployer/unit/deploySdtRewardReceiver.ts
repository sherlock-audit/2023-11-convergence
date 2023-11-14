import {ethers} from "hardhat";
import {SdtRewardReceiver} from "../../../typechain-types";
import {IContractsUser} from "../../../utils/contractInterface";
import {deployProxy} from "../../../utils/global/deployProxy";

export async function deploySdtRewardReceiver(contractsUsers: IContractsUser): Promise<IContractsUser> {
    const {users, contracts} = contractsUsers;
    const cvgControlTower = contracts.base.cvgControlTower;

    const sigParams = "address";
    const params = [await cvgControlTower.getAddress()];
    const sdtRewardReceiver = await deployProxy<SdtRewardReceiver>(sigParams, params, "SdtRewardReceiver", contracts.base.proxyAdmin);

    await (await cvgControlTower.connect(users.treasuryDao).setSdtRewardReceiver(sdtRewardReceiver)).wait();

    await (await sdtRewardReceiver.connect(users.treasuryDao).setPoolCvgSdtAndApprove(contracts.lp.stablePoolCvgSdt, ethers.MaxUint256)).wait();
    await (await cvgControlTower.connect(users.treasuryDao).toggleStakingContract(sdtRewardReceiver)).wait();

    return {
        ...contractsUsers,
        contracts: {
            ...contracts,
            stakeDao: {
                ...contracts.stakeDao,
                sdtRewardReceiver: sdtRewardReceiver,
            },
        },
    };
}
