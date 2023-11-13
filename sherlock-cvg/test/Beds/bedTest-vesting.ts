import {ethers, network} from "hardhat";
import {IContractsUser} from "../../utils/contractInterface";
import {GlobalHelper} from "../../utils/GlobalHelper";
import {REAL_IBO_PARAMETERS} from "../../resources/vesting";
import {time} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import {PRESALE_SEED} from "../../resources/cvg-mainnet";

export async function bedTestVestingDistributeInitTokens(contractsUsers: IContractsUser) {
    const contracts = contractsUsers.contracts;
    const users = contractsUsers.users;
    const tokens = contracts.tokens;
    const dai = tokens.dai;
    const frax = tokens.frax;

    const presaleContractSeed = contracts.presaleVesting.seedPresale;
    const presaleContractWl = contracts.presaleVesting.wlPresaleCvg;

    // approve max amount for every user
    await dai.connect(users.user1).approve(presaleContractSeed, ethers.MaxUint256);
    await dai.connect(users.user3).approve(presaleContractSeed, ethers.MaxUint256);
    await dai.connect(users.user5).approve(presaleContractSeed, ethers.MaxUint256);
    await dai.connect(users.user6).approve(presaleContractSeed, ethers.MaxUint256);
    await frax.connect(users.user2).approve(presaleContractSeed, ethers.MaxUint256);
    await frax.connect(users.user4).approve(presaleContractSeed, ethers.MaxUint256);

    await dai.connect(users.user1).approve(presaleContractWl, ethers.MaxUint256);
    await frax.connect(users.user2).approve(presaleContractWl, ethers.MaxUint256);
    await dai.connect(users.user7).approve(presaleContractWl, ethers.MaxUint256);
    await dai.connect(users.user8).approve(presaleContractWl, ethers.MaxUint256);
    await dai.connect(users.user9).approve(presaleContractWl, ethers.MaxUint256);
    await dai.connect(users.user10).approve(presaleContractWl, ethers.MaxUint256);
    await dai.connect(users.user11).approve(presaleContractWl, ethers.MaxUint256);
    await dai.connect(users.user12).approve(presaleContractWl, ethers.MaxUint256);

    await frax.connect(users.user4).approve(presaleContractWl, ethers.MaxUint256);
    await dai.connect(users.user5).approve(presaleContractWl, ethers.MaxUint256);
}

export async function bedTestVestingMintSeedTokens(contractsUsers: IContractsUser) {
    const contracts = contractsUsers.contracts;

    const preseedContract = await ethers.getContractAt("SeedPresaleCvg", PRESALE_SEED);

    contracts.presaleVesting.seedPresale = preseedContract;
}

export async function bedTestVestingMintWlTokens(contractsUsers: IContractsUser) {
    const contracts = contractsUsers.contracts;
    const users = contractsUsers.users;
    const tokens = contracts.tokens;

    const dai = tokens.dai;
    const frax = tokens.frax;
    const presaleContractWl = contracts.presaleVesting.wlPresaleCvg;

    // approve max amount for every user
    await dai.connect(users.user1).approve(presaleContractWl, ethers.MaxUint256);
    await dai.connect(users.user2).approve(presaleContractWl, ethers.MaxUint256);
    await frax.connect(users.user4).approve(presaleContractWl, ethers.MaxUint256);
    await frax.connect(users.user5).approve(presaleContractWl, ethers.MaxUint256);
    await dai.connect(users.user7).approve(presaleContractWl, ethers.MaxUint256);
    await frax.connect(users.user9).approve(presaleContractWl, ethers.MaxUint256);
    await dai.connect(users.user10).approve(presaleContractWl, ethers.MaxUint256);

    const merkleProof7 = GlobalHelper.getProofMerkle(contracts.presaleVesting.wl.S_wlAddresses, await users.user7.getAddress());
    await presaleContractWl.connect(users.user7).investMint(merkleProof7, ethers.parseEther("200"), true, 2); // 200 to 7 with DAI & SMALL

    const merkleProof4 = GlobalHelper.getProofMerkle(contracts.presaleVesting.wl.M_wlAddresses, await users.user4.getAddress());
    await presaleContractWl.connect(users.user4).investMint(merkleProof4, ethers.parseEther("1200"), false, 3); // 1200 to 4 with FRAX & MEDIUM

    const merkleProof1 = GlobalHelper.getProofMerkle(contracts.presaleVesting.wl.L_wlAddresses, await users.user1.getAddress());
    await presaleContractWl.connect(users.user1).investMint(merkleProof1, ethers.parseEther("2000"), true, 4); // 2000 to 1 with DAI & LARGE
}

export async function bedTestIboMinting(contractsUsers: IContractsUser) {
    const users = contractsUsers.users;
    const tokens = contractsUsers.contracts.tokens;

    const frax = tokens.frax;
    const iboContract = contractsUsers.contracts.presaleVesting.ibo;

    // approve max amount for every user
    await frax.connect(users.user10).approve(iboContract, ethers.MaxUint256);
    await frax.connect(users.user11).approve(iboContract, ethers.MaxUint256);
    await iboContract.connect(users.treasuryBonds).createBond(REAL_IBO_PARAMETERS.FRAX.BOND_PARAMETERS);
    await iboContract.connect(users.treasuryBonds).setStartTimestamp(await time.latest());
    await time.increase(45 * 60);

    await iboContract.connect(users.user10).deposit(0, 1, ethers.parseEther("500"), ethers.parseEther("1000"), 0, [ethers.ZeroHash]); // 200 to 7 with DAI & SMALL
    // Finish the IBO
    await time.increase(7 * 864000);
}
