# @version 0.3.7
"""
@title Cvg-Finance - veCVG
@notice Votes have a weight depending on time, so that users are committed to the future of (whatever they are voting for).
@dev Vote weight decays linearly over time. Lock time cannot be more than `MAXTIME` (1.8 years).
"""

# Adpated fork from: Curve Finance's veCrv
# Many thanks to Curve Finance

# VotingPowerEscow to have time-weighted votes
# Votes have a weight depending on time, so that users are committed
# to the future of (whatever they are voting for).
# The weight in this implementation is linear, and lock cannot be more than maxtime:
# w ^
# 1 +        /
#   |      /
#   |    /
#   |  /
#   |/
# 0 +--------+------> time
#       maxtime (1.8 years?)

struct Point:
    bias: int128
    slope: int128  # - dweight / dt
    ts: uint256
    blk: uint256  # block
# We cannot really do block numbers per se b/c slope is per time, not per block
# and per block could be fairly bad b/c Ethereum changes blocktimes.
# What we can do is to extrapolate ***At functions

struct LockedBalance:
    amount: int128
    end: uint256

interface CvgControlTower:
    def lockingPositionService() -> address: view
    def treasuryDao() -> address:view

DEPOSIT_FOR_TYPE: constant(int128) = 0
CREATE_LOCK_TYPE: constant(int128) = 1
INCREASE_LOCK_AMOUNT: constant(int128) = 2
INCREASE_UNLOCK_TIME: constant(int128) = 3 # to be removed unless we implement the increasing of lock time


event CommitOwnership:
    admin: address

event ApplyOwnership:
    admin: address

event Deposit:
    provider: indexed(uint256)
    value: uint256
    locktime: indexed(uint256)
    type: int128
    ts: uint256

event Withdraw:
    provider: indexed(uint256)
    value: uint256
    ts: uint256

event Supply:
    prevSupply: uint256
    supply: uint256


WEEK: constant(uint256) = 7 * 86400  # all future times are rounded by week
MAXTIME: constant(uint256) = 97 * WEEK  
MULTIPLIER: constant(uint256) = 10 ** 18

cvg_control_tower: public(address)
supply: public(uint256)
locked: public(HashMap[uint256, LockedBalance]) # Locked balance of the NFT

epoch: public(uint256)
point_history: public(Point[100000000000000000000000000000])  # epoch -> unsigned point
nft_point_history: public(HashMap[uint256, Point[1000000000]])  # tokenId -> Point[user_epoch]
nft_point_epoch: public(HashMap[uint256, uint256])
slope_changes: public(HashMap[uint256, int128])  # time -> signed slope change

name: public(String[64])
symbol: public(String[32])
version: public(String[32])
decimals: public(uint256)

admin: public(address)  # Can and will be a smart contract
future_admin: public(address)

initialized: public(bool)

@external
def __init__():
    """
    @notice Contract constructor.
    @dev The contract has an initializer to prevent the take over of the implementation.
    """
    assert self.initialized == False, "ALREADY_INIT" #dev: contract is already initialized
    self.initialized = True

@external
def initialize(_cvg_control_tower: address, _name: String[64], _symbol: String[32], _version: String[32]):
    """
    @notice Contract constructor.
    @param _cvg_control_tower address
    @param _name Token name
    @param _symbol Token symbol
    """
    assert self.initialized == False, "ALREADY_INIT" #dev: contract is already initialized
    self.initialized = True
    self.cvg_control_tower = _cvg_control_tower
    self.point_history[0].blk = block.number
    self.point_history[0].ts = block.timestamp

    self.decimals = 18
    self.name = _name
    self.symbol = _symbol
    self.version = _version

@internal
def assert_locking_service_contract(addr: address):
    """
    @dev Check if the call is the NFT locking service.
    @param addr Address to be checked
    """
    assert addr == CvgControlTower(self.cvg_control_tower).lockingPositionService(), "NOT_LOCKING_SERVICE" # Not the locking service


@external
@view
def get_last_nft_slope(tokenId: uint256) -> int128:
    """
    @notice Get the most recently recorded rate of voting power decrease for `tokenId`.
    @param tokenId NFT token Id
    @return Value of the slope
    """
    token_epoch: uint256 = self.nft_point_epoch[tokenId]
    return self.nft_point_history[tokenId][token_epoch].slope


