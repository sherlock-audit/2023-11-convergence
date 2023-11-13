import {ethers} from "hardhat";
import {IContractsUser} from "./contractInterface";
import {FACTORY_POOL} from "../resources/curve";

export class FakeLiquidityDeployer {
    ethPrices = {};
    dollarPrices = {};

    static deployCvgFraxBpLiquidity = async (contractsUsers: IContractsUser): Promise<IContractsUser> => {
        const tokenContracts = contractsUsers.contracts.tokens;

        const cvgContract = tokenContracts.cvg;
        const fraxBpContract = tokenContracts.fraxBp;

        const poolParams = {
            name: "CVG/FRAXBP",
            symbol: "CVGFRAXBP",
            coin0: fraxBpContract,
            coin1: cvgContract,
            price: BigInt("330000000000000000"), // 0.33 $
        };
        const curveFactory = await ethers.getContractAt("ICrvFactory", FACTORY_POOL);
        const tx = await curveFactory.deploy_pool(
            poolParams.name,
            poolParams.symbol,
            [fraxBpContract, cvgContract],
            "400000", //A
            "145000000000000", //gamma
            "26000000", //mid_fee
            "45000000", //out_fee
            "2000000000000", //allowed_extra_profit
            "230000000000000", //fee_gamma
            "146000000000000", //adjustment_step
            "5000000000", //admin_fee
            "600", //ma_half_time
            poolParams.price //initial_price
        );
        await tx.wait();
        const poolAddress = await curveFactory.find_pool_for_coins(poolParams.coin0, poolParams.coin1, 0);
        const cvgPoolContract = await ethers.getContractAt("ICrvPool", poolAddress);
        await (await poolParams.coin0.approve(poolAddress, ethers.MaxUint256)).wait();
        await (await poolParams.coin1.approve(poolAddress, ethers.MaxUint256)).wait();

        const amountFraxBp = ethers.parseEther("75000");
        const amountCvg = ethers.parseEther(((amountFraxBp * 10n ** 10n) / poolParams.price / 10n ** 10n).toString());
        await cvgPoolContract.add_liquidity([amountFraxBp, amountCvg], "0");
        return {
            ...contractsUsers,
            contracts: {
                ...contractsUsers.contracts,
                lp: {
                    ...contractsUsers.contracts.lp,
                    poolCvgFraxBp: cvgPoolContract,
                },
            },
        };
    };

    // static deployCvgFraxBpWethLiquidity = async (contractsUsers: IContractsUser): Promise<IContractsUser> => {
    //     const tokenContracts = contractsUsers.contracts.tokens;

    //     const cvgContract = tokenContracts.cvgSdt;
    //     const fraxBpContract = tokenContracts.fraxBp;
    //     const wethContract = tokenContracts.weth;

    //     const curveFactory = await ethers.getContractAt("ITriCrvFactory", "0x0c0e5f2ff0ff18a3be9b835635039256dc4b4963");
    //     const tx = await curveFactory.deploy_pool(
    //         "TricryptoCVG", //_name
    //         "fraxBPCVGWETH", //_symbol
    //         [fraxBpContract, cvgContract, wethContract], // coins
    //         wethContract, //_weth
    //         "0", //implementation_id
    //         "1707629", //A
    //         "11809167828997", //gamma
    //         "3000000", //mid_fee
    //         "30000000", //out_fee
    //         "500000000000000", //fee_gamma
    //         "2000000000000", //allowed_extra_profit
    //         "490000000000000", //adjustment_step
    //         "865", //ma_exp_time
    //         ["330000000000000000", "2000000000000000000000"] //initial_prices
    //     );
    //     await tx.wait();
    //     const poolAddress = await curveFactory.find_pool_for_coins(cvgContract, wethContract, 0);
    //     const triCryptoCvg = await ethers.getContractAt("ITriCrvPool", poolAddress);

