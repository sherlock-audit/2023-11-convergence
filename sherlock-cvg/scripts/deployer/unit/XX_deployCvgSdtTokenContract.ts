import {ethers} from "hardhat";
import {IContractsUser} from "../../../utils/contractInterface";

export async function deployCvgSdtTokenContract(contractsUsers: IContractsUser): Promise<IContractsUser> {
    const {users, contracts} = contractsUsers;
    const cvgControlTower = contracts.base.cvgControlTower;

    const CvgSdtFactory = await ethers.getContractFactory("CvgSDT");
    const cvgSdt = await CvgSdtFactory.deploy(cvgControlTower);
    await cvgSdt.waitForDeployment();

    await (await cvgControlTower.connect(users.treasuryDao).setCvgSdt(cvgSdt)).wait();

    return {
        ...contractsUsers,
        contracts: {
            ...contracts,
            tokens: {
                ...contracts.tokens,
                cvgSdt: cvgSdt,
            },
        },
    };
}
