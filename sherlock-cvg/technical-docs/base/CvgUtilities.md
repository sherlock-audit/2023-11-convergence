# CvgUtilities

## Global description

`CvgUtilities` is a contract allowing to improve the user experience by reducing the number of transactions:

- Claims on `YsDistributor` for several NFT owned or delegated on several TDE cycle.
- Claims on several `BondDepository` on multiple NFT owned.
- Creates a bond or locking position starting with common ERC20 tokens (WETH / DAI / etc.)

## Function details

### claimMultipleLocking

Allows to claim several TDE cycles on multiple tokenIds from `LockingPositionService` owned or delegated.

```mermaid
sequenceDiagram
actor Tokens Owner/Delegated
Tokens Owner/Delegated->>CvgUtilities: claimMultipleLocking
    loop on tokenIds
        loop on tdeIds
            CvgUtilities->>YsDistributor: claimRewards
        END
    END
```

### claimMultipleBonds

Allows to redeem in one transaction several tokenIds from several `BondDepository`.

```mermaid
sequenceDiagram
actor Tokens Owner
Tokens Owner->>CvgUtilities: claimMultipleBonds
    loop on bond contracts
        loop on token Ids
            CvgUtilities->>BondDepository: redeem
        END
    END
```

### swapTokenBondAndLock

Allows in one transaction to:

- Buy bond contract's token through `1INCH`
- Transfer additional bond tokens from user
- Mint or update a locking position with these tokens

```mermaid
sequenceDiagram
actor Tokens Owner / User
Tokens Owner / User->>CvgUtilities: swapTokenBondAndLock
ALT swapData
    note over CvgUtilities: Check INVALID_DESTINATION_TOKEN
    CvgUtilities-->>CvgControlTower:Fetch SwapperFactory
    CvgUtilities->>SwapperFactory:executeSimpleSwap
END

ALT transfer bond token from user
    CvgUtilities->>Bond Token: transferFrom msg.sender to CvgUtilities
    CvgUtilities-->>CvgUtilities: increment bond token to deposit
END

note over CvgUtilities: Check INVALID_AMOUNT

ALT _lockTokenId > 0 OR _lockDuration > 0
    CvgUtilities-->>CvgControlTower: Fetch LockingPositionService
    note over CvgUtilities: Check NOT_ALLOWED
    CvgUtilities->>Bond Contract: depositToLock
    
    ALT _lockTokenId > 0
        CvgUtilities-->>Locking Position Service: Get locking position endCycle
        CvgUtilities-->>CvgControlTower: Get current CVG cycle
        
        ALT _durationAdd > 0
            note over CvgUtilities: Check ADDED_LOCK_DURATION_NOT_ENOUGH
            CvgUtilities->>Locking Position Service: increaseLockTimeAndAmount 
        ELSE
            note over CvgUtilities: Check REMAINING_LOCK_DURATION_TOO_LOW
            CvgUtilities->>Locking Position Service: increaseLockAmount
        END
    ELSE
        note over CvgUtilities: Check LOCK_DURATION_NOT_LONG_ENOUGH
        CvgUtilities->>Locking Position Service: mintPosition
    END
ELSE
    CvgUtilities->>Bond Contract: deposit
END
```

### approveRouterTokenSpending

Approve other contracts to spend contract's ERC20 specific token.
This is needed when we want to create a bond or locking position for example.
Only callable by the owner.

```mermaid
sequenceDiagram
Owner->>CvgUtilities: approveRouterTokenSpending
CvgUtilities->>Token: approve
```