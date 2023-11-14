import {IContractsUser} from "../../../utils/contractInterface";
import {ethers} from "hardhat";

export async function deploySdtFeeCollector(contractsUsers: IContractsUser): Promise<IContractsUser> {
    const SdtFeeCollectorFactory = await ethers.getContractFactory("SdtFeeCollector");
    const sdtFeeCollector = await SdtFeeCollectorFactory.deploy(contractsUsers.contracts.base.cvgControlTower);

    await sdtFeeCollector.waitForDeployment();

    await (await contractsUsers.contracts.base.cvgControlTower.connect(contractsUsers.users.treasuryDao).setSdtFeeCollector(sdtFeeCollector)).wait();

    return {
        ...contractsUsers,
        contracts: {
            ...contractsUsers.contracts,
            stakeDao: {
                ...contractsUsers.contracts.stakeDao,
                sdtFeeCollector: sdtFeeCollector,
            },
        },
    };
}
