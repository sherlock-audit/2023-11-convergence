import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {expect} from "chai";
import {ethers} from "hardhat";
import {Signer} from "ethers";
import {deployOracleFixture} from "../../fixtures/fixtures";
import {CvgOracle} from "../../../typechain-types/contracts/Oracles";
import {ApiHelper} from "../../../utils/ApiHelper";
import {
    TOKEN_ADDR_CNC,
    TOKEN_ADDR_CRV,
    TOKEN_ADDR_CVX,
    TOKEN_ADDR_FXS,
    TOKEN_ADDR_LINK,
    TOKEN_ADDR_SDT,
    TOKEN_ADDR_TOKEMAK,
    TOKEN_ADDR_USDC,
    TOKEN_ADDR_USDT,
    TOKEN_ADDR_WBTC,
    TOKEN_ADDR_WETH,
} from "../../../resources/tokens/common";
import {UNIV2_BTC_USDC, UNIV2_ETH_USDT, UNIV2_USDC_ETH, UNIV3_LINK_ETH, UNIV3_USDC_ETH, UNIV3_WBTC_ETH, UNIV3_WBTC_USDT} from "../../../resources/lp";
import {CHAINLINK_BTC_USD, CHAINLINK_ETH_USD, CHAINLINK_LINK_USD} from "../../../resources/aggregators";

