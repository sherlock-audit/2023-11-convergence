import {TOKEN_ADDR_CRVUSD, TOKEN_ADDR_FRAX, TOKEN_ADDR_USDC} from "./tokens/common";
import {IOracleStruct} from "../typechain-types/contracts/Oracles/CvgOracle";
import {
    CHAINLINK_CRVUSD_USD,
    CHAINLINK_CRV_USD,
    CHAINLINK_CVX_USD,
    CHAINLINK_DAI_USD,
    CHAINLINK_ETH_USD,
    CHAINLINK_FRAX_USD,
    CHAINLINK_FXS_USD,
    CHAINLINK_USDC_USD,
    CHAINLINK_USDT_USD,
} from "./aggregators";
import {CRV_DUO_ETH_CNC, CRV_DUO_ETH_CVX, CRV_DUO_SDT_FRAX_BP, CRV_TRI_CRYPTO_CRV, UNIV2_FXS_FRAX, UNIV3_USDC_ETH} from "./lp";

import {ethers} from "hardhat";
const STABLE = 0;
const UNIV2 = 1;
const UNIV3 = 2;
const CURVE_NORMAL = 3;
const CURVE_TRIPOOL = 4;

export const DAI_ORACLE_PARAMS: IOracleStruct.OracleParamsStruct = {
    poolAddress: ethers.ZeroAddress,
    poolType: STABLE,
    isReversed: false,
    isEthPriceRelated: false,
    aggregatorOracle: CHAINLINK_DAI_USD,
    deltaLimitOracle: 1000,
    twapOrK: 0,
    minPrice: "1",
    maxPrice: ethers.parseEther("10000000000"),
    stablesToCheck: [],
    maxLastUpdate: 86_400,
};

export const FRAX_ORACLE_PARAMS: IOracleStruct.OracleParamsStruct = {
    poolAddress: ethers.ZeroAddress,
    poolType: STABLE,
    isReversed: false,
    isEthPriceRelated: false,
    aggregatorOracle: CHAINLINK_FRAX_USD,
    deltaLimitOracle: 1000,
    twapOrK: 0,
    minPrice: "1",
    maxPrice: ethers.parseEther("10000000000"),
    stablesToCheck: [],
    maxLastUpdate: 86_400,
};

export const WETH_ORACLE_PARAMS: IOracleStruct.OracleParamsStruct = {
    poolAddress: UNIV3_USDC_ETH,
    poolType: UNIV3,
    isReversed: true,
    isEthPriceRelated: false,
    aggregatorOracle: CHAINLINK_ETH_USD,
    deltaLimitOracle: 1_200,
    twapOrK: 30,
    minPrice: "1",
    maxPrice: ethers.parseEther("10000000000"),
    stablesToCheck: [TOKEN_ADDR_USDC],
    maxLastUpdate: 86_400,
};

export const CRV_ORACLE_PARAMS: IOracleStruct.OracleParamsStruct = {
    poolAddress: CRV_TRI_CRYPTO_CRV,
    poolType: CURVE_TRIPOOL,
    isReversed: false,
    isEthPriceRelated: false,
    aggregatorOracle: CHAINLINK_CRV_USD,
    deltaLimitOracle: 200,
    twapOrK: 1,
    minPrice: "1",
    maxPrice: ethers.parseEther("10000000000"),
    stablesToCheck: [TOKEN_ADDR_CRVUSD],
    maxLastUpdate: 86_400,
};

export const CVX_ORACLE_PARAMS: IOracleStruct.OracleParamsStruct = {
    poolAddress: CRV_DUO_ETH_CVX,
    poolType: CURVE_NORMAL,
    isReversed: false,
    isEthPriceRelated: true,
    aggregatorOracle: CHAINLINK_CVX_USD,
    deltaLimitOracle: 200,
    twapOrK: 0,
    minPrice: "1",
    maxPrice: ethers.parseEther("10000000000"),
    stablesToCheck: [],
    maxLastUpdate: 86_400,
};

export const FXS_ORACLE_PARAMS: IOracleStruct.OracleParamsStruct = {
    poolAddress: UNIV2_FXS_FRAX,
    poolType: UNIV2,
    isReversed: true,
    isEthPriceRelated: false,
    aggregatorOracle: CHAINLINK_FXS_USD,
    deltaLimitOracle: 1000,
    twapOrK: 0,
    minPrice: "1",
    maxPrice: ethers.parseEther("10000000000"),
    stablesToCheck: [TOKEN_ADDR_FRAX],
    maxLastUpdate: 86_400,
};

export const SDT_ORACLE_PARAMS: IOracleStruct.OracleParamsStruct = {
    poolAddress: CRV_DUO_SDT_FRAX_BP,
    poolType: CURVE_NORMAL,
    isReversed: true,
    isEthPriceRelated: false,
    aggregatorOracle: ethers.ZeroAddress,
    deltaLimitOracle: 1000,
    twapOrK: 0,
    minPrice: "1",
    maxPrice: ethers.parseEther("10000000000"),
    stablesToCheck: [TOKEN_ADDR_FRAX, TOKEN_ADDR_USDC],
    maxLastUpdate: 86_400,
};

export const CNC_ORACLE_PARAMS: IOracleStruct.OracleParamsStruct = {
    poolAddress: CRV_DUO_ETH_CNC,
    poolType: CURVE_NORMAL,
    isReversed: false,
    isEthPriceRelated: true,
    aggregatorOracle: ethers.ZeroAddress,
    deltaLimitOracle: 1000,
    twapOrK: 0,
    minPrice: "1",
    maxPrice: ethers.parseEther("10000000000"),
    stablesToCheck: [],
    maxLastUpdate: 86_400,
};

export const USDC_ORACLE_PARAMS: IOracleStruct.OracleParamsStruct = {
    poolAddress: ethers.ZeroAddress,
    poolType: STABLE,
    isReversed: false,
    isEthPriceRelated: false,
    aggregatorOracle: CHAINLINK_USDC_USD,
    deltaLimitOracle: 1000,
    twapOrK: 0,
    minPrice: "1",
    maxPrice: ethers.parseEther("10000000000"),
    stablesToCheck: [],
    maxLastUpdate: 86_400,
};

export const CRVUSD_ORACLE_PARAMS: IOracleStruct.OracleParamsStruct = {
    poolAddress: ethers.ZeroAddress,
    poolType: STABLE,
    isReversed: false,
    isEthPriceRelated: false,
    aggregatorOracle: CHAINLINK_CRVUSD_USD,
    deltaLimitOracle: 1000,
    twapOrK: 0,
    minPrice: "1",
    maxPrice: ethers.parseEther("10000000000"),
    stablesToCheck: [],
    maxLastUpdate: 86_400,
};

export const USDT_ORACLE_PARAMS: IOracleStruct.OracleParamsStruct = {
    poolAddress: ethers.ZeroAddress,
    poolType: STABLE,
    isReversed: false,
    isEthPriceRelated: false,
    aggregatorOracle: CHAINLINK_USDT_USD,
    deltaLimitOracle: 1000,
    twapOrK: 0,
    minPrice: "1",
    maxPrice: ethers.parseEther("10000000000"),
    stablesToCheck: [],
    maxLastUpdate: 86_400,
};
