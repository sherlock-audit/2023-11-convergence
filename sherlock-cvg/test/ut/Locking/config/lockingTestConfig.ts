import {ethers} from "hardhat";

export const LOCKING_POSITIONS = [
    {
        cvgAmount: ethers.parseEther("100"),
        duration: 43,
        lockCycle: 5,
        lockEnd: 49,
    },
    {
        cvgAmount: ethers.parseEther("100"),
        duration: 39,
        lockCycle: 9,
        lockEnd: 49,
    },
    {
        cvgAmount: ethers.parseEther("50"),
        duration: 36,
        lockCycle: 12,
        lockEnd: 49,
    },
    {
        cvgAmount: ethers.parseEther("75"),
        duration: 21,
        lockCycle: 27,
        lockEnd: 49,
    },
    {
        cvgAmount: ethers.parseEther("100"),
        duration: 7,
        lockCycle: 41,
        lockEnd: 49,
    },
    {
        cvgAmount: ethers.parseEther("20"),
        duration: 7,
        lockCycle: 41,
        lockEnd: 49,
    },
    {
        cvgAmount: ethers.parseEther("50"),
        duration: 11,
        lockCycle: 49,
        lockEnd: 61,
    },
];
