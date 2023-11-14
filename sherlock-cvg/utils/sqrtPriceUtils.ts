import {ERC20} from "../typechain-types/@openzeppelin/contracts/token/ERC20";

export const sqrtPriceX96Calculator = async (token0: ERC20, token1: ERC20, priceToken01: number) => {
    const precision = 3;
    const token0Decimals = Number(await token0.decimals());
    const token1Decimals = Number(await token1.decimals());
    const sqrtPriceString = (Math.sqrt(priceToken01 * Math.pow(10, Math.abs(token0Decimals - token1Decimals))) * Math.pow(2, 96)).toString();

    const splittedPrice = sqrtPriceString.split("e+");
    const prefixToInt = Number(splittedPrice[0]) * Math.pow(10, precision);
    const exponent = Number(splittedPrice[1]) - precision;

    return BigInt(prefixToInt) * 10n ** BigInt(exponent);
};
