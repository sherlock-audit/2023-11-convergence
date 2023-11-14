import {ethers} from "hardhat";
import {IContractsUser} from "../../../utils/contractInterface";

export async function deploySdtStakingViewer(contractsUsers: IContractsUser): Promise<IContractsUser> {
    const {users, contracts} = contractsUsers;
    const cvgControlTower = contracts.base.cvgControlTower;

    const SdtStakingViewerFactory = await ethers.getContractFactory("SdtStakingViewer");
    const sdtStakingViewer = await SdtStakingViewerFactory.deploy(cvgControlTower);
    await sdtStakingViewer.waitForDeployment();

    await (await cvgControlTower.connect(users.treasuryDao).setSdtStakingViewer(sdtStakingViewer)).wait();
    return {
        ...contractsUsers,
        contracts: {
            ...contracts,
            stakeDao: {
                ...contracts.stakeDao,
                sdtStakingViewer: sdtStakingViewer,
            },
        },
    };
}
