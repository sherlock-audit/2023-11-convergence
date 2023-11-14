import {ethers} from "hardhat";
import {IContractsUser} from "../../../utils/contractInterface";
import {AddressLike} from "ethers";

export async function deployCvgTokenContract(contractsUsers: IContractsUser, isProd: boolean, receiverVestingSupply: AddressLike): Promise<IContractsUser> {
    const users = contractsUsers.users;
    const contracts = contractsUsers.contracts;

    const cvgControlTower = contractsUsers.contracts.base.cvgControlTower;
    const CvgFactory = await ethers.getContractFactory("Cvg");
    const cvgContract = await CvgFactory.deploy(cvgControlTower, receiverVestingSupply, users.treasuryAirdrop);
    await cvgContract.waitForDeployment();

    await (await cvgControlTower.connect(users.treasuryDao).setCvg(cvgContract)).wait();

    return {
        users: users,
        contracts: {
            ...contracts,
            tokens: {
                ...contracts.tokens,
                cvg: cvgContract,
            },
        },
    };
}
