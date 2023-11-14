import {ethers} from "hardhat";
import {IContractsUser} from "../../../utils/contractInterface";

export async function deployBaseBondContract(contractsUsers: IContractsUser): Promise<IContractsUser> {
    const users = contractsUsers.users;
    const contracts = contractsUsers.contracts;

    const BondDepositoryFactory = await ethers.getContractFactory("BondDepository");

    const baseBond = await BondDepositoryFactory.deploy();
    await baseBond.waitForDeployment();

    await (await contracts.base.cvgControlTower.connect(users.treasuryDao).setNewVersionBaseBond(baseBond)).wait();

    return {
        users: users,
        contracts: {
            ...contracts,
            bonds: {
                ...contracts.bonds,
                baseBond: baseBond,
            },
        },
    };
}
