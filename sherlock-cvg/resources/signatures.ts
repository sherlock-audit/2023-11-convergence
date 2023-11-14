import {ethers} from "hardhat";

export const WITHDRAW_SDT_BLACKHOLE = ethers.id("withdraw(address,uint256)").substring(0, 10);
export const TRANSFER_ERC20 = ethers.id("transfer(address,uint256)").substring(0, 10);