describe("Oracle Testing", () => {
    const deltaPercentage = 0.1;
    const STABLE = 0;
    const UNIV2 = 1;
    const UNIV3 = 2;
    const CURVE_NORMAL = 3;
    const CURVE_TRIPOOL = 4;
    const DELTA_MAX = 250; // 2.5%
    const DELTA_MAX_FLOAT = 0.04;

    let treasuryDao: Signer;

    let cvgOracle: CvgOracle;
    let prices: any;
    let tokens: any[] = [];

    before(async () => {
        const {contracts, users} = await loadFixture(deployOracleFixture);

        const tokenContracts = contracts.tokens;

        tokens = [
            {
                token: tokenContracts.weth,
                address: TOKEN_ADDR_WETH,
                poolType: UNIV3,
            },
            {
                token: tokenContracts.crv,
                address: TOKEN_ADDR_CRV,
                poolType: CURVE_TRIPOOL,
            },
            {
                token: tokenContracts.cvx,
                address: TOKEN_ADDR_CVX,
                poolType: CURVE_NORMAL,
            },
            {
                token: tokenContracts.sdt,
                address: TOKEN_ADDR_SDT,
                poolType: CURVE_NORMAL,
            },
            // {
            //     token: tokenContracts.cncContract,
            //     name: "conic-finance",
            //     poolType: CURVE_NORMAL,
            // },

            {
                token: tokenContracts.fxs,
                address: TOKEN_ADDR_FXS,
                poolType: UNIV2,
            },
        ];
        prices = await ApiHelper.getDefiLlamaTokenPrices([
            TOKEN_ADDR_WETH,
            TOKEN_ADDR_CRV,
            TOKEN_ADDR_CVX,
            TOKEN_ADDR_SDT,
            TOKEN_ADDR_CNC,
            TOKEN_ADDR_TOKEMAK,
            TOKEN_ADDR_FXS,
            TOKEN_ADDR_WBTC,
            TOKEN_ADDR_LINK,
        ]);
        treasuryDao = users.treasuryDao;

        cvgOracle = contracts.bonds.cvgOracle;
    });

    it("Success : Setting up the price feed of WETH with UniswapV3 ", async () => {
        await cvgOracle.connect(treasuryDao).setTokenOracleParams(TOKEN_ADDR_WETH, {
            poolType: UNIV3,
            poolAddress: UNIV3_USDC_ETH,
            isReversed: true,
            isEthPriceRelated: false,
            aggregatorOracle: CHAINLINK_ETH_USD,
            deltaLimitOracle: 250,
            twapOrK: 30,
            maxLastUpdate: 800_600_400,
            minPrice: "1",
            maxPrice: ethers.parseEther("10000000000"),
            stablesToCheck: [TOKEN_ADDR_USDC],
        });
    });

    it("Should compute Token prices in $ ", async () => {
        for (const token of tokens) {
            const priceInPool = await cvgOracle.getAndVerifyOracle(token.token);
            const priceRaw = ethers.formatEther(priceInPool);
            const price = Number(priceRaw);
            const expectedPrice = prices[token.address].price;
            expect(price).to.be.approximately(expectedPrice, expectedPrice * deltaPercentage);
        }
    });

    /* =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=
                            UNI V2
    =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-= */
    it("Success : Compute price of WBTC/USDC with UNIV2", async () => {
        await cvgOracle.connect(treasuryDao).setTokenOracleParams(TOKEN_ADDR_WBTC, {
            poolType: UNIV2,
            poolAddress: UNIV2_BTC_USDC,
            isReversed: true,
            isEthPriceRelated: false,
            aggregatorOracle: CHAINLINK_BTC_USD,
            deltaLimitOracle: 250,
            twapOrK: 0,
            maxLastUpdate: 800_600_400,
            minPrice: "1",
            maxPrice: ethers.parseEther("10000000000"),
            stablesToCheck: [TOKEN_ADDR_USDC],
        });

        const wBTCPrice = Number(ethers.formatEther(await cvgOracle.getAndVerifyOracle(TOKEN_ADDR_WBTC)));
        const expectedPricWBTC = prices[TOKEN_ADDR_WBTC].price;
        expect(wBTCPrice).to.be.approximately(expectedPricWBTC, expectedPricWBTC * DELTA_MAX_FLOAT);
    });

    it("Success : Compute price of ETH/USDT with UNIV2", async () => {
        await cvgOracle.connect(treasuryDao).setTokenOracleParams(TOKEN_ADDR_WETH, {
            poolType: UNIV2,
            poolAddress: UNIV2_ETH_USDT,
            isReversed: true,
            isEthPriceRelated: false,
            aggregatorOracle: CHAINLINK_ETH_USD,
            deltaLimitOracle: 250,
            twapOrK: 0,
            maxLastUpdate: 800_600_400,
            minPrice: "1",
            maxPrice: ethers.parseEther("10000000000"),
            stablesToCheck: [TOKEN_ADDR_USDT],
        });

        const ethPrice = Number(ethers.formatEther(await cvgOracle.getAndVerifyOracle(TOKEN_ADDR_WETH)));
        const expectedETH = prices[TOKEN_ADDR_WETH].price;
        expect(ethPrice).to.be.approximately(expectedETH, expectedETH * DELTA_MAX_FLOAT);
    });

    it("Success : Compute price of USDC/ETH with UNIV2", async () => {
        await cvgOracle.connect(treasuryDao).setTokenOracleParams(TOKEN_ADDR_WETH, {
            poolType: UNIV2,
            poolAddress: UNIV2_USDC_ETH,
            isReversed: false,
            isEthPriceRelated: false,
            aggregatorOracle: CHAINLINK_ETH_USD,
            deltaLimitOracle: 250,
            twapOrK: 0,
            maxLastUpdate: 800_600_400,
            minPrice: "1",
            maxPrice: ethers.parseEther("10000000000"),
            stablesToCheck: [TOKEN_ADDR_USDC],
        });

        const ethPrice = Number(ethers.formatEther(await cvgOracle.getAndVerifyOracle(TOKEN_ADDR_WETH)));
        const expectedETH = prices[TOKEN_ADDR_WETH].price;
        expect(ethPrice).to.be.approximately(expectedETH, expectedETH * DELTA_MAX_FLOAT);
    });

    // /* =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=
    //                         UNI V3
    // =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-= */

    it("Success : Compute price of WBTC/ETH with UNIV3", async () => {
        await cvgOracle.connect(treasuryDao).setTokenOracleParams(TOKEN_ADDR_WBTC, {
            poolType: UNIV3,
            poolAddress: UNIV3_WBTC_ETH,
            isReversed: false,
            isEthPriceRelated: true,
            aggregatorOracle: CHAINLINK_BTC_USD,
            deltaLimitOracle: 250,
            twapOrK: 30,
            maxLastUpdate: 800_600_400,
            minPrice: "1",
            maxPrice: ethers.parseEther("10000000000"),
            stablesToCheck: [],
        });

        const wBTCPrice = Number(ethers.formatEther(await cvgOracle.getAndVerifyOracle(TOKEN_ADDR_WBTC)));
        const expectedWBTC = prices[TOKEN_ADDR_WBTC].price;
        expect(wBTCPrice).to.be.approximately(expectedWBTC, expectedWBTC * DELTA_MAX_FLOAT);
    });

    it("Success : Compute price of WBTC/USDT with UNIV3", async () => {
        await cvgOracle.connect(treasuryDao).setTokenOracleParams(TOKEN_ADDR_WBTC, {
            poolType: UNIV3,
            poolAddress: UNIV3_WBTC_USDT,
            isReversed: false,
            isEthPriceRelated: false,
            aggregatorOracle: CHAINLINK_BTC_USD,
            deltaLimitOracle: 250,
            twapOrK: 30,
            maxLastUpdate: 800_600_400,
            minPrice: "1",
            maxPrice: ethers.parseEther("10000000000"),
            stablesToCheck: [TOKEN_ADDR_USDT],
        });

        const wBTCPrice = Number(ethers.formatEther(await cvgOracle.getAndVerifyOracle(TOKEN_ADDR_WBTC)));
        const expectedWBTC = prices[TOKEN_ADDR_WBTC].price;
        expect(wBTCPrice).to.be.approximately(expectedWBTC, expectedWBTC * DELTA_MAX_FLOAT);
    });

    it("Success : Compute price of LINK/ETH with UNIV3", async () => {
        await cvgOracle.connect(treasuryDao).setTokenOracleParams(TOKEN_ADDR_LINK, {
            poolType: UNIV3,
            poolAddress: UNIV3_LINK_ETH,
            isReversed: false,
            isEthPriceRelated: true,
            aggregatorOracle: CHAINLINK_LINK_USD,
            deltaLimitOracle: 250,
            twapOrK: 30,
            maxLastUpdate: 800_600_400,
            minPrice: "1",
            maxPrice: ethers.parseEther("10000000000"),
            stablesToCheck: [],
        });

        const linkPrice = Number(ethers.formatEther(await cvgOracle.getAndVerifyOracle(TOKEN_ADDR_LINK)));
        const expectedLinkPrice = prices[TOKEN_ADDR_LINK].price;
        expect(linkPrice).to.be.approximately(expectedLinkPrice, expectedLinkPrice * DELTA_MAX_FLOAT);
    });
});