@external
@view
def nft_point_history_ts(_tokenId: uint256, _idx: uint256) -> uint256:
    """
    @notice Get the timestamp for checkpoint `_idx` for `_tokenId`.
    @param _tokenId NFT token Id
    @param _idx User epoch number
    @return Epoch time of the checkpoint
    """
    return self.nft_point_history[_tokenId][_idx].ts


@external
@view
def locked__end(_tokenId: uint256) -> uint256:
    """
    @notice Get timestamp when `_tokenId`'s lock finishes.
    @param _tokenId NFT token Id
    @return Epoch time of the lock end
    """
    return self.locked[_tokenId].end


@internal
def _checkpoint(tokenId: uint256, old_locked: LockedBalance, new_locked: LockedBalance):
    """
    @dev Record global and per-user data to checkpoint.
    @param tokenId of the NFT that embed the locking position
    @param old_locked Pevious locked amount / end lock time for the user
    @param new_locked New locked amount / end lock time for the user
    """
    tokenId_old: Point = empty(Point)
    tokenId_new: Point = empty(Point)
    old_dslope: int128 = 0
    new_dslope: int128 = 0
    _epoch: uint256 = self.epoch

    if tokenId != 0:
        # Calculate slopes and biases
        # Kept at zero when they have to
        if old_locked.end > block.timestamp and old_locked.amount > 0:
            tokenId_old.slope = old_locked.amount / convert(MAXTIME, int128)
            tokenId_old.bias = tokenId_old.slope * convert(old_locked.end - block.timestamp, int128)
        if new_locked.end > block.timestamp and new_locked.amount > 0:
            tokenId_new.slope = new_locked.amount / convert(MAXTIME, int128)
            tokenId_new.bias = tokenId_new.slope * convert(new_locked.end - block.timestamp, int128)

        # Read values of scheduled changes in the slope
        # old_locked.end can be in the past and in the future
        # new_locked.end can ONLY by in the FUTURE unless everything expired: than zeros
        old_dslope = self.slope_changes[old_locked.end]
        if new_locked.end != 0:
            if new_locked.end == old_locked.end:
                new_dslope = old_dslope
            else:
                new_dslope = self.slope_changes[new_locked.end]

    last_point: Point = Point({bias: 0, slope: 0, ts: block.timestamp, blk: block.number})
    if _epoch > 0:
        last_point = self.point_history[_epoch]
    last_checkpoint: uint256 = last_point.ts
    # initial_last_point is used for extrapolation to calculate block number
    # (approximately, for *At methods) and save them
    # as we cannot figure that out exactly from inside the contract
    initial_last_point: Point = last_point
    block_slope: uint256 = 0  # dblock/dt
    if block.timestamp > last_point.ts:
        block_slope = MULTIPLIER * (block.number - last_point.blk) / (block.timestamp - last_point.ts)
    # If last point is already recorded in this block, slope=0
    # But that's ok b/c we know the block in such case

    # Go over weeks to fill history and calculate what the current point is
    t_i: uint256 = (last_checkpoint / WEEK) * WEEK
    for i in range(255):
        # Hopefully it won't happen that this won't get used in 5 years!
        # If it does, users will be able to withdraw but vote weight will be broken
        t_i += WEEK
        d_slope: int128 = 0
        if t_i > block.timestamp:
            t_i = block.timestamp
        else:
            d_slope = self.slope_changes[t_i]
        last_point.bias -= last_point.slope * convert(t_i - last_checkpoint, int128)
        last_point.slope += d_slope
        if last_point.bias < 0:  # This can happen
            last_point.bias = 0
        if last_point.slope < 0:  # This cannot happen - just in case
            last_point.slope = 0
        last_checkpoint = t_i
        last_point.ts = t_i
        last_point.blk = initial_last_point.blk + block_slope * (t_i - initial_last_point.ts) / MULTIPLIER
        _epoch += 1
        if t_i == block.timestamp:
            last_point.blk = block.number
            break
        else:
            self.point_history[_epoch] = last_point

    self.epoch = _epoch
    # Now point_history is filled until t=now
    if tokenId != 0:
        # If last point was in this block, the slope change has been applied already
        # But in such case we have 0 slope(s)
        last_point.slope += (tokenId_new.slope - tokenId_old.slope)
        last_point.bias += (tokenId_new.bias - tokenId_old.bias)
        if last_point.slope < 0:
            last_point.slope = 0
        if last_point.bias < 0:
            last_point.bias = 0

    # Record the changed point into history
    self.point_history[_epoch] = last_point

    if tokenId != 0:
        # Schedule the slope changes (slope is going down)
        # We subtract new_tokeId_slope from [new_locked.end]
        # and tokenId old_tokenId_slope to [old_locked.end]
        if old_locked.end > block.timestamp:
            # old_dslope was <something> - tokenId_old.slope, so we cancel that
            old_dslope += tokenId_old.slope
            if new_locked.end == old_locked.end:
                old_dslope -= tokenId_new.slope  # It was a new deposit, not extension
            self.slope_changes[old_locked.end] = old_dslope

        if new_locked.end > block.timestamp:
            if new_locked.end > old_locked.end:
                new_dslope -= tokenId_new.slope  # old slope disappeared at this point
                self.slope_changes[new_locked.end] = new_dslope
            # else: we recorded it already in old_dslope

        # Now handle user history
        nft_epoch: uint256 = self.nft_point_epoch[tokenId] + 1

        self.nft_point_epoch[tokenId] = nft_epoch
        tokenId_new.ts = block.timestamp
        tokenId_new.blk = block.number
        self.nft_point_history[tokenId][nft_epoch] = tokenId_new


