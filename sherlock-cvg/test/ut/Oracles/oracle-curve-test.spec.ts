import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {expect} from "chai";
import {ethers, network} from "hardhat";
import {Signer} from "ethers";
import {deployOracleFixture} from "../../fixtures/fixtures";
import {CvgOracle} from "../../../typechain-types/contracts/Oracles";

import {
    TOKEN_ADDR_CRVUSD,
    TOKEN_ADDR_FRAX,
    TOKEN_ADDR_RSR,
    TOKEN_ADDR_STG,
    TOKEN_ADDR_TBTC,
    TOKEN_ADDR_USDC,
    TOKEN_ADDR_USDT,
    TOKEN_ADDR_WSTETH,
    TOKEN_ADDR_WETH,
    TOKEN_ADDR_CRV,
    TOKEN_ADDR_CVX,
    TOKEN_ADDR_SDT,
    TOKEN_ADDR_CNC,
    TOKEN_ADDR_TOKEMAK,
} from "../../../resources/tokens/common";
import {CHAINLINK_USDT_USD} from "../../../resources/aggregators";
import {CRV_DUO_RSR_FRAX_BP, CRV_TRI_CRYPTO_LLAMA, LP_CRV_DUO_STG_USDC} from "../../../resources/lp";

import {time} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import {ApiHelper} from "../../../utils/ApiHelper";
import {manipulateCurveDuoLp} from "../../../utils/swapper/curve-duo-manipulator";