    //     await (await fraxBpContract.approve(poolAddress, ethers.MaxUint256)).wait();
    //     await (await cvgContract.approve(poolAddress, ethers.MaxUint256)).wait();
    //     await (await wethContract.approve(poolAddress, ethers.MaxUint256)).wait();

    //     const amountFraxBp = ethers.parseEther("50000");
    //     const amountCvg = ethers.parseEther("152000");
    //     const amountWETH = ethers.parseEther("30");

    //     await triCryptoCvg.add_liquidity([amountFraxBp, amountCvg, amountWETH], "0", false);

    //     return {
    //         ...contractsUsers,
    //         contracts: {
    //             ...contractsUsers.contracts,
    //             lp: {
    //                 ...contractsUsers.contracts.lp,
    //                 bondCalculator: bondCalculator,
    //             },
    //         },
    //     };
    // };

    // deployLiquidityCurve = async (contracts: IContracts) => {
    //     let ethPrices;

    //     // token prices to be fetched from CoinGecko API
    //     const tokenNames = ["curve-dao-token", "convex-finance", "stake-dao", "conic-finance"];
    //     ethPrices = await ApiHelper.getCoinGeckoTokenPrices(tokenNames, "eth", false);

    //     let curvePoolContracts = {};

    //     const tokenContracts = contracts.tokens;

    //     const crvContract = tokenContracts.crv;
    //     const cvxContract = tokenContracts.cvx;
    //     const sdtContract = tokenContracts.sdt;
    //     const cncContract = tokenContracts.cnc;
    //     const wETHContract = tokenContracts.weth;

    //     const poolParams = {};
    //     poolParams["CRV_ETH_CURVE"] = {
    //         name: "CRV/ETH",
    //         symbol: "CRVETH",
    //         coin0: wETHContract,
    //         coin1: crvContract,
    //         price: BigNumber.from(Math.trunc(ethPrices["curve-dao-token"].eth * 10 ** 18).toString()),
    //     };
    //     poolParams["CVX_ETH_CURVE"] = {
    //         name: "CVX/ETH",
    //         symbol: "CVXETH",
    //         coin0: wETHContract,
    //         coin1: cvxContract,
    //         price: BigNumber.from(Math.trunc(ethPrices["convex-finance"].eth * 10 ** 18).toString()),
    //     };
    //     poolParams["SDT_ETH_CURVE"] = {
    //         name: "SDT/ETH",
    //         symbol: "SDTETH",
    //         coin0: wETHContract,
    //         coin1: sdtContract,
    //         price: BigNumber.from(Math.trunc(ethPrices["stake-dao"].eth * 10 ** 18).toString()),
    //     };
    //     poolParams["CNC_ETH_CURVE"] = {
    //         name: "CNC/ETH",
    //         symbol: "CNCETH",
    //         coin0: wETHContract,
    //         coin1: cncContract,
    //         price: BigNumber.from(Math.trunc(ethPrices["conic-finance"].eth * 10 ** 18).toString()),
    //     };

    //     const curveFactory = await hre.ethers.getContractAt("ICrvFactory", "0xF18056Bbd320E96A48e3Fbf8bC061322531aac99");

    //     for (const poolName in poolParams) {
    //         const pool = poolParams[poolName];
    //         const tx = await curveFactory.deploy_pool(
    //             pool.name,
    //             pool.symbol,
    //             [pool.coin0.address, pool.coin1.address],
    //             "400000", //A
    //             "145000000000000", //gamma
    //             "26000000", //mid_fee
    //             "45000000", //out_fee
    //             "2000000000000", //allowed_extra_profit
    //             "230000000000000", //fee_gamma
    //             "146000000000000", //adjustment_step
    //             "5000000000", //admin_fee
    //             "600", //ma_half_time
    //             pool.price //initial_price
    //         );
    //         await tx.wait();
    //         const poolAddress = await curveFactory.find_pool_for_coins(pool.coin0.address, pool.coin1.address, 0);
    //         const poolContract = await hre.ethers.getContractAt("ICrvPool", poolAddress);
    //         await (await pool.coin0.approve(poolAddress, MAX_INTEGER)).wait();
    //         await (await pool.coin1.approve(poolAddress, MAX_INTEGER)).wait();

