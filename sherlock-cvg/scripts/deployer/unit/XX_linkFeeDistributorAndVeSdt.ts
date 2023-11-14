import {ethers, network} from "hardhat";
import {IContractsUser} from "../../../utils/contractInterface";
import {FEE_DISTRIBUTOR_ADDRESS, MULTI_MERKLE_STASH_ADDRESS, VE_SDT_ADDRESS} from "../../../resources/stake";

export async function linkFeeDistributorAndVeSdt(contractsUsers: IContractsUser): Promise<IContractsUser> {
    const {users, contracts} = contractsUsers;

    const feeDistributor = await ethers.getContractAt("IFeeDistributor", FEE_DISTRIBUTOR_ADDRESS);

    const veSdt = await ethers.getContractAt("IVeSDT", VE_SDT_ADDRESS);

    const multiMerkleStash = await ethers.getContractAt("IMultiMerkleStash", MULTI_MERKLE_STASH_ADDRESS);

    //change ownership of multiMerkleStash
    const ownerAddress = await users.owner.getAddress();
    await network.provider.send("hardhat_setStorageAt", [MULTI_MERKLE_STASH_ADDRESS, "0x0", "0x000000000000000000000000" + ownerAddress.substring(2)]);

    return {
        ...contractsUsers,
        contracts: {
            ...contracts,
            stakeDao: {
                ...contracts.stakeDao,
                feeDistributor: feeDistributor,
                veSdt: veSdt,
                multiMerkleStash: multiMerkleStash,
            },
        },
    };
}
