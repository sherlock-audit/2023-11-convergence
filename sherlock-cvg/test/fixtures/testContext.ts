import {ethers, upgrades} from "hardhat";
import {IContracts, IContractsUser, IUsers} from "../../utils/contractInterface";

import deployers from "../../scripts/deployer/unit/_index";
import {linkPreseed} from "../../scripts/linkers/preseed";
import {linkCvgPepe} from "../../scripts/linkers/cvgPepe";
import {HardhatEthersHelpers} from "hardhat/types";
import {HardhatEthersSigner} from "@nomicfoundation/hardhat-ethers/signers";
export async function deployOnlyControlTower(): Promise<IContractsUser> {
    let users = await configureAccounts();

    let contracts = {} as unknown as IContracts;
    let contractsUsers: IContractsUser = {contracts, users} as unknown as IContractsUser;

    contractsUsers = await deployers.deployProxyAdmin(contractsUsers);
    contractsUsers = await deployers.deployControlTowerContract(contractsUsers);
    contractsUsers = await deployers.deployCloneFactoryContract(contractsUsers);
    return contractsUsers;
}

export async function deployBase(isPresale = false): Promise<IContractsUser> {
    let users = await configureAccounts();

    let contracts = {} as unknown as IContracts;
    let contractsUsers: IContractsUser = {contracts, users} as unknown as IContractsUser;

    contractsUsers = await deployers.deployProxyAdmin(contractsUsers);
    contractsUsers = await deployers.deployControlTowerContract(contractsUsers);

    contractsUsers = await deployers.deployCloneFactoryContract(contractsUsers);
    contractsUsers = await deployers.setStorageBalanceAssets(contractsUsers);
    let receiver = users.owner.address;
    if (isPresale) {
        contractsUsers = await linkPreseed(contractsUsers);
        // contractsUsers = await linkCvgPepe(contractsUsers);
        contractsUsers = await deployers.deployPresaleWl(contractsUsers);
        contractsUsers = await deployers.deployBondCalculatorContract(contractsUsers, true);
        contractsUsers = await deployers.deployOracleContract(contractsUsers, true);

        contractsUsers = await deployers.deployIbo(contractsUsers);

        contractsUsers = await deployers.deployVestingContract(contractsUsers);

        receiver = await contractsUsers.contracts.presaleVesting.vestingCvg.getAddress();
    }
    contractsUsers = await deployers.deployCvgTokenContract(contractsUsers, false, receiver);
    return contractsUsers;
}

export async function configureAccounts(): Promise<IUsers> {
    const signers = await ethers.getSigners();
    const owner = signers[0];
    const user1 = signers[1];
    const user2 = signers[2];
    const user3 = signers[3];
    const user4 = signers[4];
    const user5 = signers[5];
    const user6 = signers[6];
    const user7 = signers[7];
    const user8 = signers[8];
    const user9 = signers[9];
    const user10 = signers[10];
    const user11 = signers[11];
    const user12 = signers[12];
    const treasuryDao = signers[13];
    const treasuryCore = signers[14];
    const treasuryBonds = signers[15];
    const treasuryAirdrop = signers[16];
    const veSdtMultisig = signers[17];

    const allUsers = [owner, user1, user2, user3, user4, user5, user6, user7, user8, user9, user10, user11, user12];
    const classicWl = [user2.address, user3.address, user4.address, user5.address, user6.address];
    return {
        owner,
        user1,
        user2,
        user3,
        user4,
        user5,
        user6,
        user7,
        user8,
        user9,
        user10,
        user11,
        user12,
        treasuryDao,
        treasuryBonds,
        veSdtMultisig,
        treasuryAirdrop,
        treasuryCore,
        allUsers,
        classicWl,
    };
}

export const erc20ArtifactName = "@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20";

const emptySwapTransaction = {
    executor: ethers.ZeroAddress,
    description: {
        srcToken: ethers.ZeroAddress,
        dstToken: ethers.ZeroAddress,
        srcReceiver: ethers.ZeroAddress,
        dstReceiver: ethers.ZeroAddress,
        amount: 0,
        minReturnAmount: 0,
        flags: 0,
    },
    permit: ethers.ZeroHash,
    data: ethers.ZeroHash,
};
