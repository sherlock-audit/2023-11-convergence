const {formatEther, parseEther, parseUnits} = require("ethers");

function weiToString(bigInt) {
    return Number(formatEther(bigInt)).toLocaleString("en-US");
}

async function collectDataTriPool(tokenContracts, lpContract, txInitiator) {
    const balanceToken0User = tokenContracts[0].balanceOf(txInitiator);
    const balanceToken1User = tokenContracts[1].balanceOf(txInitiator);
    const balanceToken2User = tokenContracts[2].balanceOf(txInitiator);
    const balanceETHUser = ethers.provider.getBalance(txInitiator);

    const balanceToken0Lp = tokenContracts[0].balanceOf(lpContract);
    const balanceToken1Lp = tokenContracts[1].balanceOf(lpContract);
    const balanceToken2Lp = tokenContracts[2].balanceOf(lpContract);
    const balanceETHLp = ethers.provider.getBalance(lpContract);

    const lastPriceCvg = lpContract.last_prices(0);
    const lastPriceEth = lpContract.last_prices(1);

    const priceOracleCvg = lpContract.price_oracle(0);
    const priceOracleEth = lpContract.price_oracle(1);

    const priceScaleCvg = lpContract.price_scale(0);
    const priceScaleEth = lpContract.price_scale(1);
    let balances;
    await Promise.all([
        balanceToken0User,
        balanceToken1User,
        balanceToken2User,
        balanceETHUser,

        balanceToken0Lp,
        balanceToken1Lp,
        balanceToken2Lp,
        balanceETHLp,

        lastPriceCvg,
        lastPriceEth,

        priceOracleCvg,
        priceOracleEth,

        priceScaleCvg,
        priceScaleEth,
    ]).then((values) => {
        const [
            balanceToken0User,
            balanceToken1User,
            balanceToken2User,
            balanceETHUser,

            balanceToken0Lp,
            balanceToken1Lp,
            balanceToken2Lp,
            balanceETHLp,

            lastPriceCvg,
            lastPriceEth,

            priceOracleCvg,
            priceOracleEth,

            priceScaleCvg,
            priceScaleEth,
        ] = values;

        balances = {
            balanceToken0User,
            balanceToken1User,
            balanceToken2User,
            balanceETHUser,
            balanceToken0Lp,
            balanceToken1Lp,
            balanceToken2Lp,
            balanceETHLp,
            lpBalances: `${Number(formatEther(balanceToken0Lp)).toLocaleString("en-US")} | ${Number(formatEther(balanceToken1Lp)).toLocaleString(
                "en-US"
            )} | ${Number(formatEther(balanceETHLp)).toLocaleString("en-US")}`,

            lastPriceCvg,
            lastPriceEth,
            priceOracleCvg,
            priceOracleEth,
            priceScaleCvg,
            priceScaleEth,
        };
    });
    return balances;
}
