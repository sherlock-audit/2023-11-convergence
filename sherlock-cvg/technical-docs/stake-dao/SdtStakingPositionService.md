# SdtStakingPositionService

- Register Deposit/Withdraw of all staking positions.
- Eligible staked rewards are staked for at least one entire cycle. Withdrawn rewards are always the most recent ones.
- Is registered as a gauge in the CVG `GaugeController`, so receives $CVG inflation by `CvgRewards`.
- Can pull rewards from its paired `SdtBuffer`, these rewards come from **StakeDao** gauges.
- Can pull $sdAsset bribes from the `SdtBlackhole` ( corresponding to the underlaying $sdAsset ).

### Usecase example :

- **Cycle N**
  - Stakes 100 stakingAsset
- **Cycle N+1**
  - No reward as the 100 staked are still in pending
  - Stake 50 stakingAsset
  - Unstakes 25 stakingAsset
- **Cycle N+2**
  - Rewards for 100 are claimable, 25 stakingAsset are in pending
  - Unstakes 75 stakingAsset
- **Cycle N+3**
  - Rewards for 50 stakingAsset are still claimable

### Note :

Votes must be disabled during the first cycle of deployment to prevent the burning of inflation as 0 token will be staked fully during 1 cycle on the first cycle. Also, processing SDT rewards is not enabled at the first cvgCycle of the deployment.

## deposit

- Issues an NFT **Staking Position** or increase the staked amount on an already existing one.
- Transfer $gaugeAsset from **StakeDao** to the associated **vault**.
- User needs to approve the $gaugeAsset to the `SdtStakingService`
- Staking at cycle N implies that first rewards for these staked asset will be claimable at the beginning of cycle N+2, then every cycle.
- Users can call this function from the `SdtUtilities` to **Convert and Stake** their assets directly.

```mermaid
sequenceDiagram
    actor User
    User->>+SdtStakingService: deposit(amount)
    note over SdtStakingService : Deposit are not paused
    note over SdtStakingService : Amount deposited is > 0
    SdtStakingService-->>+SdtStakingService: Get the receiver of the token

    alt tokenId!=0 => An already existing position is incremented
        SdtStakingService-->>+SdtStakingManager: Fetches the owner and the Staking service linked to the tokenId
        note over SdtStakingService : The token must be owned by the tx creator
        note over SdtStakingService : Verify that the SdtStakingService is correct
    else Minting of a new position
        SdtStakingService->>+SdtStakingManager: Increments and fetch the NFT ID
    end

    SdtStakingService->>+SdtStakingService: _updateAmountStakedDeposit : Update the CycleInfo & the TokenInfo for the next cycle

    alt tokenId=0 => We mint the NFT
        SdtStakingService->>+SdtStakingManager: Mints the NFT with the new ID to the receiver
    end
    SdtStakingService->>StakedAsset: transferFrom(amount) User to the Vault
```

## \_updateAmountStakedDeposit

- Increments the total amount staked for the next cycle because those tokens will be eligible to rewards only when staked for a full cycle.
- Increments the amount staked for the staking position on the next cycle.
- Increments the pending amount which is usefull to determine which staked amount is eligibile to rewards or not.  
  the last sentence doesn't seem really clear to me,

```mermaid
sequenceDiagram
    SdtStakingService-->>SdtStakingService: Get the total staked on the token
    SdtStakingService->>SdtStakingService: Increments the staked amount on the next cycle
    SdtStakingService->>SdtStakingService: Increments the pending staked amount on the next cycle
    SdtStakingService->>SdtStakingService: Increments the total Staked on the next cycle
    alt If Minting of the token, no cycle in history
        SdtStakingService->>SdtStakingService: Push the nextCycle in the history array
    else Adds an amount to an existing
        alt It's the first deposit on the cycle
            alt Staked amount is not reported for the current cycle
                SdtStakingService->>SdtStakingService: Push the currentCycle in the history array
                SdtStakingService->>SdtStakingService: Reports the amountStaked on the token from the last action performed
            end
        end
        SdtStakingService->>SdtStakingService: Push the nextCycle in the history array
    end

```

## Withdraw