    //         const amountETH = GlobalHelper.bigNumberFactory(100, 18);
    //         const amountToken = GlobalHelper.bigNumberFactory(amountETH.div(pool.price), 18);

    //         await poolContract.add_liquidity([amountETH, amountToken], "0");
    //         curvePoolContracts[poolName] = poolContract;
    //     }

    //     return {...contracts, ...{curvePoolContracts}};
    // };

    // deployLiquidityV2 = async (contracts, users) => {
    //     let dollarPrices;
    //     let ethPrices;

    //     // token prices to be fetched from CoinGecko API
    //     let tokenNames = ["ethereum", "frax-share"];
    //     dollarPrices = await ApiHelper.getCoinGeckoTokenPrices(tokenNames, "usd", false);

    //     // token prices to be fetched from CoinGecko API
    //     tokenNames = ["tokemak"];
    //     ethPrices = await ApiHelper.getCoinGeckoTokenPrices(tokenNames, "eth", false);

    //     const v2PoolContracts = {};

    //     const tokenContracts = contracts.tokenContracts;

    //     const fraxContract = tokenContracts.FRAX;
    //     const wETHContract = tokenContracts.WETH;
    //     const fraxShareContract = tokenContracts.FXS;
    //     const tokeContract = tokenContracts.TOKE;

    //     const poolParams = {};
    //     poolParams["TOKE_ETH_V2"] = {
    //         token0: tokeContract.address,
    //         token1: wETHContract.address,
    //         price: ethPrices["tokemak"].eth,
    //     };
    //     poolParams["FRAX_FXS_V2"] = {
    //         token0: fraxContract.address,
    //         token1: fraxShareContract.address,
    //         price: dollarPrices["frax-share"].usd,
    //     };

    //     const lpRouter = await hre.ethers.getContractAt("IUniswapV2Router", "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D");
    //     const lpFactory = await hre.ethers.getContractAt("IUniswapV2Factory", "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f");

    //     await (await wETHContract.approve(lpRouter.address, MAX_INTEGER)).wait();
    //     await (await tokeContract.approve(lpRouter.address, MAX_INTEGER)).wait();
    //     await (await fraxContract.approve(lpRouter.address, MAX_INTEGER)).wait();
    //     await (await fraxShareContract.approve(lpRouter.address, MAX_INTEGER)).wait();

    //     const oneMillion = ethers.parseEther("1000000");

    //     for (const poolName in poolParams) {
    //         const pool = poolParams[poolName];
    //         const amount1 = 1000000 * pool.price;

    //         await (
    //             await lpRouter.addLiquidity(
    //                 pool.token0,
    //                 pool.token1,
    //                 oneMillion,
    //                 ethers.parseEther(amount1.toString()),
    //                 oneMillion,
    //                 ethers.parseEther(amount1.toString()),
    //                 users.owner.address,
    //                 "1000000000000000000"
    //             )
    //         ).wait();

    //         const poolAddress = await lpFactory.getPair(pool.token0, pool.token1);
    //         const poolContract = await hre.ethers.getContractAt("IUniswapV2Pair", poolAddress);
    //         v2PoolContracts[poolName] = poolContract;
    //     }
    //     return {...contracts, ...{v2PoolContracts}};
    // };

    // deployLiquidityV3 = async (contracts, users) => {
    //     let dollarPrices;
    //     let ethPrices;

    //     // token prices to be fetched from CoinGecko API
    //     let tokenNames = ["ethereum"];
    //     dollarPrices = await ApiHelper.getCoinGeckoTokenPrices(tokenNames, "usd", false);

    //     tokenNames = ["ethereum", "curve-dao-token", "convex-finance", "bitcoin", "tokemak"];
    //     ethPrices = await ApiHelper.getCoinGeckoTokenPrices(tokenNames, "eth", false);

    //     let v3PoolContracts = {};

