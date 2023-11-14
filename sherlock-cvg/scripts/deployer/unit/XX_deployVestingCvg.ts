import {ethers} from "hardhat";
import {IContractsUser} from "../../../utils/contractInterface";

export async function deployVestingContract(contractsUsers: IContractsUser): Promise<IContractsUser> {
    const {users, contracts} = contractsUsers;
    const cvgControlTower = contracts.base.cvgControlTower;
    const presaleVestingContracts = contracts.presaleVesting;
    const VestingCvgFactory = await ethers.getContractFactory("VestingCvg");
    const vestingCvg = await VestingCvgFactory.deploy(presaleVestingContracts.wlPresaleCvg, presaleVestingContracts.seedPresale, presaleVestingContracts.ibo);
    await vestingCvg.waitForDeployment();

    //transfer ownership
    await vestingCvg.transferOwnership(users.treasuryDao);
    await vestingCvg.connect(users.treasuryDao).acceptOwnership();

    await (await cvgControlTower.connect(users.treasuryDao).setVestingCvg(vestingCvg)).wait();

    return {
        ...contractsUsers,
        contracts: {
            ...contracts,
            presaleVesting: {
                ...contracts.presaleVesting,
                vestingCvg: vestingCvg,
            },
        },
    };
}