- Withdraw stakingAsset (sdAsset-gauge or CvgSdt) from the vault to the Staking Position owner.
- Removing rewards before the end of a cycle leads to the loss of all rewards accumulated during this cycle.
- Withdrawing always removes first from the staked asset deposited on the same cycle ( pending staked ) then on the staked amount eligible to rewards ( on the current cycle).
- If the Staking Position is timelocked, revert withdrawal.

```mermaid
sequenceDiagram
    Actor User
    User->>SdtStakingService: withdraw(amount)
    SdtStakingService-->>SdtPositionManager: Fetches the compliance informations
    note over SdtStakingService : Caller must be the token Owner
    note over SdtStakingService : Verify that the SdtStakingService is correct
    note over SdtStakingService : Verify that the position is not timelocked
    SdtStakingService->>SdtStakingService: Updates the token amount and the total amount for the next and the current cycle.
    SdtStakingService->>Vault: Transfer the asset from the vault to the token owner
```

## \_updateAmountStakedWithdraw

- Increments the total amount staked for the next cycle because those tokens will be eligible to rewards only when staked for a full cycle.
- Decrements the total and token amount staked on the next cycle.
- If the next cycle has some pending amount, we remove it first before removing the amount Staked from the currentCycle.

```mermaid
sequenceDiagram
    SdtStakingService-->>SdtStakingService: Get the total staked on the token
    SdtStakingService-->>SdtStakingService:  Get the pending amount staked on the next cycle
    note over SdtStakingService : Cannot withdraw more than the total staked

    SdtStakingService->>SdtStakingService: Get the last action where a deposit or a withdraw occured.
    alt last action is before the current cycle
        SdtStakingService->>SdtStakingService: Push the current cycle in the history
        SdtStakingService->>SdtStakingService: Reports the last staked amount to the currentCycle
    end

    SdtStakingService->>SdtStakingService: Decrements the next amount staked for the token & the total Staked
    alt If a deposit has been performed on this cycle
        alt If the amount to withdraw is smaller than the pending amount
            SdtStakingService->>SdtStakingService: Decrements the pending Staked of the next cycle only
        else
            SdtStakingService->>SdtStakingService: Removes all the pending Staked
            SdtStakingService->>SdtStakingService: Decrement the leftover on the token and the total staked from the current cycle
        end
    else No deposits occured during this cycle
        SdtStakingService->>SdtStakingService: Decrement the withdrawn amount on the token and the total from the current cycle
    end

```

## processSdtRewards

This function is callable one time per cycle. The distribution for one cycle must be performed after the $CVG rewards process on each `SdtStakingService` contract.
Anyone can call this function to execute the SDT rewards process.

When called it'll :

- **claim_rewards()** on the Stake DAO `Gauge`. This will push the rewards from the Gauge to the corresponding `SdtBuffer`.
- **pullRewards()** on the `SdtBuffer`. This transfers the `SdtBuffer` balance of all rewarded tokens to the `SdtStakingService`. ( Note : All gauges reward $SDT, for SDT only, we are transferring some fees to the `CvgBondTreasury` and `CvgSdtBuffer`). This function needs to return an array of amount.
- **pullSdBribes** on the `SdtBlackhole`. This transfer the balance in the corresponding $sdToken or $Token (ex : $sdCRV or $CRV ) regarding the peg on StakeDao side. We need to identify which type of token is rewarded in the return of the function.

The last step of the function is to writes the amount array (merge amounts coming from `SdtBlackhole` if needed) of all token rewarded in the `SdtStakingService`. For instance, for the sdScrv => [sdtAmount, crvAmount, 3crvAmount, sdCrv]

```mermaid
sequenceDiagram
    Actor User
    User->>+SdtStakingService: processSdtRewards()
    note over SdtStakingService: Cvg Cycle passed & Only one time by cycle
    SdtStakingService->>SdtBuffer: pullRewards() = [tokenAmounts]
    loop over tokenAmounts
        SdtStakingService-->>SdtStakingService: Get the ID of the ERC20 reward
        alt It's the first time the token is distributed
          SdtStakingService->>SdtStakingService: Increments the maximum number of StakeDao rewards
          SdtStakingService->>SdtStakingService: Setup the ID of the new rewards
        end
        SdtStakingService->>SdtStakingService: Writes the amount of this reward distributed on the cycle processed
    end
    SdtStakingService->>SdtStakingService: Flag the CVG rewards as processed
```

