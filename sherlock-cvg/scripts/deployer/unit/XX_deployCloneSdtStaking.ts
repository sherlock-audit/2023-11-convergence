import {ethers} from "hardhat";
import {IContractsUser} from "../../../utils/contractInterface";
import {SDASSET_GAUGE_TOKENS} from "../../../utils/thief/thiefConfig";

export async function deployCloneSdtStaking(contractsUsers: IContractsUser): Promise<IContractsUser> {
    let sdAssetStakingContracts: any = {};
    let sdAssetBufferContracts: any = {};
    const {users, contracts} = contractsUsers;

    const filterSdCreated = contracts.base.cloneFactory.filters.SdtStakingCreated(undefined, undefined, undefined);

    for (const [sdAssetName, sdAsset] of Object.entries(SDASSET_GAUGE_TOKENS)) {
        await contracts.base.cloneFactory.connect(users.treasuryDao).createSdtStakingAndBuffer(sdAsset.address, "STK-" + sdAssetName);
        const events = await contracts.base.cloneFactory.queryFilter(filterSdCreated, -1, "latest");
        const event = events[events.length - 1].args;

        const stakingContract = await ethers.getContractAt("SdtStakingPositionService", event.stakingClone);
        sdAssetStakingContracts[sdAssetName + "Staking"] = stakingContract;
        const bufferContract = await ethers.getContractAt("SdtBuffer", event.bufferClone);
        sdAssetBufferContracts[sdAssetName + "Buffer"] = bufferContract;
    }
    return {
        ...contractsUsers,
        contracts: {
            ...contracts,
            stakeDao: {
                ...contracts.stakeDao,
                sdAssetsStaking: sdAssetStakingContracts,
                sdAssetsBuffer: sdAssetBufferContracts,
            },
        },
    };
}
