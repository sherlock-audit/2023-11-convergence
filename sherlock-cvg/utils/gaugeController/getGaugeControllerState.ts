import {AddressLike} from "ethers";
import {GaugeController} from "../../typechain-types-vyper/GaugeController";

interface GaugeVotes {
    stakingContract: AddressLike;
    veCvgAmount: bigint;
}

interface GaugeControllerState {
    gaugeVotes: GaugeVotes[];
    totalVeCvg: bigint;
}
export async function getGaugeControllerVotes(gaugeController: GaugeController): Promise<GaugeControllerState> {
    const gaugeVotes: GaugeVotes[] = [];
    const numberOfGauges = await gaugeController.n_gauges();
    let totalVeCvg = 0n;
    for (let index = 0; index < numberOfGauges; index++) {
        const stakingContract = await gaugeController.gauges(index);
        const veCvgAmount = await gaugeController.get_gauge_weight(stakingContract);
        const gaugeVote: GaugeVotes = {
            stakingContract,
            veCvgAmount,
        };
        gaugeVotes.push(gaugeVote);
        totalVeCvg += gaugeVote.veCvgAmount;
    }
    return {
        gaugeVotes,
        totalVeCvg,
    };
}
