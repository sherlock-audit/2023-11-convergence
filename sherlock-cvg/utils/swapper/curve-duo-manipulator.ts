import {ethers} from "hardhat";
import {Signer, formatEther, parseEther} from "ethers";
import {ICrvPool} from "../../typechain-types/contracts/interfaces/ICrvPool.sol";

export async function manipulateCurveDuoLp(lpAddress: string, actions: any[], user: Signer) {
    const lpContract = await ethers.getContractAt("ICrvPool", lpAddress);
    let pLpTokenAddress = lpContract.token();
    let pToken0 = lpContract.coins(0);
    let pToken1 = lpContract.coins(1);
    const [lpTokenAddress, token0, token1] = await Promise.all([pLpTokenAddress, pToken0, pToken1]);

    const lpToken = await ethers.getContractAt("ERC20", lpTokenAddress);
    const tokens = [await ethers.getContractAt("ERC20", token0), await ethers.getContractAt("ERC20", token1)];
    await (await tokens[0].connect(user).approve(lpContract, ethers.MaxUint256)).wait();
    await (await tokens[1].connect(user).approve(lpContract, ethers.MaxUint256)).wait();

    const initState = await collectDataDuoPool(tokens, lpContract, lpToken, user);

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
        },
    ];
    for (let index = 0; index < actions.length; index++) {
        const action = actions[index];
        const actionType = action.type;
        switch (actionType) {
            case "swap":
                await lpContract.exchange(action.direction[0], action.direction[1], parseEther(action.amountIn.toString()), 0, user);
                break;

            case "add_liquidity":
                await lpContract.add_liquidity(
                    action.amounts.map((am) => ethers.parseUnits(am.toString(), 18)),
                    0
                );
                break;

            case "remove_liquidity":
                const toRemove = (rawData[index].balanceLpTokenUser * BigInt(action.lpPercentage)) / 10000n;
                await lpContract.remove_liquidity(toRemove, [0, 0]);
                break;
            case "remove_liquidity_one_coin":
                await lpContract.remove_liquidity_one_coin(ethers.parseUnits(action.amountIn.toString(), 18), action.tokenId, 0);
                break;

            default:
                throw Error("Bad action type");
                break;
        }

        const newState = await collectDataDuoPool(tokens, lpContract, lpToken, user);
        rawData.push(newState);

        logs.push(computeDataDuoPool(rawData, index));
    }

    const endState = await collectDataDuoPool(tokens, lpContract, lpToken, user);

    logs.push({
        token0Delta: "END",
        token1Delta: "END",
        lpDelta: "END",

        priceImpact: "END",
        amountLp: endState.lpBalances,
        lastPrice: weiToString(endState.lastPrice),
        lpTotal: weiToString(endState.balanceLpTokenUser),
        // priceOracle: weiToString(endState.priceOracle),
        // priceScale: weiToString(endState.priceScale),
    });

    console.table(logs);
}

async function collectDataDuoPool(tokenContracts, lpContract: ICrvPool, lpToken, txInitiator) {
    const balanceToken0User = tokenContracts[0].balanceOf(txInitiator);
    const balanceToken1User = tokenContracts[1].balanceOf(txInitiator);

    const balanceToken0Lp = tokenContracts[0].balanceOf(lpContract);
    const balanceToken1Lp = tokenContracts[1].balanceOf(lpContract);

    const balanceLpTokenUser = lpToken.balanceOf(txInitiator);

    const lastPrice = lpContract.last_prices();
    const priceOracle = lpContract.price_oracle();
    const priceScale = lpContract.price_scale();
    let balances;
    await Promise.all([balanceToken0User, balanceToken1User, balanceToken0Lp, balanceToken1Lp, lastPrice, priceOracle, priceScale, balanceLpTokenUser]).then(
        (values) => {
            const [balanceToken0User, balanceToken1User, balanceToken0Lp, balanceToken1Lp, lastPrice, priceOracle, priceScale, balanceLpTokenUser] = values;

            balances = {
                balanceToken0User,
                balanceToken1User,
                balanceToken0Lp,
                balanceToken1Lp,
                lastPrice,
                priceOracle,
                priceScale,
                lpBalances: `${Number(formatEther(balanceToken0Lp)).toLocaleString("en-US")} | ${Number(formatEther(balanceToken1Lp)).toLocaleString("en-US")}`,
                balanceLpTokenUser,
            };
        }
    );
    return balances;
}

function computeDataDuoPool(rawData, index) {
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

function weiToString(bigInt: bigint) {
    return Number(formatEther(bigInt)).toLocaleString("en-US");
}
