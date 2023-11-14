import {
    CRV_DUO_AGEUR_EUROC,
    CRV_DUO_ALUSD_FRAXBP,
    CRV_DUO_COIL_FRAXBP,
    CRV_DUO_CVXCRV_CRV,
    CRV_DUO_DOLA_CRVUSD,
    CRV_DUO_ETH_CNC,
    CRV_DUO_ETH_RETH,
    CRV_DUO_FRAXBP,
    CRV_DUO_FRXETH_ETH,
    CRV_DUO_MIM_3CRV,
    CRV_DUO_MKUSD_FRAXBP,
    CRV_DUO_SDCRV_CRV,
    CRV_DUO_SDFXS_FXS,
    CRV_DUO_SETH_ETH,
    CRV_DUO_STG_USDC,
    CRV_DUO_SUSD_CRVUSD,
    CRV_DUO_USDC_CRVUSD,
    CRV_DUO_USDT_CRVUSD,
    CRV_DUO_XAI_CRVUSD,
    CRV_DUO_XAI_FRAXBP,
    CRV_TRI_CRVUSD_FRXETH_SDT,
    CRV_TRI_CRYPTO_1,
    CRV_TRI_CRYPTO_2,
    CRV_TRI_CRYPTO_3,
    CRV_TRI_CRYPTO_CRV,
    CRV_TRI_CRYPTO_LLAMA,
} from "../../resources/lp";
import {
    TOKEN_ADDR_3CRV,
    TOKEN_ADDR_CNC,
    TOKEN_ADDR_CRV,
    TOKEN_ADDR_CRVUSD,
    TOKEN_ADDR_CVX,
    TOKEN_ADDR_DAI,
    TOKEN_ADDR_FRAX,
    TOKEN_ADDR_FRAXBP,
    TOKEN_ADDR_FXS,
    TOKEN_ADDR_SDT,
    TOKEN_ADDR_USDC,
    TOKEN_ADDR_USDT,
    TOKEN_ADDR_WETH,
    TOKEN_ADDR_WSTETH,
} from "../../resources/tokens/common";
import {
    TOKEN_ADDR_80BAL_20WETH,
    TOKEN_ADDR_AG_EUR,
    TOKEN_ADDR_ANGLE,
    TOKEN_ADDR_BAL,
    TOKEN_ADDR_BB_A_USD,
    TOKEN_ADDR_ETH_RETH_GAUGE,
    TOKEN_ADDR_FXN,
    TOKEN_ADDR_PENDLE,
    TOKEN_ADDR_SAN_USDC_EUR,
    TOKEN_ADDR_SD_ANGLE,
    TOKEN_ADDR_SD_ANGLE_GAUGE,
    TOKEN_ADDR_SD_BAL,
    TOKEN_ADDR_SD_BAL_GAUGE,
    TOKEN_ADDR_SD_CRV,
    TOKEN_ADDR_SD_CRV_GAUGE,
    TOKEN_ADDR_SD_FRAX_3CRV,
    TOKEN_ADDR_SD_FXN,
    TOKEN_ADDR_SD_FXN_GAUGE,
    TOKEN_ADDR_SD_FXS,
    TOKEN_ADDR_SD_FXS_GAUGE,
    TOKEN_ADDR_SD_PENDLE,
    TOKEN_ADDR_SD_PENDLE_GAUGE,
} from "../../resources/tokens/stake-dao";

export const SDASSET_GAUGE_TOKENS = {
    sdCRV: {
        ticker: "sdCRV",
        isVyper: true,
        slotBalance: 12,
        address: TOKEN_ADDR_SD_CRV_GAUGE,
    },
    sdANGLE: {
        ticker: "sdANGLE",
        isVyper: true,
        slotBalance: 12,
        address: TOKEN_ADDR_SD_ANGLE_GAUGE,
    },
    sdFXS: {
        ticker: "sdFXS",
        isVyper: true,
        slotBalance: 12,
        address: TOKEN_ADDR_SD_FXS_GAUGE,
    },
    sdBAL: {
        ticker: "sdBAL",
        isVyper: true,
        slotBalance: 12,
        address: TOKEN_ADDR_SD_BAL_GAUGE,
    },
    sdPENDLE: {
        ticker: "sdPENDLE",
        isVyper: true,
        slotBalance: 12,
        address: TOKEN_ADDR_SD_PENDLE_GAUGE,
    },
    sdFXN: {
        ticker: "sdFXN",
        isVyper: true,
        slotBalance: 12,
        address: TOKEN_ADDR_SD_FXN_GAUGE,
    },
};

