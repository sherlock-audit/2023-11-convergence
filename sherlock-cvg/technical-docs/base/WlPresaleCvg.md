# WlPresaleCvg

## Description

During the presale phase, the `WlPresaleCvg` contract will be used to collect all the investments from whitelisted addresses.
This contract uses merkletree to list all the addresses (more gas efficient when the listing is very long).

An Wl user with `investMint` can transfer DAI or FRAX to create his Presale position represented by an NFT. There is a minimum and a maximum investment that is defined by the size of the WL (S,M,L). It is also possible to refill the investment (on the same NFT) with `refillToken` if the max size is not reached.

### investMint

```mermaid
sequenceDiagram
    WhitelistedAddress->>+WlPresaleCvg: investMint
    note over WlPresaleCvg: Check PRESALE_NOT_STARTED
    note over WlPresaleCvg: Check PRESALE_ROUND_FINISHED
    note over WlPresaleCvg: Check INVALID_AMOUNT
    note over WlPresaleCvg: Check ALREADY_MINTED
    WlPresaleCvg-->>WlPresaleCvg: Compute cvgAmount
    WlPresaleCvg-->>WlPresaleCvg: MerkleProof.verify
    note over WlPresaleCvg: Check INVALID_PROOF
    note over WlPresaleCvg: Check INSUFFICIENT_AMOUNT
    note over WlPresaleCvg: Check TOO_MUCH_Q_WL
    note over WlPresaleCvg: Check NOT_ENOUGH_CVG_SUPPLY
    WlPresaleCvg->>WlPresaleCvg: Create PresaleInfos data for address
    WlPresaleCvg->>WlPresaleCvg: Update available CVG supply and toggle address as minter

    alt isDai
        WlPresaleCvg->>+DAI: transferFrom User to WlPresale contract
    else isFrax
        WlPresaleCvg->>+FRAX: transferFrom User to WlPresale contract
    end

    WlPresaleCvg->>WlPresaleCvg: _mint
```

### refillToken

```mermaid
sequenceDiagram
    NFT Owner->>+WlPresaleCvg: refillToken
    note over WlPresaleCvg: Check NOT_OWNED
    WlPresaleCvg-->>WlPresaleCvg: Compute cvgAmount
    note over WlPresaleCvg: Check TOO_MUCH_Q_WL
    WlPresaleCvg->>WlPresaleCvg: Update data for token
    WlPresaleCvg->>WlPresaleCvg: Update available CVG supply

    alt
        WlPresaleCvg->>+DAI: transferFrom NFT Owner to WlPresaleCvg
    else
        WlPresaleCvg->>+FRAX: transferFrom NFT Owner to WlPresaleCvg
    end
```
