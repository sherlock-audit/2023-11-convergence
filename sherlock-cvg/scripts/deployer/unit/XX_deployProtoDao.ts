import {ethers} from "hardhat";
import {ProtoDao} from "../../../typechain-types";
import {IContractsUser} from "../../../utils/contractInterface";
import {IBO, PRESALE_SEED, PRESALE_WL, TREASURY_POD} from "../../../resources/cvg-mainnet";

export async function deployProtoDaoContract(contractsUsers: IContractsUser): Promise<IContractsUser> {
    const [seedPreseedAddress, iboAddress, wlAddress, podTreasury] = [PRESALE_SEED, IBO, PRESALE_WL, TREASURY_POD];
  
    const ProtoDaoFactory = await ethers.getContractFactory("ProtoDao");
    const protoDaoContract = (await ProtoDaoFactory.deploy(seedPreseedAddress, iboAddress, wlAddress, podTreasury)) as ProtoDao;
    await protoDaoContract.waitForDeployment();

    return {
        users: contractsUsers.users,
        contracts: {
            ...contractsUsers.contracts,
            dao: {
                ...contractsUsers.contracts.dao,
                protoDao: protoDaoContract
            },
        },
    };
}