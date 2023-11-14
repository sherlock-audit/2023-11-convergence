import {ethers} from "hardhat";
import {IContractsUser} from "../../../utils/contractInterface";
import {AGGREGATIONROUTERV5} from "../../../resources/oneInch";

export async function deploySwapperFactory(contractsUsers: IContractsUser): Promise<IContractsUser> {
    const {users, contracts} = contractsUsers;
    const cvgControlTower = contracts.base.cvgControlTower;
    const SwapperFactoryFactory = await ethers.getContractFactory("SwapperFactory");
    const swapperFactory = await SwapperFactoryFactory.deploy(cvgControlTower, AGGREGATIONROUTERV5);
    await swapperFactory.waitForDeployment();

    //transfer ownership
    await swapperFactory.transferOwnership(users.treasuryDao);
    await swapperFactory.connect(users.treasuryDao).acceptOwnership();

    await (await cvgControlTower.connect(users.treasuryDao).setSwapperFactory(swapperFactory)).wait();

    return {
        ...contractsUsers,
        contracts: {
            ...contracts,
            base: {
                ...contracts.base,
                swapperFactory: swapperFactory,
            },
        },
    };
}
