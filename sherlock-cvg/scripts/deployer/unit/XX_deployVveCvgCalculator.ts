import {ethers} from "hardhat";
import {IContractsUser} from "../../../utils/contractInterface";

export async function deployVveCvgCalculator(contractsUsers: IContractsUser): Promise<IContractsUser> {
    const cvgControlTower = contractsUsers.contracts.base.cvgControlTower;

    const VveCvgCalculatorFactory = await ethers.getContractFactory("VveCvgCalculator");
    const vveCvgCalculator = await VveCvgCalculatorFactory.deploy(cvgControlTower);
    await vveCvgCalculator.waitForDeployment();
    return {
        ...contractsUsers,
        contracts: {
            ...contractsUsers.contracts,
            locking: {
                ...contractsUsers.contracts.locking,
                vveCVGCalculator: vveCvgCalculator,
            },
        },
    };
}
