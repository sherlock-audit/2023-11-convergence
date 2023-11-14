import { ethers } from "hardhat";
import { Ibo } from "../typechain-types";
import { TOKEN_ADDR_CRV, TOKEN_ADDR_CVX, TOKEN_ADDR_FRAX } from "./tokens/common";

export const TOTAL_CVG_TO_SOLD_IBO = 1_500_000;

export const FRAX: Ibo.BondParamsStruct = {
    composedFunction: 0,
    token: TOKEN_ADDR_FRAX,
    gamma: 250_000, // 0.25%
    scale: 5_000, // 0.5%
    minRoi: 140_000, // 14%
    maxRoi: 200_000, // 20%
    percentageMaxCvgToMint: 40,
    maxCvgToMint: ethers.parseEther((TOTAL_CVG_TO_SOLD_IBO * 0.25).toString()),
}

export const CRV: Ibo.BondParamsStruct = {
    composedFunction: 0,
    token: TOKEN_ADDR_CRV,
    gamma: 250_000, // 0.25%
    scale: 5_000, // 0.5%
    minRoi: 140_000, // 14%
    maxRoi: 200_000, // 20%
    percentageMaxCvgToMint: 20,
    maxCvgToMint: ethers.parseEther((TOTAL_CVG_TO_SOLD_IBO * 0.5).toString()),
}

export const CVX: Ibo.BondParamsStruct = {
    composedFunction: 0,
    token: TOKEN_ADDR_CVX,
    gamma: 250_000, // 0.25%
    scale: 5_000, // 0.5%
    minRoi: 140_000, // 14%
    maxRoi: 200_000, // 20%
    percentageMaxCvgToMint: 40,
    maxCvgToMint: ethers.parseEther((TOTAL_CVG_TO_SOLD_IBO * 0.25).toString()),
}

