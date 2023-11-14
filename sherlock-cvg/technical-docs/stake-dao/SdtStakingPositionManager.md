# SdtStakingPositionManager

This contract is a `CvgERC721TimeLockingUpgradeable` contract.

The first motivation of this contract is to externalize the NFT logic from the `SdtStakingService` in order to get space in the size of the contract :

- Tokenize a Staking Position through a transferable NFT.
- All minted positions are linked to a `SdtStakingService`.

## mint

- Mints a Staking Position to the Staking depositor
- This function is only callable by a `StakingService` contract during the _deposit_.

```mermaid
sequenceDiagram
    SdtStakingService->>SdtStakingPositionManager: mint
    SdtStakingService-->>CvgControlTower: Fetches if the caller is a Staking Contract
    note over SdtStakingPositionManager : Verify that the caller is Staking contract
    SdtStakingPositionManager->>SdtStakingPositionManager: Associate the token Id to mint with the staking contract

    SdtStakingPositionManager->>SdtStakingPositionManager: Mints the token ID to the user

```

## burn

- Burn the staking position only if the staked amount is equal to 0.

```mermaid
sequenceDiagram
    Actor User
    User->>SdtStakingPositionManager: burn
    SdtStakingPositionManager-->>SdtStakingService: Fetches the amount staked on the position
    note over SdtStakingPositionManager : Verify that the amount staked is 0
    SdtStakingPositionManager->>SdtStakingPositionManager: Burns the Staking position
```
