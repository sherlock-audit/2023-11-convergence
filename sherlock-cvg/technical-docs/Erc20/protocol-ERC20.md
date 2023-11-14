# Protocol ERC20

## Description

there is different types of Erc20 used in the protocol:

- Cvg
- CvgToke

## Cvg

### Description

The main protocol token , used to reflect the value of the protocol.
A liquidity pool will be created on curve to allow the token to be traded.

Involved Contracts :

- contracts/Token/Cvg.sol
- contracts/CvgControlTower.sol

### remarkable functionality

| method        | description                                                                                                            |
| ------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `mintBond`    | Allow bonds contracts to mint CVG accordingly ` MAX_SUPPLY_BOND`                                                       |
| `mintStaking` | Allow stakings contracts to mint CVG accordingly ` MAX_SUPPLY_STAKING`                                                 |
| `burn`        | the burn method is overloaded compared to the openzepelin standard, the total supply is diminished by the burnt amount |

## CvgToke

### Description

For user to stake their `TOKE` in convergence protocol they have to convert them to `CvgToke` token

it can be minted by the staking contract (one to one with TOKE) ,
A TOKE/CvgToke liquidity pool will be created on curve.

Involved Contracts :

- contracts/Token/Cvg.sol
- contracts/CvgControlTower.sol

### remarkable functionality

| method | description                                                                            |
| ------ | -------------------------------------------------------------------------------------- |
| `mint` | Mint CvgToke one to one for toke , toke is transferred to the treasuryStaking contract |
