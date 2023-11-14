import {ethers} from "hardhat";
import {IContractsUser} from "../../../utils/contractInterface";

export async function deployBaseSdtStaking(contractsUsers: IContractsUser): Promise<IContractsUser> {
    const {contracts} = contractsUsers;

    const SdAssetStakingFactory = await ethers.getContractFactory("SdtStakingPositionService");

    const sdAssetStakingBase = await SdAssetStakingFactory.deploy();
    await sdAssetStakingBase.waitForDeployment();

    const SdtBufferFactory = await ethers.getContractFactory("SdtBuffer");
    const sdtBufferBase = await SdtBufferFactory.deploy();
    await sdtBufferBase.waitForDeployment();

    return {
        ...contractsUsers,
        contracts: {
            ...contracts,
            stakeDao: {
                ...contracts.stakeDao,
                baseSdAssetStaking: sdAssetStakingBase,
                baseSdtBuffer: sdtBufferBase,
            },
        },
    };
}
