import axios from "axios";

import {ethers, network} from "hardhat";
interface DefiLlamaTokenData {
    decimals: number;
    symbol: string;
    price: number;
    timestamp: number;
    confidence: number;
}

export class ApiHelper {
    static oneInchApiEndpoint = "https://api-staging.convergence-finance.network";
    static defiLlamaApiEndpoint = "https://coins.llama.fi";

    static async getDefiLlamaTokenPrices(tokensAddresses: string[], searchWidth = "4h"): Promise<any> {
        const tokensCall = tokensAddresses.join(",ethereum:");
        let priceUri;
        if (network.config.forking.blockNumber) {
            const timestamp = (await ethers.provider.getBlock(network.config.forking.blockNumber))?.timestamp.toString();
            priceUri = `${ApiHelper.defiLlamaApiEndpoint}/prices/historical/${timestamp}/ethereum:${tokensCall}?searchWidth=${searchWidth}`;
        } else {
            priceUri = `${ApiHelper.defiLlamaApiEndpoint}/prices/current/ethereum:${tokensCall}?searchWidth=${searchWidth}`;
        }
        const response = (await axios.get(priceUri)).data.coins;
        const filteredPrices: {[key: string]: DefiLlamaTokenData} = {};
        Object.keys(response).forEach((key) => {
            const newKey = key.replace("ethereum:", "");
            filteredPrices[newKey] = response[key];
        });
        return filteredPrices;
    }

    static async getOneInchDataForSwap(
        fromTokenAddress: string,
        toTokenAddress: string,
        amount: string,
        fromAddress: string,
        slippage: string,
        destReceiver: string
    ) {
        const swapUri = `${ApiHelper.oneInchApiEndpoint}/swap/${fromTokenAddress}/${toTokenAddress}/${amount}/${fromAddress}/${destReceiver}/${slippage}`;
        const swapResponse = await fetch(swapUri);

        const data = await swapResponse.json();

        await new Promise(function (resolve) {
            setTimeout(resolve, 2 * 1000);
        });
        const iface = new ethers.Interface(["function swap(address,(address,address,address,address,uint256,uint256,uint256),bytes,bytes)"]);
        const functionData = iface.decodeFunctionData("swap", data.tx.data);
        return {
            executor: functionData[0],
            description: functionData[1].map((data: any) => data.toString()),
            permit: functionData[2],
            data: functionData[3],
        };
    }

    static async verifyContractEthernal(name: string, address: string, abi: any) {
        var data = JSON.stringify({
            data: {
                workspace: "Hosted Hardhat",
                name: name,
                abi: abi,
            },
        });
        var config = {
            method: "post",
            url: `https://api.tryethernal.com/api/contracts/${address}`,
            headers: {
                Authorization: `Bearer ${process.env.ETHERNAL_API_KEY}`,
                "Content-Type": "application/json",
            },
            data: data,
        };
        axios(config)
            .then(function (response) {
                console.log(JSON.stringify(response.data));
            })
            .catch(function (error) {
                console.log(error);
            });
    }
}
