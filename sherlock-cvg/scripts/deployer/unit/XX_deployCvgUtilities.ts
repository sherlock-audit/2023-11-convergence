import {ethers} from "hardhat";
import {IContractsUser} from "../../../utils/contractInterface";
import {CvgUtilities} from "../../../typechain-types";

export async function deployCvgUtilities(contractsUsers: IContractsUser): Promise<IContractsUser> {
    const {users, contracts} = contractsUsers;
    const cvgControlTower = contracts.base.cvgControlTower;

    const CvgUtilitiesFactory = await ethers.getContractFactory("CvgUtilities");
    const cvgUtilities = await CvgUtilitiesFactory.deploy(cvgControlTower);
    await cvgUtilities.waitForDeployment();

    //transfer ownership
    await cvgUtilities.transferOwnership(users.treasuryDao);
    await cvgUtilities.connect(users.treasuryDao).acceptOwnership();

    await (await cvgControlTower.connect(users.treasuryDao).setCvgUtilities(cvgUtilities)).wait();

    return {
        ...contractsUsers,
        contracts: {
            ...contracts,
            base: {
                ...contracts.base,
                cvgUtilities: cvgUtilities,
            },
        },
    };
}
