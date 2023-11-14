# GaugeController

## Global description

This contract has been forked from Curve Finance. If more information are needed, please refer to : 
- https://curve.readthedocs.io/dao-gauges.html#gaugecontroller.
- https://etherscan.io/address/0x2F50D538606Fa9EDD2B11E2446BEb18C9D5846bB#code

This contract :

- Is used in Convergence to distribute  the inflation, gauges are associated with staking contract.
- Each gauges can receive votes , and the weekly inflation is redistributed to the Gauges regarding the votes.
- Votes are cast using veCvg.
- veCVG is wrapped into NFT from `LockingPositionManager` and can be obtained : 
  - By locking Cvg in the LockingPositionManager with the correct configuration which gives you a NFT. 
  - By accepting delegation of veCVG of an NFT from his owner.
- veCVG value deployed in gauges is decreasing linearly in time.

## Added / Modified features


### Lock all gauges vote
The purpose of this feature is to lock all the votes.
This feature is used when triggering the distribution of `CvgRewards` to prevent the fact that a user votes between 2 chunks.

#### _is_lock_
Determines if the vote is locked or not

#### _set_lock()_
Lock/unlock the votes.
Only callable by admin.

#### _toggle_locker()_
Grant a contract to use the _set_lock()_ function

### Pause vote for a gauge
A pause can be triggered on a gauge to prevent the vote on it
only the admin can trigger this function.
It's also used when deploying a new gauge to prevent the vote on it before the current cvg cycle is over.
#### _vote_activated_
Mapping  that track the pause state of gauges

####  _toggle_vote_pause()_
Pause or unpause the vote on a gauge

### Kill a gauge 

Remove a gauge from  the `CvgRewards`,so no inflation will be distributed to it. 
That can be used to remove a malicious token.


#### _kill_gauge()_
Block definitively votes on a gauge and set its weight to 0, 
User can still retrieve their vote from  a killed gauge, by voting 0 on it.
Only callable by admin.

### Global 

#### _add_gauge()_
Prevent the addition of a gauge that is not a Staking Contract, _isStakingContract_ 
( that would break our protocol)

#### _vote_for_gauge_weights()_
Has been modified from the original contract :
- Transformed to an internal function that can be called by two externals methods `simple_vote` and `multi_vote`.
- Takes a token ID of a locking position (`LockingPositionManager`) and not an address anymore.
- Is blocked when votes are locked by a Locker (`CvgRewards` and `sdAssetBlackHole` ).
- Can vote on a killed gauge only to retrieve its vote ( by voting 0 on it).
- Cannot vote on a paused gauge.
- Can vote only if the caller owns the tokenId OR has been _veDelegated_ in `LockingPositionDelegate`.
- Cannot vote on a _timelocked_ token, feature provided by `CvgERC721Timelocking`.

ps : [Timelocked explantions](/technical-docs/lock/LockingPositionManager.md) <br/>
ps : [veDelegation explantions](/technical-docs/lock/LockingPositionDelegate.md)

#### _gauge_relative_weight_writes()_
Get gauge weight normalized to 1e18
Also fill all the unfilled values for type and gauge in the historical total weights week-over-week .
this fill is needed for the process reward function, so the gas cost is departed among voters.
#### _get_gauge_weights()_
Get several gauge weights, weighted by the gauge type.

#### _get_gauge_weights_and_types()_
View method that returns the weights and types of all the gauges.

#### _get_nft_datas()_
View method that returns the voting power and details of voting data for a list of tokenId/GaugeAddress.
