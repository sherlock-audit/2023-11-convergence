\_# Externals ERC20

## Description

there is different types of external Erc20 used in the protocol:

Staking

- TOKE
- TAsset(Tabc)

Bonds

- DAI
- FRAX

## TOKE

Address : [0x2e9d63788249371f1dfc918a52f8d799f4a38c94](https://etherscan.io/address/0x2e9d63788249371f1dfc918a52f8d799f4a38c94)

TOKE is an ERC20 following the openZepelin standard.

ps : it's implement's "ERC20Pausable" so all transfer can be blocked if the token is set to pause <br/>
ps : `pause` aud `unpause` methods are only callable by the owner of the contract

| method         | description                                    |
| -------------- | ---------------------------------------------- |
| `transfer`     | - fail if paused <br/> - OpenZeppelin standard |
| `transferFrom` | - fail if paused <br/> - OpenZeppelin standard |
| `approve`      | OpenZeppelin standard                          |

## TAssets

TAssets : [doc](https://docs.tokemak.xyz/toke/function-of-the-t-tokens/tasset-contract-addresses)
ps : TAssets contracts are exposed via a TransparentUpgradeableProxy , so they can be change / upgraded

there is two type of contracts : EthPool (for tWETH) and Pool(for other)

tEth contract : [0xb104a7fa1041168556218ddb40fe2516f88246d5](https://etherscan.io/address/0xb104a7fa1041168556218ddb40fe2516f88246d5#code)
<br/>tUsdc contract :[0xd899ac9283a44533c36bc8373f5c898b0d5fc03e#code](https://etherscan.io/address/0xd899ac9283a44533c36bc8373f5c898b0d5fc03e#code)

Contracts can be found on Tokemak github :

- [Pool](https://github.com/Tokemak/tokemak-smart-contracts-public/blob/main/contracts/pools/Pool.sol)
- [EthPool](https://github.com/Tokemak/tokemak-smart-contracts-public/blob/main/contracts/pools/EthPool.sol)

For the transfer/transferFrom/approve methods , the contract got the same implementation.

| method         | description                                                                                                                                                                                                                                                                                                                        |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `transfer`     | - fail if paused <br/> - a method is call before the transfer `preTransferAdjustWithheldLiquidity` to update internals mapping , no revert or amount alteration possible <br/>- `encodeAndSendData` is call after the transfer for L2 communication , can revert on bad protocol parameters (not linked to the transaction itself) |
| `transferFrom` | - fail if paused <br/> a method is call before the transfer `preTransferAdjustWithheldLiquidity` to update internals mapping , no revert or amount alteration possible <br/> - `encodeAndSendData` is call after the transfer for L2 communication , can revert on bad protocol parameters (not linked to the transaction itself)  |
| `approve`      | OpenZeppelin standard                                                                                                                                                                                                                                                                                                              |

## Bonds

### DAI

contract : [0x6b175474e89094c44da98b954eedeac495271d0f#code](https://etherscan.io/token/0x6b175474e89094c44da98b954eedeac495271d0f#code)

| method         | description                                        |
| -------------- | -------------------------------------------------- |
| `transfer`     | - custom method , with balance and allowance check |
| `transferFrom` | - custom method , with balance and allowance check |
| `approve`      | - custom method                                    |

### FRAX

contract : [0x853d955acef822db058eb8505911ed77f175b99e](https://etherscan.io/token/0x853d955acef822db058eb8505911ed77f175b99e#code)

| method         | description           |
| -------------- | --------------------- |
| `transfer`     | OpenZeppelin standard |
| `transferFrom` | OpenZeppelin standard |
| `approve`      | OpenZeppelin standard |

### CRV

contract [0xD533a949740bb3306d119CC777fa900bA034cd52](https://etherscan.io/token/0xD533a949740bb3306d119CC777fa900bA034cd52)

| method         | description                                                        |
| -------------- | ------------------------------------------------------------------ |
| `transfer`     | vyper , balance check is managed by underflows error               |
| `transferFrom` | vyper , balance and allowance check is managed by underflows error |
| `approve`      | RAS                                                                |

### SDT

contract [0x73968b9a57c6e53d41345fd57a6e6ae27d6cdb2f](https://etherscan.io/address/0x73968b9a57c6e53d41345fd57a6e6ae27d6cdb2f#code)

| method         | description                                                      |
| -------------- | ---------------------------------------------------------------- |
| `transfer`     | RAS , balance check is managed by underflows error               |
| `transferFrom` | RAS , balance and allowance check is managed by underflows error |
| `approve`      | RAS                                                              |

### CVX

contract : [0x4e3fbd56cd56c3e72c1403e103b45db9da5b9d2b](https://etherscan.io/token/0x4e3fbd56cd56c3e72c1403e103b45db9da5b9d2b#code)

| method         | description                                                      |
| -------------- | ---------------------------------------------------------------- |
| `transfer`     | RAS , balance check is managed by underflows error               |
| `transferFrom` | RAS , balance and allowance check is managed by underflows error |
| `approve`      | RAS                                                              |

### FXS

contract : [0x3432b6a60d23ca0dfca7761b7ab56459d9c964d0](https://etherscan.io/token/0x3432b6a60d23ca0dfca7761b7ab56459d9c964d0#code)

| method         | description                                                                                                                                            |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `transfer`     | -balance check is managed by underflows error <br/> -a `trackVotes` method is call before the transfer but have no effect on the transaction or amount |
| `transferFrom` | -balance check is managed by underflows error <br/> -a `trackVotes` method is call before the transfer but have no effect on the transaction or amount |
| `approve`      | RAS                                                                                                                                                    |

### CNC

contract : [0x9aE380F0272E2162340a5bB646c354271c0F5cFC](https://etherscan.io/token/0x9aE380F0272E2162340a5bB646c354271c0F5cFC#code)

| method         | description                                   |
| -------------- | --------------------------------------------- |
| `transfer`     | -balance check is managed by underflows error |
| `transferFrom` | -balance check is managed by underflows error |
| `approve`      | RAS                                           |