describe("Oracle curve Testing", () => {
    const CURVE_NORMAL = 3;
    const CURVE_TRIPOOL = 4;
    let treasuryDao: Signer, owner: Signer;

    let cvgOracle: CvgOracle;
    let prices: any;
    let users;

    const DELTA_MAX = 250; // 2.5%
    const DELTA_MAX_FLOAT = 0.08;

    before(async () => {
        const {contracts, users} = await loadFixture(deployOracleFixture);

        prices = await ApiHelper.getDefiLlamaTokenPrices([
            TOKEN_ADDR_WETH,
            TOKEN_ADDR_CRV,
            TOKEN_ADDR_CVX,
            TOKEN_ADDR_SDT,
            TOKEN_ADDR_CNC,
            TOKEN_ADDR_TOKEMAK,
            TOKEN_ADDR_RSR,
            TOKEN_ADDR_TBTC,
            TOKEN_ADDR_STG,
            TOKEN_ADDR_WSTETH,
        ]);
        treasuryDao = users.treasuryDao;
        owner = users.owner;
        cvgOracle = contracts.bonds.cvgOracle;
    });

    it("Success : Fetch Cvg price at launch", async () => {
        const cvgPrice = await cvgOracle.getAndVerifyCvgPrice();
        expect(cvgPrice).to.be.eq(ethers.parseEther("0.33"));
    });

    it("Success verify the price of the USDT ", async () => {
        await cvgOracle.connect(treasuryDao).setTokenOracleParams(TOKEN_ADDR_USDT, {
            poolType: 0,
            poolAddress: ethers.ZeroAddress,
            isReversed: false,
            isEthPriceRelated: false,
            aggregatorOracle: CHAINLINK_USDT_USD,
            deltaLimitOracle: DELTA_MAX,
            twapOrK: 0,
            maxLastUpdate: 800_600_400, // Only for test purpose
            minPrice: "1",
            maxPrice: ethers.parseEther("10000000000"),
            stablesToCheck: [],
        });

        const usdtPrice = await cvgOracle.getAndVerifyOracle(TOKEN_ADDR_USDT);

        expect(usdtPrice).to.be.eq(ethers.parseEther("1"));
    });

    it("Success Verifiying the price of the STG token", async () => {
        await cvgOracle.connect(treasuryDao).setTokenOracleParams(TOKEN_ADDR_STG, {
            poolType: CURVE_NORMAL,
            poolAddress: LP_CRV_DUO_STG_USDC,
            isReversed: true,
            isEthPriceRelated: false,
            aggregatorOracle: ethers.ZeroAddress,
            deltaLimitOracle: DELTA_MAX,
            twapOrK: 0,
            maxLastUpdate: 864000000,
            minPrice: "1",
            maxPrice: ethers.parseEther("10000000000"),
            stablesToCheck: [TOKEN_ADDR_USDC],
        });

        const stgPrice = Number(ethers.formatEther(await cvgOracle.getAndVerifyOracle(TOKEN_ADDR_STG)));
        const expectedPrice = prices[TOKEN_ADDR_STG].price;

        expect(stgPrice).to.be.approximately(expectedPrice, expectedPrice * DELTA_MAX_FLOAT);
    });

    it("Success : Get price of the RSR token", async () => {
        await cvgOracle.connect(treasuryDao).setTokenOracleParams(TOKEN_ADDR_RSR, {
            poolType: CURVE_NORMAL,
            poolAddress: CRV_DUO_RSR_FRAX_BP,
            isReversed: true,
            isEthPriceRelated: false,
            aggregatorOracle: ethers.ZeroAddress,
            deltaLimitOracle: DELTA_MAX,
            twapOrK: 0,
            maxLastUpdate: 864000000,
            minPrice: "1",
            maxPrice: ethers.parseEther("10000000000"),
            stablesToCheck: [TOKEN_ADDR_USDC, TOKEN_ADDR_FRAX],
        });

        const rsrPrice = Number(ethers.formatEther(await cvgOracle.getAndVerifyOracle(TOKEN_ADDR_RSR)));
        const expectedPrice = prices[TOKEN_ADDR_RSR].price;

        expect(rsrPrice).to.be.approximately(expectedPrice, expectedPrice * DELTA_MAX_FLOAT);
    });

    it("Success Verifiying the price of the wstETH & tBTC token", async () => {
        await cvgOracle.connect(treasuryDao).setTokenOracleParams(TOKEN_ADDR_WSTETH, {
            poolType: CURVE_TRIPOOL,
            poolAddress: CRV_TRI_CRYPTO_LLAMA,
            isReversed: false,
            isEthPriceRelated: false,
            aggregatorOracle: ethers.ZeroAddress,
            deltaLimitOracle: DELTA_MAX,
            twapOrK: 1,
            maxLastUpdate: 864000000,
            minPrice: "1",
            maxPrice: ethers.parseEther("10000000000"),
            stablesToCheck: [TOKEN_ADDR_CRVUSD],
        });

        await cvgOracle.connect(treasuryDao).setTokenOracleParams(TOKEN_ADDR_TBTC, {
            poolType: CURVE_TRIPOOL,
            poolAddress: CRV_TRI_CRYPTO_LLAMA,
            isReversed: false,
            isEthPriceRelated: false,
            aggregatorOracle: ethers.ZeroAddress,
            deltaLimitOracle: DELTA_MAX,
            twapOrK: 0,
            maxLastUpdate: 864000000,
            minPrice: "1",
            maxPrice: ethers.parseEther("10000000000"),
            stablesToCheck: [TOKEN_ADDR_CRVUSD],
        });

        const wstETHPrice = Number(ethers.formatEther(await cvgOracle.getAndVerifyOracle(TOKEN_ADDR_WSTETH)));
        const expectedPriceWsETH = prices[TOKEN_ADDR_WSTETH].price;
        expect(wstETHPrice).to.be.approximately(expectedPriceWsETH, expectedPriceWsETH * DELTA_MAX_FLOAT);

        const tBTCPrice = Number(ethers.formatEther(await cvgOracle.getAndVerifyOracle(TOKEN_ADDR_TBTC)));
        const expectedPriceTBtc = prices[TOKEN_ADDR_TBTC].price;
        expect(tBTCPrice).to.be.approximately(expectedPriceTBtc, expectedPriceTBtc * DELTA_MAX_FLOAT);
    });

    it("Success : Dump the price of RSR", async () => {
        const actions = [{type: "swap", direction: [1, 0], amountIn: 200_000}];
        await manipulateCurveDuoLp(CRV_DUO_RSR_FRAX_BP, actions, owner);
    });

    it("Fails : Delta triggered on RSR", async () => {
        await expect(cvgOracle.getAndVerifyOracle(TOKEN_ADDR_RSR)).to.be.revertedWith("LIMIT_TOO_LOW");
    });

    it("Success : Reequilibration of price_oracle", async () => {
        await time.increase(864000000);
    });

    it("Fail : Price is now stale after going forward in time", async () => {
        await expect(cvgOracle.getAndVerifyOracle(TOKEN_ADDR_RSR)).to.be.revertedWith("STALE_PRICE");
    });

    it("Success : Verify the price of RSR after reequilibration", async () => {
        const actions = [{type: "swap", direction: [1, 0], amountIn: 1}];
        await manipulateCurveDuoLp(CRV_DUO_RSR_FRAX_BP, actions, owner);
        await time.increase(86400);
    });
    it.skip("Success : Reequilibration of price_oracle", async () => {
        await cvgOracle.getAndVerifyOracle(TOKEN_ADDR_RSR);
    });

    it("Fail : Reequilibration of price_oracle", async () => {
        await time.increase(100000000);
        await expect(cvgOracle.getAndVerifyOracle(TOKEN_ADDR_RSR)).to.be.revertedWith("STABLES_NOT_VERIFIED");
    });
});
