import {ethers} from "hardhat";
import {
    TOKEN_ADDR_SD_FRAX_3CRV,
    TOKEN_ADDR_SD_CRV,
    TOKEN_ADDR_SD_BAL,
    TOKEN_ADDR_SD_PENDLE,
    TOKEN_ADDR_SD_ANGLE,
    TOKEN_ADDR_SD_FXS,
    TOKEN_ADDR_SD_CRV_GAUGE,
    TOKEN_ADDR_SD_PENDLE_GAUGE,
    TOKEN_ADDR_SD_BAL_GAUGE,
    TOKEN_ADDR_SD_FXS_GAUGE,
    TOKEN_ADDR_SD_ANGLE_GAUGE,
    TOKEN_ADDR_BB_A_USD,
    TOKEN_ADDR_BAL,
    TOKEN_ADDR_ANGLE,
    TOKEN_ADDR_AG_EUR,
    TOKEN_ADDR_SAN_USDC_EUR,
    TOKEN_ADDR_TRILLAMA_GAUGE,
} from "../../../resources/tokens/stake-dao";
import {IContractsUser} from "../../../utils/contractInterface";
import {THIEF_TOKEN_CONFIG} from "../../../utils/thief/thiefConfig";
import {giveTokensToAddresses} from "../../../utils/thief/thiefv2";
import {CRV_TRI_CRYPTO_LLAMA} from "../../../resources/lp";

export async function fetchStakeDaoTokens(contractsUsers: IContractsUser): Promise<IContractsUser> {
    const {users, contracts} = contractsUsers;
    await giveTokensToAddresses(
        [users.owner, users.user1, users.user2, users.user3, users.user4],
        [
            {token: THIEF_TOKEN_CONFIG.sdFRAX3CRV, amount: ethers.parseEther("100000000")},
            {token: THIEF_TOKEN_CONFIG.SD_CRV, amount: ethers.parseEther("100000000")},
            {token: THIEF_TOKEN_CONFIG.SD_ANGLE, amount: ethers.parseEther("100000000")},
            {token: THIEF_TOKEN_CONFIG.SD_BAL, amount: ethers.parseEther("100000000")},
            {token: THIEF_TOKEN_CONFIG.SD_FXS, amount: ethers.parseEther("100000000")},
            {token: THIEF_TOKEN_CONFIG.SD_PENDLE, amount: ethers.parseEther("100000000")},
            // Rewards BAL
            {token: THIEF_TOKEN_CONFIG.BB_A_USD, amount: ethers.parseEther("100000000")},
            {token: THIEF_TOKEN_CONFIG.BAL, amount: ethers.parseEther("100000000")},

            // Rewards ANGLE
            {token: THIEF_TOKEN_CONFIG.SAN_USD_EUR, amount: ethers.parseUnits("100000000", 6)},
            {token: THIEF_TOKEN_CONFIG.AG_EUR, amount: ethers.parseEther("100000000")},
            {token: THIEF_TOKEN_CONFIG.ANGLE, amount: ethers.parseEther("100000000")},

            {token: THIEF_TOKEN_CONFIG.wsETH, amount: ethers.parseEther("100000000")},

            {token: THIEF_TOKEN_CONFIG.TRI_LLAMA, amount: ethers.parseEther("100000000")},
            {token: THIEF_TOKEN_CONFIG.FRX_ETH_ETH, amount: ethers.parseEther("100000000")},
            {token: THIEF_TOKEN_CONFIG._80_BAL_20_WETH, amount: ethers.parseEther("100000000")},
        ]
    );

    // Fetch all Sd assets & SdAssets Gauges
    const sdFrax3Crv = await ethers.getContractAt("ERC20", TOKEN_ADDR_SD_FRAX_3CRV);
    const sdCrv = await ethers.getContractAt("ISdAsset", TOKEN_ADDR_SD_CRV);
    const sdBal = await ethers.getContractAt("ISdAsset", TOKEN_ADDR_SD_BAL);
    const sdPendle = await ethers.getContractAt("ISdAsset", TOKEN_ADDR_SD_PENDLE);
    const sdAngle = await ethers.getContractAt("ISdAsset", TOKEN_ADDR_SD_ANGLE);
    const sdFxs = await ethers.getContractAt("ISdAsset", TOKEN_ADDR_SD_FXS);

    const sdCrvGauge = await ethers.getContractAt("ISdAssetGauge", TOKEN_ADDR_SD_CRV_GAUGE);
    const sdPendleGauge = await ethers.getContractAt("ISdAssetGauge", TOKEN_ADDR_SD_PENDLE_GAUGE);
    const sdBalGauge = await ethers.getContractAt("ISdAssetGauge", TOKEN_ADDR_SD_BAL_GAUGE);
    const sdFxsGauge = await ethers.getContractAt("ISdAssetGauge", TOKEN_ADDR_SD_FXS_GAUGE);
    const sdAngleGauge = await ethers.getContractAt("ISdAssetGauge", TOKEN_ADDR_SD_ANGLE_GAUGE);

    const bal = await ethers.getContractAt("ERC20", TOKEN_ADDR_BAL);
    const bbAUsd = await ethers.getContractAt("ERC20", TOKEN_ADDR_BB_A_USD);

    const sanUsdEur = await ethers.getContractAt("ERC20", TOKEN_ADDR_SAN_USDC_EUR);
    const agEur = await ethers.getContractAt("ERC20", TOKEN_ADDR_AG_EUR);
    const angle = await ethers.getContractAt("ERC20", TOKEN_ADDR_ANGLE);
    const _80bal_20weth = await ethers.getContractAt("ERC20", THIEF_TOKEN_CONFIG._80_BAL_20_WETH.address);

    const crvCRVUSDTBTCWSTETH = await ethers.getContractAt("ERC20", CRV_TRI_CRYPTO_LLAMA);
    const crvCRVUSDTBTCWSTETHGauge = await ethers.getContractAt("ISdAssetGauge", TOKEN_ADDR_TRILLAMA_GAUGE);

    return {
        ...contractsUsers,
        contracts: {
            ...contracts,
            tokensStakeDao: {
                sdAngle,
                sdAngleGauge,
                sdBal,
                sdBalGauge,
                sdCrv,
                sdCrvGauge,
                sdFxs,
                sdFxsGauge,
                sdPendle,
                sdPendleGauge,
                sdFrax3Crv,
                bal,
                bbAUsd,
                sanUsdEur,
                agEur,
                angle,
                crvCRVUSDTBTCWSTETH,
                crvCRVUSDTBTCWSTETHGauge,
                _80bal_20weth,
            },
        },
    };
}
