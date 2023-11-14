import {IContractsUser} from "../../../utils/contractInterface";
import {ethers} from "hardhat";
import {sdtStakingLogos} from "../../../resources/staking_logos";

export async function deploySdtStakingLogo(contractsUsers: IContractsUser): Promise<IContractsUser> {
    const SdtStakingLogoFactory = await ethers.getContractFactory("SdtStakingLogo");
    const sdtStakingLogo = await SdtStakingLogoFactory.deploy(contractsUsers.contracts.base.cvgControlTower);
    await sdtStakingLogo.waitForDeployment();

    await (await contractsUsers.contracts.base.cvgControlTower.connect(contractsUsers.users.treasuryDao).setSdtStakingLogo(sdtStakingLogo)).wait();
    await (await sdtStakingLogo.connect(contractsUsers.users.treasuryDao).setTokensLogo(Object.keys(sdtStakingLogos), Object.values(sdtStakingLogos))).wait();


    return {
        ...contractsUsers,
        contracts: {
            ...contractsUsers.contracts,
            stakeDao: {
                ...contractsUsers.contracts.stakeDao,
                sdtStakingLogo: sdtStakingLogo,
            },
        },
    };
}
