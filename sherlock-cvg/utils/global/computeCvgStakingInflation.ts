const INITIAL_DISTRIBUTION = 60576923076923076923076n;
const SQRT_2 = 1414213562373095048n;
const INFLATION_CHANGE_INTERVAL_CYCLE = 105n;

export function calcStakingInflation(cycle: number): bigint {
    if (cycle <= 1) {
        return 0n;
    }
    const inflationCycle = BigInt(cycle) / INFLATION_CHANGE_INTERVAL_CYCLE;
    let inflationTarget = INITIAL_DISTRIBUTION;
    for (let index = 0; index < inflationCycle; index++) {
        inflationTarget = (inflationTarget * 10n ** 18n) / SQRT_2;
    }

    return inflationTarget;
}
