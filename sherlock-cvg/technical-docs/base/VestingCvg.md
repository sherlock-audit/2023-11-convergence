# VestingCvg

## Description

The `VestingCvg` is used to vest in the time the CVG token for seeders, presalers, ibo, team and the dao.
Owner of this contract will need to transfer CVG tokens on it and create the vesting schedule associated to the type of the vesting, to lock the CVGs into it.
Only user who own the NFTs from `SeedPresaleCvg`, `WlPresaleCvg` and `Ibo` can `release` the CVG associated to the given NFT.
For the team and dao allocation, only the addresses associated will be able to `releaseTeamOrDao`.

## SetVesting

Initiate the vesting period from the current timestamp, establish vesting schedules for each type of vesting, verify that the CVG balance matches the total amount allocated for all vesting schedules, and then mark the status as SET.

```mermaid
sequenceDiagram
    DAO Multisig->>+VestingCvg: setVesting
    note over VestingCvg: Check OWNER
    note over VestingCvg: Check VESTING_ALREADY_SET
    note over VestingCvg: Check PRESALE_ROUND_NOT_FINISHED
    VestingCvg->>VestingCvg: Create all vesting schedule
    VestingCvg->>VestingCvg: Set cvg token
    VestingCvg->>VestingCvg: Set state to SET
```

## OpenVesting

Activate the vesting for everyone by changing the status to OPEN.

```mermaid
sequenceDiagram
    DAO Multisig->>+VestingCvg: openVesting
    note over VestingCvg: Check OWNER
    note over VestingCvg: Check VESTING_ALREADY_OPENED
    VestingCvg->>VestingCvg: Set state to OPEN
```

## ReleaseSeed

As the owner of a SEED NFT Presale, he has the ability to release his vested CVG, calculated linearly from the initial cliff period to the end of the vesting term.

```mermaid
sequenceDiagram
    SeedOwner->>+VestingCvg: releaseSeed
    note over VestingCvg: Check NOT_OWNED
    note over VestingCvg: Check VESTING_NOT_OPEN
    VestingCvg-->>VestingCvg: Retrieve amount regarding the current time and the amount already released
    note over VestingCvg: Check NOT_RELEASABLE
    VestingCvg->>VestingCvg: Update CVG claimed for the token
    VestingCvg->>+CVG: transfer CVG tokens to token owner
```

## ReleaseWl

As the owner of a WL NFT Presale, he has the ability to release his vested CVG, calculated linearly from the initial cliff period to the end of the vesting term.

```mermaid
sequenceDiagram
    WhitelistedOwner->>+VestingCvg: releaseWl
    note over VestingCvg: Check NOT_OWNED
    note over VestingCvg: Check VESTING_NOT_OPEN
    VestingCvg-->>VestingCvg: Retrieve amount regarding the current time and the amount already released
    note over VestingCvg: Check NOT_RELEASABLE
    VestingCvg->>VestingCvg: Update CVG claimed for the token
    VestingCvg->>+CVG: transfer CVG tokens to token owner
```

## ReleaseIbo

As the owner of a IBO NFT Presale, he has the ability to release his vested CVG, calculated linearly from the initial cliff period to the end of the vesting term.

```mermaid
sequenceDiagram
    IboOwner->>+VestingCvg: releaseIbo
    note over VestingCvg: Check NOT_OWNED
    note over VestingCvg: Check VESTING_NOT_OPEN
    VestingCvg-->>VestingCvg: Retrieve amount regarding the current time and the amount already released
    note over VestingCvg: Check NOT_RELEASABLE
    VestingCvg->>VestingCvg: Update CVG claimed for the token
    VestingCvg->>+CVG: transfer CVG tokens to token owner
```

## ReleaseTeamOrDao

As a whitelisted TEAM or DAO address, he has the ability to release his vested CVG, calculated linearly from the initial cliff period to the end of the vesting term.

```mermaid
sequenceDiagram
    TeamOrDaoAddress->>+VestingCvg: releaseTeamOrDao
    alt isTeam==true
        note over VestingCvg: Check NOT_TEAM
    else isTeam==false
        note over VestingCvg: Check NOT_DAO
    end
    VestingCvg-->>VestingCvg: Retrieve amount regarding the current time and the amount already released
    note over VestingCvg: Check NOT_RELEASABLE
    VestingCvg->>VestingCvg: Update CVG claimed for team or dao
    VestingCvg->>+CVG: transfer CVG tokens to msg.sender
```
