import "dotenv/config";
import {HardhatUserConfig} from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomiclabs/hardhat-vyper";
import "@openzeppelin/hardhat-upgrades";

import "hardhat-contract-sizer";

// import "hardhat-docgen";
import "@primitivefi/hardhat-dodoc";
// import "@solarity/hardhat-markup";

import "@nomicfoundation/hardhat-ethers";
import "hardhat-storage-layout";
//import "hardhat-tracer";
import "@nomiclabs/hardhat-vyper";
const PRIVKEY_DEFAULT = "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

const config: HardhatUserConfig = {
    vyper: {
        compilers: [
            {
                version: "0.3.7",
            },
        ],
    },
    solidity: {
        compilers: [
            {
                version: "0.8.17",
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 250,
                    },
                },
            },
        ],
    },
    networks: {
        localhost: {
            chainId: 31337, // Chain ID should match the hardhat network's chainid
            forking: {
                url: `https://rpc.ankr.com/eth`,
                blockNumber: 18564842,
            },
            loggingEnabled: true,
            timeout: 360_000,
        },
        hardhat: {
            forking: {
                url: `https://rpc.ankr.com/eth`,
                // blockNumber: 18564842,
            },
        },
        cvg: {
            chainId: 31337, // Chain ID should match the hardhat network's chainid
            url: "https://io.convergence-finance.network:8545",
            timeout: 100_000,
        },
        goerli: {
            chainId: 5, // Chain ID should match the hardhat network's chainid
            url: "https://rpc.ankr.com/eth_goerli",
            accounts: [process.env.DEPLOYER_PRIVKEY ? process.env.DEPLOYER_PRIVKEY : PRIVKEY_DEFAULT],
        },
        sepolia: {
            chainId: 11155111, // Chain ID should match the hardhat network's chainid
            url: "https://rpc.sepolia.org",
            gasPrice: 1000000000,
        },
        mainnet: {
            chainId: 1,
            url: "https://rpc.ankr.com/eth",
            accounts: [process.env.DEPLOYER_PRIVKEY ? process.env.DEPLOYER_PRIVKEY : PRIVKEY_DEFAULT],
        },
    },

    dodoc: {
        runOnCompile: false,
        debugMode: false,
        keepFileStructure: true,
        include: [
            "contracts/Bond",
            "contracts/Oracles",
            "contracts/PresaleVesting",
            "contracts/Rewards",
            "contracts/Token",
            "contracts/Utils",
            "contracts/CloneFactory.sol",
            "contracts/CvgControlTower.sol",
            "contracts/Staking",
        ],
        exclude: ["GaugeController.vy", "veCVG.vy", "contracts/mocks"],
        templatePath: "utils/template.sqrl",
    },

    mocha: {
        timeout: 100000000,
    },
    gasReporter: {
        enabled: true,
        currency: "USD",
        gasPrice: 30,
        outputFile: "./gasReporting.md",
        noColors: true,
        token: "ETH",
        gasPriceApi: process.env.ETHERSCAN_API_KEY,
        coinmarketcap: process.env.CMC_API,
    },
    etherscan: {
        apiKey: process.env.ETHERSCAN_API_KEY,
        customChains: [
            {
                network: "local",
                chainId: 31337,
                urls: {
                    apiURL: "http://localhost/api",
                    browserURL: "http://localhost",
                },
            },
        ],
    },

    typechain: {
        outDir: "typechain-types",
        target: "ethers-v6",
        alwaysGenerateOverloads: false, // should overloads with full signatures like deposit(uint256) be generated always, even if there are no overloads?
        dontOverrideCompile: false, // defaults to false
    },
};

export default config;
