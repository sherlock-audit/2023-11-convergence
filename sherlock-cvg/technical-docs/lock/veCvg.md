# veCvg

## Global description

This contract has been forked from Curve Finance. If more information are needed, please refers to https://curve.readthedocs.io/dao-vecrv.html.

In our case, veCvg is used to :

- Vote on **GaugeController** to direct $CVG inflation into Staking contracts.
- Vote on **Snapshot** to govern the protocol through improvement proposals.

This contract can :

- Compute the amount of **veCvg** linked to a Locking position created by the `LockingPositionManager` & `LockingPositionService`.
- This amount in **veCvg** decreases linearly in the time to 0 on the end of the locking.

What we changed :

| Before                                              | Now                                                       |
| --------------------------------------------------- | --------------------------------------------------------- |
| Position not sendable ( linked to a wallet address) | Position sendable ( linked to an NFT)                     |
| Lock function callable by users                     | Lock function callable by the LockingPositionService only |
| Lock time maximum was 4 years                       | Locking maximum is 96 entire weeks ( almost 2 years )      |
| Locked CRV tokens are sent to the veCVG             | Locked CVG are sent to the LockingPositionService         |
| No function increase time & amount in one single tx | Function increase_unlock_time_and_amount                  |
