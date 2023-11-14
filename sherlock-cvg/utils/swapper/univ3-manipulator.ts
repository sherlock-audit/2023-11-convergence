import {Signer} from "ethers";
import {ethers} from "hardhat";

const routerUniV3 = "0xE592427A0AEce92De3Edee1F18E0157C05861564";

async function manipulateUniV3Lp(lpAddress: string, actions: any[], user: Signer) {
    const router3Uniswap = await ethers.getContractAt(abiRouter, routerUniV3);
    const lpContract = await ethers.getContractAt("IUniswapV3Pool", lpAddress);
    let pToken0 = lpContract.token0();
    let pToken1 = lpContract.token1();
    const [token0, token1] = await Promise.all([pToken0, pToken1]);

    const tokens = [await ethers.getContractAt("ERC20", token0), await ethers.getContractAt("ERC20", token1)];

    let pToken0Decimals = tokens[0].decimals();
    let pToken1Decimals = tokens[1].decimals();
    const [token0Decimals, token1Decimals] = await Promise.all([pToken0Decimals, pToken1Decimals]);
    await (await tokens[0].connect(user).approve(lpContract, MAX_INTEGER)).wait();
    await (await tokens[1].connect(user).approve(lpContract, MAX_INTEGER)).wait();
    await (await tokens[0].connect(user).approve(router3Uniswap, MAX_INTEGER)).wait();
    await (await tokens[1].connect(user).approve(router3Uniswap, MAX_INTEGER)).wait();

    const initState = await collectDataV3Pool(tokens, lpContract, user, token0Decimals, token1Decimals);

    const rawData = [initState];
    const logs = [
        {
            token0Delta: "INIT",
            token1Delta: "INIT",
            lpDelta: "INIT",
            priceImpact: "INIT",
            lpTotal: weiToString(initState.balanceLpTokenUser),
            amountLp: initState.lpBalances,
            lastPrice: weiToString(initState.lastPrice),
            k: Math.abs(Number(initState.balanceToken0Lp * ((initState.lastPrice * initState.balanceToken1Lp) / 10n ** 18n))),
        },
    ];
    for (let index = 0; index < actions.length; index++) {
        const action = actions[index];
        const actionType = action.type;
        switch (actionType) {
            case "swap":
                const inputParams = {
                    tokenIn: action.direction[0] === 0 ? token0 : token1,
                    tokenOut: action.direction[1] === 1 ? token1 : token0,
                    fee: await lpContract.fee(),
                    recipient: user,
                    deadline: Date.now() + 1000,
                    amountIn: parseEther(action.amountIn.toString()),
                    amountOutMinimum: 0,
                    sqrtPriceLimitX96: 0,
                };

                await (await router3Uniswap.exactInputSingle(inputParams)).wait();
                break;

            // case "add_liquidity":
            //     await lpContract.add_liquidity(
            //         action.amounts.map((am) => ethers.parseUnits(am.toString(), 18)),
            //         0
            //     );
            //     break;

            default:
                throw Error("Bad action type");
                break;
        }

        const newState = await collectDataV3Pool(tokens, lpContract, user, token0Decimals, token1Decimals);
        rawData.push(newState);

        logs.push(computeDataV3Pool(rawData, index));
    }

    const endState = await collectDataV3Pool(tokens, lpContract, user, token0Decimals, token1Decimals);

    logs.push({
        token0Delta: "END",
        token1Delta: "END",
        lpDelta: "END",

        priceImpact: "END",
        amountLp: endState.lpBalances,
        lastPrice: weiToString(endState.lastPrice),
        lpTotal: weiToString(endState.balanceLpTokenUser),
    });

    console.table(logs);
}

async function collectDataV3Pool(tokenContracts, lpContract, txInitiator, token0Decimals, token1Decimals) {
    const balanceToken0User = tokenContracts[0].balanceOf(txInitiator);
    const balanceToken1User = tokenContracts[1].balanceOf(txInitiator);

    const balanceToken0Lp = tokenContracts[0].balanceOf(lpContract);
    const balanceToken1Lp = tokenContracts[1].balanceOf(lpContract);

    const balanceLpTokenUser = lpContract.liquidity();

    const slot0 = lpContract.slot0();

    let balances;
    await Promise.all([balanceToken0User, balanceToken1User, balanceToken0Lp, balanceToken1Lp, slot0, balanceLpTokenUser]).then((values) => {
        const [balanceToken0User, balanceToken1User, balanceToken0Lp, balanceToken1Lp, slot0, balanceLpTokenUser] = values;
        const lastPrice =
            ((slot0.sqrtPriceX96 ** 2n / 2n ** 84n) *
                10n ** (token0Decimals <= token1Decimals ? 18n - (token1Decimals - token0Decimals) : 18n + (token0Decimals - token1Decimals))) /
            2n ** 84n;

        balances = {
            balanceToken0User,
            balanceToken1User,
            balanceToken0Lp,
            balanceToken1Lp,
            lastPrice,
            lpBalances: `${Number(formatEther(balanceToken0Lp)).toLocaleString("en-US")} | ${Number(formatEther(balanceToken1Lp)).toLocaleString("en-US")}`,
            balanceLpTokenUser,
        };
    });
    return balances;
}

function computeDataV3Pool(rawData, index) {
    const oldState = rawData[index];
    const newState = rawData[index + 1];
    const token0BalanceDelta = newState.balanceToken0User - oldState.balanceToken0User;
    const token1BalanceDelta = newState.balanceToken1User - oldState.balanceToken1User;

    const lpDelta = newState.balanceLpTokenUser - oldState.balanceLpTokenUser;

    const oldLastPrice = Number(formatEther(oldState.lastPrice));
    const newLastPrice = Number(formatEther(newState.lastPrice));

    const priceImpact = Math.abs(100 - (newLastPrice / oldLastPrice) * 100);

    return {
        token0Delta: weiToString(token0BalanceDelta),
        token1Delta: weiToString(token1BalanceDelta),
        lpDelta: weiToString(lpDelta),

        priceImpact: priceImpact.toLocaleString("en-US"),
        amountLp: newState.lpBalances,
        lastPrice: weiToString(newState.lastPrice),
        lpTotal: weiToString(newState.balanceLpTokenUser),
    };
}

function weiToString(bigInt) {
    return Number(formatEther(bigInt)).toLocaleString("en-US");
}