@internal
def _deposit_for(_tokenId: uint256, _value: uint256, unlock_time: uint256, locked_balance: LockedBalance, type: int128):
    """
    @dev Deposit and lock tokens for a user.
    @param _tokenId of the NFT
    @param _value Amount to deposit
    @param unlock_time New time when to unlock the tokens, or 0 if unchanged
    @param locked_balance Previous locked amount / timestamp
    """
    _locked: LockedBalance = locked_balance
    supply_before: uint256 = self.supply

    self.supply = supply_before + _value
    old_locked: LockedBalance = _locked
    # Adding to existing lock, or if a lock is expired - creating a new one
    _locked.amount += convert(_value, int128)
    if unlock_time != 0:
        _locked.end = unlock_time
    self.locked[_tokenId] = _locked

    # Possibilities:
    # Both old_locked.end could be current or expired (>/< block.timestamp)
    # value == 0 (extend lock) or value > 0 (add to lock or extend lock)
    # _locked.end > block.timestamp (always)
    self._checkpoint(_tokenId, old_locked, _locked)

    log Deposit(_tokenId, _value, _locked.end, type, block.timestamp)
    log Supply(supply_before, supply_before + _value)


@external
def checkpoint():
    """
    @notice Record global data to checkpoint.
    """
    self._checkpoint(0, empty(LockedBalance), empty(LockedBalance))

@external
@nonreentrant('lock')
def create_lock(_tokenId: uint256, _value: uint256, _unlock_time: uint256):
    """
    @notice Deposit `_value` tokens for `msg.sender` and lock until `_unlock_time`.
    @param _value Amount to deposit
    @param _unlock_time Epoch time when tokens unlock, rounded down to whole weeks
    """
    self.assert_locking_service_contract(msg.sender)
    unlock_time: uint256 = (_unlock_time / WEEK) * WEEK  # Locktime is rounded down to weeks
    _locked: LockedBalance = self.locked[_tokenId]

    assert _value > 0  # dev: need non-zero value
    assert _locked.amount == 0, "Withdraw old tokens first"
    assert unlock_time > block.timestamp, "Can only lock until time in the future"
    assert unlock_time <= block.timestamp + MAXTIME, "Voting lock can be 1.8 years max" # 1 week buffer to take in account the time we can take after 1 week to update the cycle

    self._deposit_for(_tokenId, _value, unlock_time, _locked, CREATE_LOCK_TYPE)


@external
@nonreentrant('lock')
def increase_amount(_tokenId: uint256, _value: uint256):
    """
    @notice Deposit `_value` additional tokens for `msg.sender`.
            without modifying the unlock time
    @param _value Amount of tokens to deposit and add to the lock
    """
    self.assert_locking_service_contract(msg.sender)
    _locked: LockedBalance = self.locked[_tokenId]

    assert _value > 0  # dev: need non-zero value
    assert _locked.amount > 0, "No existing lock found"
    assert _locked.end > block.timestamp, "Cannot add to expired lock. Withdraw"

    self._deposit_for(_tokenId, _value, 0, _locked, INCREASE_LOCK_AMOUNT)