    //     const nftPositionManagerAddress = "0xC36442b4a4522E871399CD717aBDD847Ab11FE88";
    //     const nftPositionManager = await hre.ethers.getContractAt(nunfigleManagerPosition, nftPositionManagerAddress); // Address of the NFTPositionManager on Mainnet
    //     const v3FactoryContract = await hre.ethers.getContractAt("IUniswapV3Factory", "0x1F98431c8aD98523631AE4a59f267346ea31F984");

    //     const tokenContracts = contracts.tokenContracts;

    //     const usdcContract = tokenContracts.USDC;
    //     const wETHContract = tokenContracts.WETH;
    //     const crvContract = tokenContracts.CRV;
    //     const cvxContract = tokenContracts.CVX;

    //     await (await usdcContract.approve(nftPositionManagerAddress, MAX_INTEGER)).wait();
    //     await (await wETHContract.approve(nftPositionManagerAddress, MAX_INTEGER)).wait();
    //     await (await crvContract.approve(nftPositionManagerAddress, MAX_INTEGER)).wait();
    //     await (await cvxContract.approve(nftPositionManagerAddress, MAX_INTEGER)).wait();

    //     const addressToIntUsdc = parseInt(usdcContract.address);
    //     const addressToIntwETH = parseInt(wETHContract.address);
    //     const addressToIntCVX = parseInt(cvxContract.address);
    //     const addressToIntCRV = parseInt(crvContract.address);

    //     const poolParams = {};
    //     poolParams["USDC_ETH_V3"] = {
    //         token0: addressToIntUsdc < addressToIntwETH ? usdcContract : wETHContract,
    //         token1: addressToIntUsdc < addressToIntwETH ? wETHContract : usdcContract,
    //         price: 1 / dollarPrices["ethereum"].usd,
    //     };
    //     poolParams["CRV_ETH_V3"] = {
    //         token0: addressToIntCRV < addressToIntwETH ? crvContract : wETHContract,
    //         token1: addressToIntCRV < addressToIntwETH ? wETHContract : crvContract,
    //         price: ethPrices["curve-dao-token"].eth,
    //     };
    //     poolParams["CVX_ETH_V3"] = {
    //         token0: addressToIntCVX < addressToIntwETH ? cvxContract : wETHContract,
    //         token1: addressToIntCVX < addressToIntwETH ? wETHContract : cvxContract,
    //         price: ethPrices["convex-finance"].eth,
    //     };

    //     for (const poolName in poolParams) {
    //         const pool = poolParams[poolName];
    //         const config_pool = config.V3_POOLS[poolName];
    //         const sqrtPriceX96 = await sqrtPriceX96Calculator(pool.token0, pool.token1, pool.price);
    //         await (await nftPositionManager.createAndInitializePoolIfNecessary(pool.token0, pool.token1.address, config_pool.fee, sqrtPriceX96)).wait();
    //         await (
    //             await nftPositionManager.mint({
    //                 token0: pool.token0,
    //                 token1: pool.token1,
    //                 fee: config_pool.fee,
    //                 tickLower: config_pool.tickLower, // Lower Ticker from TickerMath UniswapV3
    //                 tickUpper: config_pool.tickUpper, // Upper Ticker from TickerMath UniswapV3
    //                 amount0Desired: config_pool.amount0Desired,
    //                 amount1Desired: config_pool.amount1Desired,
    //                 amount0Min: config_pool.amount0Min,
    //                 amount1Min: config_pool.amount1Min,
    //                 recipient: users.owner,
    //                 deadline: Date.now() + 10000,
    //             })
    //         ).wait();
    //         const poolAddress = await v3FactoryContract.getPool(pool.token0, pool.token1, config_pool.fee);

    //         const poolContract = await hre.ethers.getContractAt("IUniswapV3Pool", poolAddress);

    //         v3PoolContracts[poolName] = poolContract;
    //     }

    //     return {...contracts, ...{v3PoolContracts}};
    // };
}
