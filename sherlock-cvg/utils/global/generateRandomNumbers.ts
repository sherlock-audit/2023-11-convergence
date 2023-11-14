import {BigNumberish} from "ethers";
export function generateRandomNumbers(N: number): number[] {
    const numbers: number[] = [];
    let sum = 0;

    for (let i = 0; i < N; i++) {
        // Generate a random number between 6 and 100 (inclusive)
        const randomNumber = Math.floor(Math.random() * 95) + 6;

        // Calculate the maximum allowed value for the current number to stay below 100
        const maxAllowedValue = 100 - sum - (N - i - 1) * 5;

        // Ensure that the generated number is within the valid range
        const adjustedRandomNumber = Math.min(randomNumber, maxAllowedValue);

        numbers.push(adjustedRandomNumber);
        sum += adjustedRandomNumber;
    }

    return numbers;
}

export function generateRandomBigInt(): bigint {
    const min = BigInt(1);
    const max = BigInt(10 ** 22);
    const range = max - min;

    const randomBigInt = BigInt(Math.floor(Math.random() * Number(range))) + min;

    return randomBigInt;
}

export function generateRandomMintParams(actualCycle: number): {
    lockDuration: BigNumberish;
    amount: BigNumberish;
    ysPercentage: BigNumberish;
} {
    const randomMint = {
        lockDuration: (Math.floor(Math.random() * 8) + 1) * 12 - actualCycle,
        amount: generateRandomBigInt(),
        ysPercentage: Math.floor(Math.random() * 10) * 10,
    };
    return randomMint;
}
