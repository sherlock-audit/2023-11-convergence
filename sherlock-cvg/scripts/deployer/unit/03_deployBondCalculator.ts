import {ethers} from "hardhat";
import {IContractsUser} from "../../../utils/contractInterface";

export async function deployBondCalculatorContract(contractsUsers: IContractsUser, isIbo: boolean): Promise<IContractsUser> {
    const users = contractsUsers.users;
    const contracts = contractsUsers.contracts;

    const BondCalculatorFactory = await ethers.getContractFactory("BondCalculator");

    const bondCalculator = await BondCalculatorFactory.deploy();
    await bondCalculator.waitForDeployment();

    if (!isIbo) {
        await (await contracts.base.cvgControlTower.connect(users.treasuryDao).setBondCalculator(bondCalculator)).wait();
    }

    return {
        users: users,
        contracts: {
            ...contracts,
            bonds: {
                ...contracts.bonds,
                bondCalculator: bondCalculator,
            },
        },
    };
}
