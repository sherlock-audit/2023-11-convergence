import {time} from "@nomicfoundation/hardhat-toolbox/network-helpers";

import fs, {PathOrFileDescriptor} from "fs";
import {IContractsUser} from "../contractInterface";
import {ethers} from "hardhat";

const baseChart = {
    labels: [],
    datasets: [
        {
            label: "mgCvg",
            data: [],
            fill: false,
            borderColor: "rgb(255,0,0)",
            tension: 0.1,
        },
        {
            label: "ysCvg",
            data: [],
            fill: false,
            borderColor: "rgb(0, 0, 255)",
            tension: 0.1,
        },
        {
            label: "veCvg",
            data: [],
            fill: false,
            borderColor: "rgb(255,215,0)",
            tension: 0.1,
        },
    ],
};

export const increaseCvgCycleAndWriteForPlotting = async ({contracts, users}: IContractsUser, cycleAmount: number) => {
    const path = "./utils/charts/totalSuppliesData.json";
    if (!fs.existsSync(path)) {
        fs.writeFileSync(path, Buffer.from(JSON.stringify(baseChart)));
    }
    const pathOrFileDescriptor = path as PathOrFileDescriptor;

    const data = JSON.parse(fs.readFileSync(pathOrFileDescriptor).toString());
    const labels = data.labels;
    const mgCvgData = data.datasets[0].data;
    const ysCvgData = data.datasets[1].data;
    const veCvgData = data.datasets[2].data;
    const cvgRewards = contracts.rewards.cvgRewards;

    for (let i = 0; i < cycleAmount; i++) {
        const cycleId = await contracts.base.cvgControlTower.cvgCycle();
        labels.push(cycleId.toString());
        const totalSupplyYsCvg = await contracts.locking.lockingPositionService.totalSupplyYsCvg();
        ysCvgData.push(Number(ethers.formatEther(totalSupplyYsCvg)));
        veCvgData.push(Number(ethers.formatEther(await contracts.locking.veCvg.total_supply())));

        await time.increase(7 * 86_400);
        const txWriteCheckpoints = await (await cvgRewards.connect(users.treasuryDao).writeStakingRewards()).wait();
        const txWriteLockTotalWeights = await (await cvgRewards.connect(users.treasuryDao).writeStakingRewards()).wait();
        const txWriteStaking = await (await cvgRewards.connect(users.treasuryDao).writeStakingRewards()).wait();
        const txUpdateCycle = await (await cvgRewards.connect(users.treasuryDao).writeStakingRewards()).wait();
    }

    fs.writeFileSync(path, Buffer.from(JSON.stringify(data, null, "    ")));
};
function colorGenerator() {
    const r = Math.floor(Math.random() * 255);
    const g = Math.floor(Math.random() * 255);
    const b = Math.floor(Math.random() * 255);
    return `rgb(${r}, ${g}, ${b})`;
}

export const plotTokenSuppliesYsCvg = async (contractUsers: IContractsUser, tokenId: any) => {
    const path = "./utils/charts/tokenSuppliesYsCvg.json";
    let json;
    if (!fs.existsSync(path)) {
        json = {
            labels: [],
            datasets: [],
        };
    } else {
        json = JSON.parse(fs.readFileSync(path).toString());
    }
    let initializeLabels;

    const newToken = {
        label: "token" + tokenId,
        data: [] as number[],
        fill: false,
        borderColor: colorGenerator(),
        tension: 0.1,
    };

    if (json.labels.length == 0) {
        initializeLabels = true;
    }
    for (let cycle = 1; cycle < 251; cycle++) {
        if (initializeLabels) {
            json.labels.push(cycle);
        }
        const ysBalance = Number(ethers.formatEther(await contractUsers.contracts.locking.lockingPositionService.balanceOfYsCvgAt(tokenId, cycle)));
        newToken.data.push(ysBalance);
    }
    json.datasets.push(newToken);
    fs.writeFileSync(path, Buffer.from(JSON.stringify(json, null, "    ")));
};

export const plotTokenSuppliesMgCvg = async (contractsUsers: IContractsUser, tokenId: any) => {
    const path = "./utils/charts/tokenSuppliesMgCvg.json";
    let json;
    if (!fs.existsSync(path)) {
        json = {
            labels: [],
            datasets: [],
        };
    } else {
        json = JSON.parse(fs.readFileSync(path).toString());
    }
    let initializeLabels;

    const newToken = {
        label: "token" + tokenId,
        data: [] as number[],
        fill: false,
        borderColor: colorGenerator(),
        tension: 0.1,
    };

    if (json.labels.length == 0) {
        initializeLabels = true;
    }
    for (let cycle = 1; cycle < 251; cycle++) {
        if (initializeLabels) {
            json.labels.push(cycle);
        }
        const mgBalance = Number(ethers.formatEther(await contractsUsers.contracts.locking.lockingPositionService.balanceOfMgCvgAt(tokenId, cycle)));

        newToken.data.push(mgBalance);
    }
    json.datasets.push(newToken);
    fs.writeFileSync(path, Buffer.from(JSON.stringify(json, null, "    ")));
};
