# LockingPositionManager

## Global description

This contract is  an NFT contract representing  a locking position of CVG.
The main function of this contract are not callable directly , they must be called 
throw the `LockingPositionService` contract.

## Features of the NFT

### Timelock
This feature is provided by the `CvgERC721TimeLockingUpgradeable` contract heritage, which makes the token non-manipulable for a certain period of time.
These tokens can be exchanged and sold on NFT marketplace , to assure the buyer that no harmful action can be performed by front-runners just before the purchase of the NFT.

example :
if an NFT is sold on the marketplace, the seller can front-run the buyer and claim the rewards associated with the token just before purchase.
A detrimental action by the buyer cannot be carried out on a time-locked NFT.


### Enumerable 
This feature is provided by the `CvgERC721TimeLockingUpgradeable` contract heritage,
which can make possible to retrieve all the position  for an address via the `getTokenIdsForWallet` method.

### URi representation
The method  for `baseURI` and `tokenURI` are standard to open zeppelin ERC721 implementation.

### Mint & Burn 
hey must be called throw the `LockingPositionService` contract.<br/>
[more info](/technical-docs/lock/LockingPositionService.md)

### logoInfo
A SVG representation of the position is available via the `logoInfo` method and the `LockingLogo` contract.

### Compliance info 
This method is used by other contract , in order to determine if the token can be manipulated or not.