@external
@nonreentrant('lock')
def increase_unlock_time(_tokenId: uint256, _unlock_time: uint256):
    """
    @notice Extend the unlock time for `msg.sender` to `_unlock_time`.
    @param _unlock_time New epoch time for unlocking
    """
    self.assert_locking_service_contract(msg.sender)
    _locked: LockedBalance = self.locked[_tokenId]
    unlock_time: uint256 = (_unlock_time / WEEK) * WEEK  # Locktime is rounded down to weeks

    assert _locked.end > block.timestamp, "Lock expired"
    assert _locked.amount > 0, "Nothing is locked"
    assert unlock_time > _locked.end, "Can only increase lock duration"
    assert unlock_time <= block.timestamp + MAXTIME, "Voting lock can be 1.8 years max" # 1 week buffer to take in account the time we can take after 1 week to update the cycle

    self._deposit_for(_tokenId, 0, unlock_time, _locked, INCREASE_UNLOCK_TIME)

@external
@nonreentrant('lock')
def increase_unlock_time_and_amount(_tokenId: uint256, _unlock_time: uint256, _value: uint256):
    """
    @notice Extend the unlock time for `msg.sender` to `_unlock_time` and then the amount of Locked CVG
    @param _unlock_time New epoch time for unlocking
    @param _value Amount of CVG to add in the lock
    """
    self.assert_locking_service_contract(msg.sender)
    _locked: LockedBalance = self.locked[_tokenId]
    unlock_time: uint256 = (_unlock_time / WEEK) * WEEK  # Locktime is rounded down to weeks

    assert _value > 0  # dev: need non-zero value
    assert _locked.end > block.timestamp, "Lock expired"
    assert _locked.amount > 0, "Nothing is locked"
    assert unlock_time > _locked.end, "Can only increase lock duration"
    assert unlock_time <= block.timestamp + MAXTIME, "Voting lock can be 1.8 years max" # 1 week buffer to take in account the time we can take after 1 week to update the cycle

    self._deposit_for(_tokenId, 0, unlock_time, _locked, INCREASE_UNLOCK_TIME)
    self._deposit_for(_tokenId, _value, 0, self.locked[_tokenId], INCREASE_LOCK_AMOUNT)

@external
@nonreentrant('lock')
def withdraw(_tokenId: uint256):
    """
    @notice Withdraw all tokens for `msg.sender`.
    @dev Only possible if the lock has expired.
    """
    self.assert_locking_service_contract(msg.sender)
    _locked: LockedBalance = self.locked[_tokenId]
    assert block.timestamp >= _locked.end, "The lock didn't expire"
    value: uint256 = convert(_locked.amount, uint256)

    old_locked: LockedBalance = _locked
    _locked.end = 0
    _locked.amount = 0
    self.locked[_tokenId] = _locked
    supply_before: uint256 = self.supply
    self.supply = supply_before - value

    # old_locked can have either expired <= timestamp or zero end
    # _locked has only 0 end
    # Both can have >= 0 amount
    self._checkpoint(_tokenId, old_locked, _locked)

    log Withdraw(_tokenId, value, block.timestamp)
    log Supply(supply_before, supply_before - value)


# The following ERC20/minime-compatible methods are not real balanceOf and supply!
# They measure the weights for the purpose of voting, so they don't represent
# real coins.

@internal
@view
def find_block_epoch(_block: uint256, max_epoch: uint256) -> uint256:
    """
    @dev Binary search to estimate timestamp for block number.
    @param _block Block to find
    @param max_epoch Don't go beyond this epoch
    @return Approximate timestamp for block
    """
    # Binary search
    _min: uint256 = 0
    _max: uint256 = max_epoch
    for i in range(128):  # Will be always enough for 128-bit numbers
        if _min >= _max:
            break
        _mid: uint256 = (_min + _max + 1) / 2
        if self.point_history[_mid].blk <= _block:
            _min = _mid
        else:
            _max = _mid - 1
    return _min