## processStakersRewards

- Called during the paginated process in `CvgRewards` process.
- Writes in the `SdtStakingService` the amount of $CVG that will be minted for all stakers for the cycle processed.

```mermaid
sequenceDiagram
    CvgRewards->>SdtStakingService: processStakerRewards(cvgAmount)
    note over SdtStakingService: Only Cvgrewards
    SdtStakingService->>SdtStakingService : Increments the stakingCycle
    SdtStakingService->>SdtStakingService : Set the total amount mintable, calculated by the GaugeController
    SdtStakingService->>SdtStakingService : Reports the previous total staked to the one of the next cycle
    SdtStakingService->>SdtStakingService : Set up the cycle as processed for the CVG rewards


```

## claimCvgRewards

- Callable when the distribution of `CvgRewards` through processStakerRewards is done on `CvgSdtStaking`
- $CVG is claimable by cvgCycle

```mermaid
sequenceDiagram
    Actor User
    User->>SdtStakingService: claimCvgRewards()
    SdtStakingService-->>SdtStakingManager: Fetches the compliance info
    note over SdtStakingService: Check that the caller is the owner
    note over SdtStakingService: Check that the Staking Service is the linked one
    note over SdtStakingService: Check that the token is not timelocked
    note over SdtStakingService: Cannot claim on no cycles
    loop over all cycles
        note over SdtStakingService: Verify that the cycle is past, so claimable
        note over SdtStakingService: Verify the CVG has not been claimed for this cycle
        SdtStakingService-->>SdtStakingService: Get the amount staked eligible to rewards on the iterated cycle

        alt The amount staked on the token is 0
            SdtStakingService-->>SdtStakingService: Computes the share and the CVG claimable amount
        end
        note over SdtStakingService: Verify that the claimable is bigger than 0
        SdtStakingService->>SdtStakingService: Set the cycle as claimed
        SdtStakingService-->>SdtStakingService: Increments the total amount to mint
    end
    SdtStakingService->>Cvg: Mint the CVG to the user
```

## claimCvgSdtRewards

- Callable when the distribution of `CvgSdtBlackHole` through processSdtRewards is done on `CvgSdtStaking`
- $FRAX-3CRV AND ($SDT OR $CvgSdt) are claimable by cvgCycle
- Need to be able to support a new rewarded token

```mermaid
sequenceDiagram
    Actor User
    User->>SdtStakingService: claimCvgRewards()
    SdtStakingService-->>SdtStakingManager: Fetches the compliance info
    note over SdtStakingService: Check that the caller is the owner
    note over SdtStakingService: Check that the Staking Service is the linked one
    note over SdtStakingService: Check that the token is not timelocked
    note over SdtStakingService: Cannot claim on no cycles
    loop over all cycles
      note over SdtStakingService: Verify that the cycle is past, so claimable
      note over SdtStakingService: Verify the CVG has not been claimed for this cycle
      SdtStakingService-->>SdtStakingService: Get the amount staked eligible to rewards on the iterated cycle
      note over SdtStakingService: Verify that the eligible amount is bigger than 0
      alt CVG Rewards are not already claimed on this cycle
        SdtStakingService-->>SdtStakingService: Computes the share and the CVG claimable amount and increments it to amount to mint
        SdtStakingService->>SdtStakingService: Sets the Cvg rewards as processed
      end

      loop over all potential StakeDao rewards
        SdtStakingService-->>SdtStakingService: Fetches the index of the StakeDao rewards
        alt The amount of the iterated StakeDao reward is bigger than 0
          alt Push the token in the total claimable
            SdtStakingService-->>SdtStakingService: Push the token in the total claimable array struct
          end
          SdtStakingService-->>SdtStakingService: Computes the share and the StakeDao reward
          SdtStakingService-->>SdtStakingService: Increments the amount to transfer on this erc20 in the total claimable array
        end
      end

      note over SdtStakingService: The total claimable array length is bigger than 0
      SdtStakingService->>SdtStakingService: Set the cycle as claimed for StakeDao rewards
    end

    alt totalCvg incremented is bigger than 0
      SdtStakingService->>Cvg: Mint the total CVG amount to the user
    end
    loop on the total claimable array
      SdtStakingService->>Token: Transfer the total reward amount from StakeDao
    end
```
