import {ethers} from "hardhat";
import {IContractsUser} from "../../../utils/contractInterface";
import {GlobalHelper} from "../../../utils/GlobalHelper";

export async function deployPresaleWl(contractsUsers: IContractsUser): Promise<IContractsUser> {
    const {users, contracts} = contractsUsers;
    const tokens = contracts.tokens;
    const dai = tokens.dai;
    const frax = tokens.frax;

    //get rootMerkles
    const wlAddressesS = [await users.user7.getAddress(), await users.user8.getAddress(), await users.user9.getAddress(), await users.user10.getAddress()];
    const wlAddressesM = [await users.user4.getAddress(), await users.user5.getAddress(), await users.user6.getAddress()];
    const wlAddressesL = [await users.user1.getAddress(), await users.user2.getAddress(), await users.user3.getAddress()];

    const rootWlS = GlobalHelper.getRoot(wlAddressesS);
    const rootWlM = GlobalHelper.getRoot(wlAddressesM);
    const rootWlL = GlobalHelper.getRoot(wlAddressesL);

    const presaleContractWl = await ethers.deployContract("WlPresaleCvg", [rootWlS, rootWlM, rootWlL, dai, frax, users.treasuryDao]);
    await presaleContractWl.waitForDeployment();

    return {
        ...contractsUsers,
        contracts: {
            ...contracts,
            presaleVesting: {
                ...contracts.presaleVesting,
                wlPresaleCvg: presaleContractWl,
                wl: {
                    S_wlAddresses: wlAddressesS,
                    M_wlAddresses: wlAddressesM,
                    L_wlAddresses: wlAddressesL,
                },
            },
        },
    };
}
