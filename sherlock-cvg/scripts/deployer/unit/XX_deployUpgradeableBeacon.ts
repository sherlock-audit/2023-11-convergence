import {IContractsUser} from "../../../utils/contractInterface";
import {ethers} from "hardhat";
export async function deployUpgradeableBeacon(contractsUsers: IContractsUser): Promise<IContractsUser> {
    const users = contractsUsers.users;
    const contracts = contractsUsers.contracts;

    const upgradeableSdStakingBeacon = await ethers.deployContract("UpgradeableBeacon", [contracts.stakeDao.baseSdAssetStaking, users.treasuryDao]);
    await upgradeableSdStakingBeacon.waitForDeployment();

    const upgradeableBufferBeacon = await ethers.deployContract("UpgradeableBeacon", [contracts.stakeDao.baseSdtBuffer, users.treasuryDao]);
    await upgradeableBufferBeacon.waitForDeployment();

    await contracts.base.cloneFactory.connect(users.treasuryDao).setBeaconSdStaking(upgradeableSdStakingBeacon);
    await contracts.base.cloneFactory.connect(users.treasuryDao).setBeaconBuffer(upgradeableBufferBeacon);

    return {
        ...contractsUsers,
        contracts: {
            ...contractsUsers.contracts,
            stakeDao: {
                ...contractsUsers.contracts.stakeDao,
                upgradeableSdStakingBeacon: upgradeableSdStakingBeacon,
                upgradeableBufferBeacon: upgradeableBufferBeacon,
            },
        },
    };
}
