import {IBondStruct} from "../typechain-types/contracts/Bond/BondDepository";
import {ethers} from "hardhat";
import {
    TOKEN_ADDR_CNC,
    TOKEN_ADDR_CRV,
    TOKEN_ADDR_CVX,
    TOKEN_ADDR_DAI,
    TOKEN_ADDR_FRAX,
    TOKEN_ADDR_FXS,
    TOKEN_ADDR_SDT,
    TOKEN_ADDR_WETH,
} from "./tokens/common";

export const DAI: IBondStruct.BondParamsStruct = {
    composedFunction: 0,
    token: TOKEN_ADDR_DAI,
    gamma: 250000n,
    bondDuration: 864_000,
    scale: 5000n,
    minRoi: 10000,
    maxRoi: 55000,
    percentageMaxCvgToMint: 200,
    vestingTerm: 432000,
    maxCvgToMint: ethers.parseEther("420000"),
};

export const FRAX: IBondStruct.BondParamsStruct = {
    composedFunction: 0,
    token: TOKEN_ADDR_FRAX,
    gamma: 250000n,
    bondDuration: 864_000,
    scale: 5000n,
    minRoi: 10000,
    maxRoi: 55000,
    percentageMaxCvgToMint: 200,
    vestingTerm: 432000,
    maxCvgToMint: ethers.parseEther("420000"),
};

export const WETH: IBondStruct.BondParamsStruct = {
    composedFunction: 2,
    token: TOKEN_ADDR_WETH,
    gamma: 250000n,
    bondDuration: 864_000,
    scale: 5000n,
    minRoi: 10000,
    maxRoi: 75000,
    percentageMaxCvgToMint: 200,
    vestingTerm: 518400,
    maxCvgToMint: ethers.parseEther("250000"),
};

export const CRV: IBondStruct.BondParamsStruct = {
    composedFunction: 0,
    token: TOKEN_ADDR_CRV,
    gamma: 250000n,
    bondDuration: 864_000,
    scale: 5000n,
    minRoi: 15000,
    maxRoi: 80000,
    percentageMaxCvgToMint: 200,
    vestingTerm: 604800,
    maxCvgToMint: ethers.parseEther("240000"),
};

export const CVX: IBondStruct.BondParamsStruct = {
    composedFunction: 0,
    token: TOKEN_ADDR_CVX,
    gamma: 250000n,
    bondDuration: 864_000,
    scale: 5000n,
    minRoi: 15000,
    maxRoi: 80000,
    percentageMaxCvgToMint: 200,
    vestingTerm: 604800,
    maxCvgToMint: ethers.parseEther("250000"),
};

export const FXS: IBondStruct.BondParamsStruct = {
    composedFunction: 0,
    token: TOKEN_ADDR_FXS,
    gamma: 250000n,
    bondDuration: 864_000,
    scale: 5000n,
    minRoi: 15000,
    maxRoi: 80000,
    percentageMaxCvgToMint: 200,
    vestingTerm: 604800,
    maxCvgToMint: ethers.parseEther("200000"),
};

export const SDT: IBondStruct.BondParamsStruct = {
    composedFunction: 0,
    token: TOKEN_ADDR_SDT,
    gamma: 250000n,
    bondDuration: 864_000,
    scale: 5000n,
    minRoi: 15000,
    maxRoi: 80000,
    percentageMaxCvgToMint: 200,
    vestingTerm: 604800,
    maxCvgToMint: ethers.parseEther("120000"),
};

export const CNC: IBondStruct.BondParamsStruct = {
    composedFunction: 3,
    token: TOKEN_ADDR_CNC,
    gamma: 250000n,
    bondDuration: 864_000,
    scale: 5000n,
    minRoi: 15000,
    maxRoi: 80000,
    percentageMaxCvgToMint: 200,
    vestingTerm: 604800,
    maxCvgToMint: ethers.parseEther("120000"),
};
