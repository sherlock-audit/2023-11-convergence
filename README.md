
# Convergence contest details

- Join [Sherlock Discord](https://discord.gg/MABEWyASkp)
- Submit findings using the issue page in your private contest repo (label issues as med or high)
- [Read for more details](https://docs.sherlock.xyz/audits/watsons)

# Q&A

### Q: On what chains are the smart contracts going to be deployed?
The Convergence protocol will be deployed on the Ethereum Mainnet.
___

### Q: Which ERC20 tokens do you expect will interact with the smart contracts? 
# LockingPositionService
Lock the CVG in the LockingPositionService
- CVG

# CvgSdtBuffer
Receives and acculate the following rewards : 
- sdFRAX3CRV coming from veSDT holding. Transfered from the FeeDistributor (https://etherscan.io/address/0x29f3dd38dB24d3935CF1bf841e6b2B461A3E5D92)
- SDT from our SdtFeeCollector and potential boost sending directly from a Multisig.
- CvgSDT from potential bribes sent directly from a Multisig on the contract.

# SdtBlackhole
- sdAssetGauge received through Staking
- Bribe tokens accumulated and sent to SdtRewardReceiver

# SdtBuffer
- Accumulates and receives any ERC20 coming from the StakeDao Gauge ( SDT, CRV, 3CRV, BAL, USDC, FXS, FXN, PENDLE, ANGLE sdCRV, sdBAL ... ) 

# SdtFeeCollector
- Receives Fees in SDT from all buffer ( except CvgSDT ) 
- Dispatch fees between different receivers

# YsDistributor 
Receives rewards from the treasury. The list of ERC20 can vary.
- Curve (CRV) 
- Convex (CVX)
- StakeDao (SDT)
- Frax-Share (FXS)
- Prisma (PRISMA)
(...)
- USDC
- USDT
- DAI

# SdtRewardReceiver 
- Mints CVG to claimer
- Receives all ERC20 coming from Gauge ( SDT, CRV, 3CRV, FXS .. )  + Bribe assets ( sdCRV, sdPENDLE, sdFXS, sdPENDLE, sdANGLE ... ) 
- Transfer rewards to Stakers on claim

# SdtStakingPositionService
- transferFrom caller to SdtBlackHole gaugeAsset from StakeDao 
- transferFrom caller to SdtStakingPositionService CvgSDT 

# CvgSDT 
- transferFrom SDT from caller to veSDTMultisig on mint on 1:1 ratio.

# SdtUtilities
Convert & Stake assets in Staking contracts 
- sdGaugeAsset ( sdGaugeCRV, sdGaugeFXS, sdGaugeFXN ... ) 
- sdAsset ( sdCRV, sdFXS, sdFXN ... ) 
- asset ( CRV, FXS, FXN ... )
- SDT & CvgSDT
___

### Q: Which ERC721 tokens do you expect will interact with the smart contracts? 
Only NFT that we made : 

- LockingPositionManager

- SdtStakingPositionManager

- BondPositionManager

___

### Q: Do you plan to support ERC1155?
None
___

### Q: Which ERC777 tokens do you expect will interact with the smart contracts? 
None
___

### Q: Are there any FEE-ON-TRANSFER tokens interacting with the smart contracts?

We have some interaction with USDC and potentially USDT. 
We didn't consider this in our contracts and are assuming the risk.

___

### Q: Are there any REBASING tokens interacting with the smart contracts?

None
___

### Q: Are the admins of the protocols your contracts integrate with (if any) TRUSTED or RESTRICTED?
TRUSTED
___

### Q: Is the admin/owner of the protocol/contracts TRUSTED or RESTRICTED?
TRUSTED
___

### Q: Are there any additional protocol roles? If yes, please explain in detail:
# Treasury DAO
Multisig executing the action voted by the DAO.

# VeSdtMultisig
Multisig receiving SDT from CvgSDT staking. Lock this SDT in veSDT.

# Bond
A bond contract can mint CVG.

# Staking
A staking contract can mint CVG
Only a Staking contract can be a gauge

# isSdtStaking
A SDT staking contract that can withdraw a gauge token from the SdtBlackHole
___

### Q: Is the code/contract expected to comply with any EIPs? Are there specific assumptions around adhering to those EIPs that Watsons should be aware of?
None
___

### Q: Please list any known issues/acceptable risks that should not result in a valid finding.
None
___

### Q: Please provide links to previous audits (if any).
Halborn ( on the old Tokemak integration ) : https://ipfs.io/ipfs/QmPyZZoeNJqt44GiFRoc8E9JctCyp5DYxkW254hhfkeUui

Hats ( on the Bond mechanism & Oracle price fetching ) : https://app.hats.finance/audit-competitions/convergence-finance-ibo-0x0e410e7af8e70fc5bffcdbfbdf1673ee7b3d0777/leaderboard
___

### Q: Are there any off-chain mechanisms or off-chain procedures for the protocol (keeper bots, input validation expectations, etc)?
None
___

### Q: In case of external protocol integrations, are the risks of external contracts pausing or executing an emergency withdrawal acceptable? If not, Watsons will submit issues related to these situations that can harm your protocol's functionality.
We are interacting with StakeDao on the integration of their Gauge contract through our Staking architecture. 

We are for instance : 
- Claiming rewards from their Gauges, if the claim is broken on their Gauges, it'll break on our side also. ( It's not impacting funds of the user, only the potential earned rewards on 1 week ) . 
- Converting asset to sdAsset to sdGaugeAsset in SdtUtilities, using the StakeDao converters

We are aware of this kind of issues, we so separated the Convergence rewards from the rewards coming from StakeDao, in order not to break the full protocol.
___

### Q: Do you expect to use any of the following tokens with non-standard behaviour with the smart contracts?
USDC & USDT
___

### Q: Add links to relevant protocol resources
Technical documentation is to find through natspec in contracts & under technical documentation folder: https://github.com/sherlock-audit/2023-11-convergence/tree/main/sherlock-cvg/technical-docs
___



# Audit scope


[sherlock-cvg @ d0b36ce5ebb141895e4bf23b241a184fa0606b1b](https://github.com/Cvg-Finance/sherlock-cvg/tree/d0b36ce5ebb141895e4bf23b241a184fa0606b1b)
- [sherlock-cvg/contracts/Locking/GaugeController.vy](sherlock-cvg/contracts/Locking/GaugeController.vy)
- [sherlock-cvg/contracts/Locking/LockingPositionDelegate.sol](sherlock-cvg/contracts/Locking/LockingPositionDelegate.sol)
- [sherlock-cvg/contracts/Locking/LockingPositionManager.sol](sherlock-cvg/contracts/Locking/LockingPositionManager.sol)
- [sherlock-cvg/contracts/Locking/LockingPositionService.sol](sherlock-cvg/contracts/Locking/LockingPositionService.sol)
- [sherlock-cvg/contracts/Locking/veCVG.vy](sherlock-cvg/contracts/Locking/veCVG.vy)
- [sherlock-cvg/contracts/Rewards/CvgRewards.sol](sherlock-cvg/contracts/Rewards/CvgRewards.sol)
- [sherlock-cvg/contracts/Rewards/StakeDAO/CvgSdtBuffer.sol](sherlock-cvg/contracts/Rewards/StakeDAO/CvgSdtBuffer.sol)
- [sherlock-cvg/contracts/Rewards/StakeDAO/SdtBlackHole.sol](sherlock-cvg/contracts/Rewards/StakeDAO/SdtBlackHole.sol)
- [sherlock-cvg/contracts/Rewards/StakeDAO/SdtBuffer.sol](sherlock-cvg/contracts/Rewards/StakeDAO/SdtBuffer.sol)
- [sherlock-cvg/contracts/Rewards/StakeDAO/SdtFeeCollector.sol](sherlock-cvg/contracts/Rewards/StakeDAO/SdtFeeCollector.sol)
- [sherlock-cvg/contracts/Rewards/YsDistributor.sol](sherlock-cvg/contracts/Rewards/YsDistributor.sol)
- [sherlock-cvg/contracts/Staking/StakeDAO/SdtRewardReceiver.sol](sherlock-cvg/contracts/Staking/StakeDAO/SdtRewardReceiver.sol)
- [sherlock-cvg/contracts/Staking/StakeDAO/SdtStakingPositionManager.sol](sherlock-cvg/contracts/Staking/StakeDAO/SdtStakingPositionManager.sol)
- [sherlock-cvg/contracts/Staking/StakeDAO/SdtStakingPositionService.sol](sherlock-cvg/contracts/Staking/StakeDAO/SdtStakingPositionService.sol)
- [sherlock-cvg/contracts/Token/Cvg.sol](sherlock-cvg/contracts/Token/Cvg.sol)
- [sherlock-cvg/contracts/Token/CvgERC721TimeLockingUpgradeable.sol](sherlock-cvg/contracts/Token/CvgERC721TimeLockingUpgradeable.sol)
- [sherlock-cvg/contracts/Token/CvgSDT.sol](sherlock-cvg/contracts/Token/CvgSDT.sol)
- [sherlock-cvg/contracts/utils/CvgUtilities.sol](sherlock-cvg/contracts/utils/CvgUtilities.sol)
- [sherlock-cvg/contracts/utils/SdtUtilities.sol](sherlock-cvg/contracts/utils/SdtUtilities.sol)

