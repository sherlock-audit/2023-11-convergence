import {FACTORY_PLAIN_POOL} from "../../../resources/curve";
import {ICrvPoolPlain} from "../../../typechain-types";
import {IContractsUser} from "../../../utils/contractInterface";
import {ethers} from "hardhat";

export async function deployLiquidityCvgSdt(contractsUsers: IContractsUser, isSetAndApprove: boolean): Promise<IContractsUser> {
    const {users, contracts} = contractsUsers;
    const tokens = contracts.tokens;
    const curveFactoryPlain = await ethers.getContractAt("ICrvFactoryPlain", FACTORY_PLAIN_POOL);

    const cvgSdt = tokens.cvgSdt;
    const sdt = tokens.sdt;
    const AddressZero = ethers.ZeroAddress;

    const tx = await curveFactoryPlain.deploy_plain_pool(
        "cvgSDT", //name
        "cvgSDT", //symbol
        [sdt, cvgSdt, AddressZero, AddressZero], //coins
        "10", //A  => Same as sdCRV param
        "4000000", //fee => Same as sdCRV param
        "3", //asset_type
        "3" //implementation_idx
    );
    await tx.wait();
    const poolAddress = await curveFactoryPlain.find_pool_for_coins(sdt, cvgSdt, 0);
    const cvgSdtPoolContract = await ethers.getContractAt("ICrvPoolPlain", poolAddress);
    const amount = ethers.parseEther("10000");

    await sdt.approve(cvgSdt, amount);
    await cvgSdt.mint(users.owner, amount);

    await (await sdt.approve(poolAddress, ethers.MaxUint256)).wait();
    await (await cvgSdt.approve(poolAddress, ethers.MaxUint256)).wait();

    await cvgSdtPoolContract["add_liquidity(uint256[2],uint256)"]([amount, amount], "0"); //1$

    await (await contracts.base.cvgControlTower.connect(users.treasuryDao).setPoolCvgSdt(cvgSdtPoolContract)).wait();

    return {
        ...contractsUsers,
        contracts: {
            ...contracts,
            lp: {
                ...contracts.lp,
                stablePoolCvgSdt: cvgSdtPoolContract,
            },
        },
    };
}
