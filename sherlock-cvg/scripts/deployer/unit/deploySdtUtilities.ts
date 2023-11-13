import {ethers} from "hardhat";
import {YsDistributor} from "../../../typechain-types/contracts/Rewards";
import {IContractsUser} from "../../../utils/contractInterface";
import {GlobalHelper} from "../../../utils/GlobalHelper";

export async function deploySdtUtilities(contractsUsers: IContractsUser): Promise<IContractsUser> {
    const users = contractsUsers.users;
    const contracts = contractsUsers.contracts;
    const cvgControlTower = contracts.base.cvgControlTower;

    const SdtUtilitiesFactory = await ethers.getContractFactory("SdtUtilities");
    const sdtUtilities = await SdtUtilitiesFactory.deploy(cvgControlTower, contracts.tokens.cvgSdt, contracts.tokens.sdt);
    await sdtUtilities.waitForDeployment();

    await (await cvgControlTower.connect(users.treasuryDao).setSdtUtilities(sdtUtilities)).wait();
    await (await cvgControlTower.connect(users.treasuryDao).toggleStakingContract(sdtUtilities)).wait();

    return {
        ...contractsUsers,
        contracts: {
            ...contracts,
            stakeDao: {
                ...contracts.stakeDao,
                sdtUtilities: sdtUtilities,
            },
        },
    };
}
