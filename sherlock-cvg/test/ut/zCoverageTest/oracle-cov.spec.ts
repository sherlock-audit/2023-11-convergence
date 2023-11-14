import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {expect} from "chai";
import {ethers} from "hardhat";
import {Signer} from "ethers";
import {deployOracleFixture} from "../../fixtures/fixtures";
import {CvgOracle} from "../../../typechain-types/contracts/Oracles";
import {ApiHelper} from "../../../utils/ApiHelper";
import {TOKEN_ADDR_CVX, TOKEN_ADDR_USDC, TOKEN_ADDR_WETH} from "../../../resources/tokens/common";
import {UNIV2_BTC_USDC, UNIV2_ETH_USDT, UNIV2_USDC_ETH, UNIV3_LINK_ETH, UNIV3_USDC_ETH, UNIV3_WBTC_ETH, UNIV3_WBTC_USDT} from "../../../resources/lp";
import {CHAINLINK_BTC_USD, CHAINLINK_ETH_USD, CHAINLINK_LINK_USD} from "../../../resources/aggregators";

describe("Coverage Oracle", () => {
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
    let tokens: any[] = [];

    before(async () => {
        const {contracts, users} = await loadFixture(deployOracleFixture);

        const tokenContracts = contracts.tokens;

        tokens = [
            {
                token: tokenContracts.weth,
                name: "ethereum",
                poolType: UNIV3,
            },
            {
                token: tokenContracts.crv,
                name: "curve-dao-token",
                poolType: CURVE_TRIPOOL,
            },
            {
                token: tokenContracts.cvx,
                name: "convex-finance",
                poolType: CURVE_NORMAL,
            },
            {
                token: tokenContracts.sdt,
                name: "stake-dao",
                poolType: CURVE_NORMAL,
            },
            // {
            //     token: tokenContracts.cncContract,
            //     name: "conic-finance",
            //     poolType: CURVE_NORMAL,
            // },

            {
                token: tokenContracts.fxs,
                name: "frax-share",
                poolType: UNIV2,
            },
        ];
        treasuryDao = users.treasuryDao;

        cvgOracle = contracts.bonds.cvgOracle;
    });
    it("Fail : Setting cvg random user", async () => {
        await cvgOracle.setCvg(TOKEN_ADDR_USDC).should.be.revertedWith("Ownable: caller is not the owner");
    });
    it("Fail : Setting up the price with random user", async () => {
        await cvgOracle
            .setTokenOracleParams(TOKEN_ADDR_WETH, {
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
            })
            .should.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Fail : Setting up the price feed of WETH with wrong type", async () => {
        await cvgOracle
            .connect(treasuryDao)
            .setTokenOracleParams(TOKEN_ADDR_WETH, {
                poolType: 6,
                poolAddress: UNIV3_USDC_ETH,
                isReversed: true,
                isEthPriceRelated: false,
                aggregatorOracle: CHAINLINK_ETH_USD,
                deltaLimitOracle: 250,
                twapOrK: 0,
                maxLastUpdate: 800_600_400,
                minPrice: "1",
                maxPrice: ethers.parseEther("10000000000"),
                stablesToCheck: [TOKEN_ADDR_USDC],
            })
            .should.be.revertedWithoutReason();
    });

    it("Success : Setting up the price feed of WETH with twapOrk 0 and deltaLimit to 0", async () => {
        await cvgOracle.connect(treasuryDao).setTokenOracleParams(TOKEN_ADDR_WETH, {
            poolType: UNIV3,
            poolAddress: UNIV3_USDC_ETH,
            isReversed: true,
            isEthPriceRelated: false,
            aggregatorOracle: CHAINLINK_ETH_USD,
            deltaLimitOracle: 0,
            twapOrK: 0,
            maxLastUpdate: 800_600_400,
            minPrice: "0",
            maxPrice: ethers.parseEther("10000000000"),
            stablesToCheck: [TOKEN_ADDR_USDC],
        });
    });
    //TODO: find a way to always reach LIMIT_TOO_HIGH instead of LIMIT_TOO_LOW
    it.skip("Fail: getAndVerifyOracle with delta limit too high", async () => {
        await cvgOracle.getAndVerifyOracle(TOKEN_ADDR_WETH).should.be.revertedWith("LIMIT_TOO_HIGH");
    });

    it("Success: getEthPriceOracleUnverified", async () => {
        await cvgOracle.getEthPriceOracleUnverified();
    });
    it("Success : Setting up the price feed of WETH with twapOrk 0 and deltaLimit to 250", async () => {
        await cvgOracle.connect(treasuryDao).setTokenOracleParams(TOKEN_ADDR_WETH, {
            poolType: UNIV3,
            poolAddress: UNIV3_USDC_ETH,
            isReversed: true,
            isEthPriceRelated: false,
            aggregatorOracle: CHAINLINK_ETH_USD,
            deltaLimitOracle: 250,
            twapOrK: 0,
            maxLastUpdate: 800_600_400,
            minPrice: "1",
            maxPrice: ethers.parseEther("10000000000"),
            stablesToCheck: [TOKEN_ADDR_USDC],
        });
    });
    it("Success : Setting up the price feed of USDC with params of WETH token", async () => {
        await cvgOracle.connect(treasuryDao).setTokenOracleParams(TOKEN_ADDR_USDC, {
            poolType: UNIV3,
            poolAddress: UNIV3_USDC_ETH,
            isReversed: true,
            isEthPriceRelated: false,
            aggregatorOracle: CHAINLINK_ETH_USD,
            deltaLimitOracle: 250,
            twapOrK: 0,
            maxLastUpdate: 800_600_400,
            minPrice: "1",
            maxPrice: ethers.parseEther("10000000000"),
            stablesToCheck: [],
        });
    });
    it("Fail: getAndVerifyOracle with stables not verified due to wrong stable parameters", async () => {
        await cvgOracle.getAndVerifyOracle(TOKEN_ADDR_WETH).should.be.revertedWith("STABLES_NOT_VERIFIED");
    });
    it("Success : Setting up the price feed of WETH with maxLastUpdate 0", async () => {
        await cvgOracle.connect(treasuryDao).setTokenOracleParams(TOKEN_ADDR_WETH, {
            poolType: UNIV3,
            poolAddress: UNIV3_USDC_ETH,
            isReversed: true,
            isEthPriceRelated: false,
            aggregatorOracle: CHAINLINK_ETH_USD,
            deltaLimitOracle: 250,
            twapOrK: 30,
            maxLastUpdate: 0,
            minPrice: "1",
            maxPrice: ethers.parseEther("10000000000"),
            stablesToCheck: [TOKEN_ADDR_USDC],
        });
    });
    it("Fail: getAndVerifyOracle with stables not verified due to wrong stable parameters", async () => {
        await cvgOracle.getAndVerifyOracle(TOKEN_ADDR_CVX).should.be.revertedWith("ETH_NOT_VERIFIED");
    });
    it("Success : Setting up the price feed of WETH with limit max price equals to limit min price", async () => {
        await cvgOracle.connect(treasuryDao).setTokenOracleParams(TOKEN_ADDR_WETH, {
            poolType: UNIV3,
            poolAddress: UNIV3_USDC_ETH,
            isReversed: true,
            isEthPriceRelated: false,
            aggregatorOracle: CHAINLINK_ETH_USD,
            deltaLimitOracle: 250,
            twapOrK: 0,
            maxLastUpdate: 800_600_400,
            minPrice: "1",
            maxPrice: "1",
            stablesToCheck: [],
        });
    });
    it("Fail: getAndVerifyOracle with delta limit too high", async () => {
        await cvgOracle.getAndVerifyOracle(TOKEN_ADDR_WETH).should.be.revertedWith("PRICE_OUT_OF_LIMITS");
    });
});
