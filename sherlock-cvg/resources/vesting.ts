import {ethers} from "hardhat";
import {TOKEN_ADDR_CRV, TOKEN_ADDR_CVX, TOKEN_ADDR_FRAX} from "./tokens/common";
const TOTAL_CVG_TO_SOLD_IBO = 1_000_000;
export const REAL_VESTING_SCHEDULES = {
    PRESEED_SEED: {
        totalCvgAmount: 8_800_000,
        daysBeforeCliff: 4 * 30,
        daysAfterCliff: 15 * 30,
        dropCliff: 50,
        type: 0,
    },
    WL: {
        totalCvgAmount: 2_450_000,
        daysBeforeCliff: 0,
        daysAfterCliff: 3 * 30,
        dropCliff: 330,
        type: 1,
    },
    IBO: {
        totalCvgAmount: TOTAL_CVG_TO_SOLD_IBO,
        daysBeforeCliff: 0,
        daysAfterCliff: 2 * 30,
        dropCliff: 0,
        type: 2,
    },
    TEAM: {
        totalCvgAmount: 12_750_000,
        daysBeforeCliff: 180,
        daysAfterCliff: 18 * 30,
        dropCliff: 50,
        type: 3,
    },
    DAO: {
        totalCvgAmount: 15_000_000,
        daysBeforeCliff: 0,
        daysAfterCliff: 18 * 30,
        dropCliff: 50,
        type: 4,
    },
};
export const REAL_IBO_PARAMETERS = {
    FRAX: {
        BOND_PARAMETERS: {
            composedFunction: 0,
            token: TOKEN_ADDR_FRAX,
            gamma: 250_000, // 0.25%
            scale: 5_000, // 0.5%
            minRoi: 140_000, // 14%
            maxRoi: 200_000, // 20%
            percentageMaxCvgToMint: 40,
            maxCvgToMint: ethers.parseEther((TOTAL_CVG_TO_SOLD_IBO * 0.25).toString()),
        },
    },
    CRV: {
        BOND_PARAMETERS: {
            composedFunction: 0,
            token: TOKEN_ADDR_CRV,
            gamma: 250_000, // 0.25%
            scale: 5_000, // 0.5%
            minRoi: 140_000, // 14%
            maxRoi: 200_000, // 20%
            percentageMaxCvgToMint: 20,
            maxCvgToMint: ethers.parseEther((TOTAL_CVG_TO_SOLD_IBO * 0.5).toString()),
        },
    },
    CVX: {
        BOND_PARAMETERS: {
            composedFunction: 0,
            token: TOKEN_ADDR_CVX,
            gamma: 250_000, // 0.25%
            scale: 5_000, // 0.5%
            minRoi: 140_000, // 14%
            maxRoi: 200_000, // 20%
            percentageMaxCvgToMint: 40,
            maxCvgToMint: ethers.parseEther((TOTAL_CVG_TO_SOLD_IBO * 0.25).toString()),
        },
    },
};
