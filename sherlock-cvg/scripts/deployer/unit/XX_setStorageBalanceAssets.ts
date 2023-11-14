import {IContractsUser} from "../../../utils/contractInterface";
import {parseEther, parseUnits} from "ethers";

import {giveTokensToAddresses} from "../../../utils/thief/thiefv2";
import {ethers} from "hardhat";
import {
    TOKEN_ADDR_3CRV,
    TOKEN_ADDR_CNC,
    TOKEN_ADDR_CRV,
    TOKEN_ADDR_CVX,
    TOKEN_ADDR_DAI,
    TOKEN_ADDR_FRAX,
    TOKEN_ADDR_FRAXBP,
    TOKEN_ADDR_FXS,
    TOKEN_ADDR_SDT,
    TOKEN_ADDR_USDC,
    TOKEN_ADDR_USDT,
    TOKEN_ADDR_WETH,
} from "../../../resources/tokens/common";
import {THIEF_TOKEN_CONFIG} from "../../../utils/thief/thiefConfig";
import {TOKEN_ADDR_CRVCRVUSDTBTCWSTETH} from "../../../resources/tokens/stake-dao";

export async function setStorageBalanceAssets(contractsUsers: IContractsUser): Promise<IContractsUser> {
    await giveTokensToAddresses(contractsUsers.users.allUsers, [
        {token: THIEF_TOKEN_CONFIG["DAI"], amount: parseEther("100000000")},
        {token: THIEF_TOKEN_CONFIG["FRAX"], amount: parseEther("100000000")},
        {token: THIEF_TOKEN_CONFIG["WETH"], amount: parseEther("100000000")},
        {token: THIEF_TOKEN_CONFIG["CRV"], amount: parseEther("100000000")},
        {token: THIEF_TOKEN_CONFIG["CVX"], amount: parseEther("100000000")},
        {token: THIEF_TOKEN_CONFIG["CNC"], amount: parseEther("100000000")}, //
        {token: THIEF_TOKEN_CONFIG["FXS"], amount: parseEther("100000000")}, //
        {token: THIEF_TOKEN_CONFIG["SDT"], amount: parseEther("100000000")}, //
        {token: THIEF_TOKEN_CONFIG["FRAXBP"], amount: parseEther("100000000")}, //
        {token: THIEF_TOKEN_CONFIG["USDC"], amount: parseUnits("100000000", 6)},
        {token: THIEF_TOKEN_CONFIG["USDT"], amount: parseUnits("100000000", 6)},
        {token: THIEF_TOKEN_CONFIG["_3CRV"], amount: parseEther("100000000")},
    ]);

    const dai = await ethers.getContractAt("ERC20", TOKEN_ADDR_DAI);
    const frax = await ethers.getContractAt("ERC20", TOKEN_ADDR_FRAX);
    const weth = await ethers.getContractAt("ERC20", TOKEN_ADDR_WETH);
    const crv = await ethers.getContractAt("ERC20", TOKEN_ADDR_CRV);
    const cvx = await ethers.getContractAt("ERC20", TOKEN_ADDR_CVX);
    const cnc = await ethers.getContractAt("ERC20", TOKEN_ADDR_CNC);
    const fxs = await ethers.getContractAt("ERC20", TOKEN_ADDR_FXS);
    const sdt = await ethers.getContractAt("ERC20", TOKEN_ADDR_SDT);
    const fraxBp = await ethers.getContractAt("ERC20", TOKEN_ADDR_FRAXBP);
    const usdc = await ethers.getContractAt("ERC20", TOKEN_ADDR_USDC);
    const usdt = await ethers.getContractAt("ERC20", TOKEN_ADDR_USDT);
    const _3crv = await ethers.getContractAt("ERC20", TOKEN_ADDR_3CRV);

    return {
        ...contractsUsers,
        contracts: {
            ...contractsUsers.contracts,
            tokens: {
                ...contractsUsers.contracts.tokens,
                dai,
                frax,
                weth,
                crv,
                cvx,
                cnc,
                fxs,
                sdt,
                usdc,
                usdt,
                fraxBp,
                _3crv,
            },
        },
    };
}