@external
@view
def balanceOf(_tokenId: uint256) -> uint256:
    """
    @notice Get the current voting power for the tokenId of the NFT collection `LockingPositionManager`.
    @dev Adheres to the ERC20 `balanceOf` interface for Aragon compatibility.
    @param _tokenId of the NFT
    @return User voting power
    """
    _epoch: uint256 = self.nft_point_epoch[_tokenId]
    if _epoch == 0:
        return 0
    else:
        last_point: Point = self.nft_point_history[_tokenId][_epoch]
        last_point.bias -= last_point.slope * convert(block.timestamp - last_point.ts, int128)
        if last_point.bias < 0:
            last_point.bias = 0
        return convert(last_point.bias, uint256)


@external
@view
def balanceOfAt(_tokenId: uint256, _block: uint256) -> uint256:
    """
    @notice Measure voting power of `_tokenId` at block height `_block`.
    @dev Adheres to MiniMe `balanceOfAt` interface: https://github.com/Giveth/minime.
    @param _tokenId of the NFT
    @param _block Block to calculate the voting power at
    @return Voting power
    """
    # Copying and pasting totalSupply code because Vyper cannot pass by
    # reference yet
    assert _block <= block.number

    # Binary search
    _min: uint256 = 0
    _max: uint256 = self.nft_point_epoch[_tokenId]
    for i in range(128):  # Will be always enough for 128-bit numbers
        if _min >= _max:
            break
        _mid: uint256 = (_min + _max + 1) / 2
        if self.nft_point_history[_tokenId][_mid].blk <= _block:
            _min = _mid
        else:
            _max = _mid - 1

    upoint: Point = self.nft_point_history[_tokenId][_min]

    max_epoch: uint256 = self.epoch
    _epoch: uint256 = self.find_block_epoch(_block, max_epoch)
    point_0: Point = self.point_history[_epoch]
    d_block: uint256 = 0
    d_t: uint256 = 0
    if _epoch < max_epoch:
        point_1: Point = self.point_history[_epoch + 1]
        d_block = point_1.blk - point_0.blk
        d_t = point_1.ts - point_0.ts
    else:
        d_block = block.number - point_0.blk
        d_t = block.timestamp - point_0.ts
    block_time: uint256 = point_0.ts
    if d_block != 0:
        block_time += d_t * (_block - point_0.blk) / d_block

    upoint.bias -= upoint.slope * convert(block_time - upoint.ts, int128)
    if upoint.bias >= 0:
        return convert(upoint.bias, uint256)
    else:
        return 0


@internal
@view
def supply_at(point: Point, t: uint256) -> uint256:
    """
    @dev Calculate total voting power at some point in the past.
    @param point The point (bias/slope) to start search from
    @param t Time to calculate the total voting power at
    @return Total voting power at that time
    """
    last_point: Point = point
    t_i: uint256 = (last_point.ts / WEEK) * WEEK
    for i in range(255):
        t_i += WEEK
        d_slope: int128 = 0
        if t_i > t:
            t_i = t
        else:
            d_slope = self.slope_changes[t_i]
        last_point.bias -= last_point.slope * convert(t_i - last_point.ts, int128)
        if t_i == t:
            break
        last_point.slope += d_slope
        last_point.ts = t_i

    if last_point.bias < 0:
        last_point.bias = 0
    return convert(last_point.bias, uint256)


@external
@view
def total_supply() -> uint256:
    """
    @notice Calculate total voting power.
    @dev Adheres to the ERC20 `totalSupply` interface for Aragon compatibility.
    @return Total voting power
    """
    _epoch: uint256 = self.epoch
    last_point: Point = self.point_history[_epoch]
    return self.supply_at(last_point, block.timestamp)


@external
@view
def totalSupplyAt(_block: uint256) -> uint256:
    """
    @notice Calculate total voting power at some point in the past.
    @param _block Block to calculate the total voting power at
    @return Total voting power at `_block`
    """
    assert _block <= block.number
    _epoch: uint256 = self.epoch
    target_epoch: uint256 = self.find_block_epoch(_block, _epoch)

    point: Point = self.point_history[target_epoch]
    dt: uint256 = 0
    if target_epoch < _epoch:
        point_next: Point = self.point_history[target_epoch + 1]
        if point.blk != point_next.blk:
            dt = (_block - point.blk) * (point_next.ts - point.ts) / (point_next.blk - point.blk)
    else:
        if point.blk != block.number:
            dt = (_block - point.blk) * (block.timestamp - point.ts) / (block.number - point.blk)
    # Now dt contains info on how far are we beyond point

    return self.supply_at(point, point.ts + dt)