import {IContractsUser} from "../../../utils/contractInterface";
import {ethers} from "hardhat";

export async function deployProxyAdmin(contractsUsers: IContractsUser): Promise<IContractsUser> {
    const {users, contracts} = contractsUsers;
    const ProxyAdminFactory = await ethers.getContractFactory("ProxyAdmin");
    const proxyAdmin = await ProxyAdminFactory.deploy(await users.treasuryDao.getAddress());

    await proxyAdmin.waitForDeployment();
    return {
        ...contractsUsers,
        contracts: {
            ...contracts,
            base: {
                ...contracts.base,
                proxyAdmin: proxyAdmin,
            },
        },
    };
}
