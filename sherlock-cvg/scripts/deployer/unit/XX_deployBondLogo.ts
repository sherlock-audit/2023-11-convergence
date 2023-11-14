import {ethers} from "hardhat";
import {IContractsUser} from "../../../utils/contractInterface";

export async function deployBondLogo(contractsUsers: IContractsUser): Promise<IContractsUser> {
    const {users, contracts} = contractsUsers;

    const cvgControlTower = contracts.base.cvgControlTower;
    const BondLogoFactory = await ethers.getContractFactory("BondLogo");

    const bondLogo = await BondLogoFactory.deploy(cvgControlTower);
    await bondLogo.waitForDeployment();

    await (await cvgControlTower.connect(users.treasuryDao).setBondLogo(bondLogo)).wait();

    return {
        ...contractsUsers,
        contracts: {
            ...contracts,
            bonds: {
                ...contracts.bonds,
                bondLogo: bondLogo,
            },
        },
    };
}