export const THIEF_TOKEN_CONFIG = {
    DAI: {
        isVyper: false,
        slotBalance: 2,
        address: TOKEN_ADDR_DAI,
        decimals: 18,
    },
    FRAX: {
        isVyper: false,
        slotBalance: 0,
        address: TOKEN_ADDR_FRAX,
        decimals: 18,
    },
    WETH: {
        isVyper: false,
        slotBalance: 3,
        address: TOKEN_ADDR_WETH,
        decimals: 18,
    },
    CRV: {
        isVyper: true,
        slotBalance: 3,
        address: TOKEN_ADDR_CRV,
        decimals: 18,
    },
    CVX: {
        isVyper: false,
        slotBalance: 0,
        address: TOKEN_ADDR_CVX,
        decimals: 18,
    },
    CNC: {
        isVyper: false,
        slotBalance: 0,
        address: TOKEN_ADDR_CNC,
        decimals: 18,
    },
    FXS: {
        isVyper: false,
        slotBalance: 0,
        address: TOKEN_ADDR_FXS,
        decimals: 18,
    },
    PENDLE: {
        isVyper: false,
        slotBalance: 15,
        address: TOKEN_ADDR_PENDLE,
        decimals: 18,
    },
    SDT: {
        isVyper: false,
        slotBalance: 0,
        address: TOKEN_ADDR_SDT,
        decimals: 18,
    },
    FRAXBP: {
        isVyper: true,
        slotBalance: 7,
        address: TOKEN_ADDR_FRAXBP,
        decimals: 18,
    },
    USDC: {
        isVyper: false,
        slotBalance: 9,
        address: TOKEN_ADDR_USDC,
        decimals: 6,
    },
    USDT: {
        isVyper: false,
        slotBalance: 2,
        address: TOKEN_ADDR_USDT,
        decimals: 6,
    },
    _3CRV: {
        isVyper: true,
        slotBalance: 3,
        address: TOKEN_ADDR_3CRV,
        decimals: 18,
    },

    CRVUSD: {
        isVyper: true,
        slotBalance: 12,
        address: TOKEN_ADDR_CRVUSD,
        decimals: 18,
    },

    sdFRAX3CRV: {
        isVyper: false,
        slotBalance: 0,
        address: TOKEN_ADDR_SD_FRAX_3CRV,
        decimals: 18,
    },

    wsETH: {
        isVyper: false,
        slotBalance: 0,
        address: TOKEN_ADDR_WSTETH,
        decimals: 18,
    },

    SD_CRV: {
        isVyper: false,
        slotBalance: 0,
        address: TOKEN_ADDR_SD_CRV,
        decimals: 18,
    },

    SD_PENDLE: {
        isVyper: false,
        slotBalance: 0,
        address: TOKEN_ADDR_SD_PENDLE,
        decimals: 18,
    },

    SD_FXS: {
        isVyper: false,
        slotBalance: 0,
        address: TOKEN_ADDR_SD_FXS,
        decimals: 18,
    },

    // BAL

    SD_BAL: {
        isVyper: false,
        slotBalance: 0,
        address: TOKEN_ADDR_SD_BAL,
        decimals: 18,
    },

    BB_A_USD: {
        isVyper: false,
        slotBalance: 0,
        address: TOKEN_ADDR_BB_A_USD,
        decimals: 18,
    },

    BAL: {
        isVyper: false,
        slotBalance: 1,
        address: TOKEN_ADDR_BAL,
        decimals: 18,
    },

    // ANGLE

    SD_ANGLE: {
        isVyper: false,
        slotBalance: 0,
        address: TOKEN_ADDR_SD_ANGLE,
        decimals: 18,
    },

    SAN_USD_EUR: {
        isVyper: false,
        slotBalance: 51,
        address: TOKEN_ADDR_SAN_USDC_EUR,
        decimals: 6,
    },

    AG_EUR: {
        isVyper: false,
        slotBalance: 51,
        address: TOKEN_ADDR_AG_EUR,
        decimals: 18,
    },

    ANGLE: {
        isVyper: false,
        slotBalance: 0,
        address: TOKEN_ADDR_ANGLE,
        decimals: 18,
    },

    // FXN

    FXN: {
        isVyper: true,
        slotBalance: 6,
        address: TOKEN_ADDR_FXN,
        decimals: 18,
    },

    SD_FXN: {
        isVyper: false,
        slotBalance: 0,
        address: TOKEN_ADDR_SD_FXN,
        decimals: 18,
    },

    // LP
    TRICRYPTO_1: {
        isVyper: true,
        slotBalance: 23,
        address: CRV_TRI_CRYPTO_1,
        decimals: 18,
    },

    CRVUSD_USDT: {
        isVyper: true,
        slotBalance: 20,
        address: CRV_DUO_USDT_CRVUSD,
        decimals: 18,
    },

    STG_USDC: {
        isVyper: true,
        slotBalance: 6,
        address: CRV_DUO_STG_USDC,
        decimals: 18,
    },

    // TricryptoLlama V2
    TRI_LLAMA: {
        isVyper: true,
        slotBalance: 23,
        address: CRV_TRI_CRYPTO_LLAMA,
        decimals: 18,
    },

    SDCRV_CRV: {
        isVyper: true,
        slotBalance: 20,
        address: CRV_DUO_SDCRV_CRV,
        decimals: 18,
    },

    CRVUSD_USDC: {
        isVyper: true,
        slotBalance: 20,
        address: CRV_DUO_USDC_CRVUSD,
        decimals: 18,
    },

    FRX_ETH_ETH: {
        isVyper: true,
        slotBalance: 7,
        address: CRV_DUO_FRXETH_ETH,
        decimals: 18,
    },
    TRICRYPTO_2: {
        isVyper: true,
        slotBalance: 23,
        address: CRV_TRI_CRYPTO_2,
        decimals: 18,
    },

    CVXCRV_CRV: {
        isVyper: true,
        slotBalance: 20,
        address: CRV_DUO_CVXCRV_CRV,
        decimals: 18,
    },
    SDFXS_FXS: {
        isVyper: true,
        slotBalance: 20,
        address: CRV_DUO_SDFXS_FXS,
        decimals: 18,
    },

    AGEUR_EUROC: {
        isVyper: true,
        slotBalance: 24,
        address: CRV_DUO_AGEUR_EUROC,
        decimals: 18,
    },
    MIM_3CRV: {
        isVyper: true,
        slotBalance: 15,
        address: CRV_DUO_MIM_3CRV,
        decimals: 18,
    },

    FRAX_USDC: {
        isVyper: true,
        slotBalance: 24,
        address: CRV_DUO_FRAXBP,
        decimals: 18,
    },
    ALUSD_FRAX_USDC: {
        isVyper: true,
        slotBalance: 17,
        address: CRV_DUO_ALUSD_FRAXBP,
        decimals: 18,
    },
    TRICRYPTO_3: {
        isVyper: true,
        slotBalance: 2,
        address: CRV_TRI_CRYPTO_3,
        decimals: 18,
    },
    RETH_ETH: {
        isVyper: true,
        slotBalance: 2,
        address: CRV_DUO_ETH_RETH,
        decimals: 18,
    },
    CRVUSD_XAI: {
        isVyper: true,
        slotBalance: 20,
        address: CRV_DUO_XAI_CRVUSD,
        decimals: 18,
    },
    COIL_FRAX_USDC: {
        isVyper: true,
        slotBalance: 6,
        address: CRV_DUO_COIL_FRAXBP,
        decimals: 18,
    },
    CRVUSD_SUSD: {
        isVyper: true,
        slotBalance: 20,
        address: CRV_DUO_SUSD_CRVUSD,
        decimals: 18,
    },
    CRVUSD_DOLA: {
        isVyper: true,
        slotBalance: 20,
        address: CRV_DUO_DOLA_CRVUSD,
        decimals: 18,
    },

    MKUSD_FRAX_USDC: {
        isVyper: true,
        slotBalance: 17,
        address: CRV_DUO_MKUSD_FRAXBP,
        decimals: 18,
    },
    CNC_ETH: {
        isVyper: true,
        slotBalance: 6,
        address: CRV_DUO_ETH_CNC,
        decimals: 18,
    },
    XAI_FRAX_USDC: {
        isVyper: true,
        slotBalance: 17,
        address: CRV_DUO_XAI_FRAXBP,
        decimals: 18,
    },
    CRVUSD_FRXETH_SDT: {
        isVyper: true,
        slotBalance: 23,
        address: CRV_TRI_CRVUSD_FRXETH_SDT,
        decimals: 18,
    },

    TRICRV: {
        isVyper: true,
        slotBalance: 23,
        address: CRV_TRI_CRYPTO_CRV,
        decimals: 18,
    },
    STETH_ETH: {
        isVyper: true,
        slotBalance: 2,
        address: CRV_DUO_SETH_ETH,
        decimals: 18,
    },

    _80_BAL_20_WETH: {
        isVyper: false,
        slotBalance: 0,
        address: TOKEN_ADDR_80BAL_20WETH,
        decimals: 18,
    },

    SD_FRAX_3CRV: {
        isVyper: false,
        slotBalance: 0,
        address: TOKEN_ADDR_SD_FRAX_3CRV,
        decimals: 18,
    },
};
