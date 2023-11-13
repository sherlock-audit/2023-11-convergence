// SPDX-License-Identifier: MIT
/**
 _____
/  __ \
| /  \/ ___  _ ____   _____ _ __ __ _  ___ _ __   ___ ___
| |    / _ \| '_ \ \ / / _ \ '__/ _` |/ _ \ '_ \ / __/ _ \
| \__/\ (_) | | | \ V /  __/ | | (_| |  __/ | | | (_|  __/
 \____/\___/|_| |_|\_/ \___|_|  \__, |\___|_| |_|\___\___|
                                 __/ |
                                |___/
 */
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "../../libs/Base64.sol";
import "../../interfaces/ICvgControlTower.sol";
import "../../interfaces/ISdtStakingLogo.sol";

contract SdtStakingLogo is Ownable2Step {
    ICvgControlTower public cvgControlTower;

    IERC20 public immutable sdt;

    mapping(string => string) internal tokenLogo; // symbol => logo(svg)

    string public constant DEFAULT_TOKEN_LOGO =
        '<path d="M271.8 186a92.86 92.86 0 1 1-173.46-46.1 93.3 93.3 0 0 1 44.48-39.44 93 93 0 0 1 116.74 39.44 93.54 93.54 0 0 1 4.95 10 92.19 92.19 0 0 1 7.29 36.1Z"/><path d="M284.45 186A105.49 105.49 0 0 1 179 291.51v-12.65a92.9 92.9 0 0 0 85.56-129 93.54 93.54 0 0 0-4.95-10l11-6.32A105 105 0 0 1 284.45 186Z" fill="#ff0"/><path d="M179 278.86v12.65a105.51 105.51 0 0 1-91.61-157.93l11 6.32a93.12 93.12 0 0 0-4.94 82.25A92.75 92.75 0 0 0 179 278.86Z" fill="red"/><path d="m270.52 133.58-11 6.32a92.92 92.92 0 0 0-161.22 0l-11-6.32a105.53 105.53 0 0 1 183.13 0Z" fill="#00f"/><path d="M140.48 147.54v-12.83h12.82v12.83Zm12.82-12.83v-12.83h51.31v12.83Zm25.7 64.13v-25.65h12.83v25.65Zm0 25.65h12.83v25.65H179Zm12.83-51.3v-12.83h12.83v12.83Zm12.83-12.83v-25.65h12.82v25.65Z" fill="#fff"/>';

    constructor(ICvgControlTower _cvgControlTower) {
        cvgControlTower = _cvgControlTower;
        IERC20 _sdt = _cvgControlTower.sdt();
        address _treasuryDao = _cvgControlTower.treasuryDao();
        require(address(_sdt) != address(0), "SDT_ZERO");
        require(_treasuryDao != address(0), "TREASURY_DAO_ZERO");
        sdt = _sdt;
        _transferOwnership(_treasuryDao);
    }

    function getLogoInfo(uint256 tokenId) external view returns (ISdtStakingLogo.LogoInfosFull memory) {
        ISdtStakingLogo.LogoInfos memory _logoInfo = cvgControlTower.sdtStakingPositionManager().logoInfo(tokenId);
        (uint256 _claimableInUsd, uint256 _hoursLock, bool _isLocked, ) = _getLockInfos(_logoInfo);

        return
            ISdtStakingLogo.LogoInfosFull({
                tokenId: _logoInfo.tokenId,
                symbol: _logoInfo.symbol,
                pending: _logoInfo.pending,
                totalStaked: _logoInfo.totalStaked,
                cvgClaimable: _logoInfo.cvgClaimable,
                sdtClaimable: _logoInfo.sdtClaimable,
                unlockingTimestamp: _logoInfo.unlockingTimestamp,
                claimableInUsd: _claimableInUsd,
                isLocked: _isLocked,
                hoursLock: _hoursLock
            });
    }

    function _getLockInfos(
        ISdtStakingLogo.LogoInfos memory logoInfos
    ) internal view returns (uint256, uint256, bool, bool) {
        ICvgOracle _cvgOracle = cvgControlTower.cvgOracle();

        bool isLocked;
        bool erroneousAmount;
        uint256 hoursLock;
        uint256 claimableInUsd = logoInfos.cvgClaimable * _cvgOracle.getCvgPriceOracleUnverified();

        for (uint256 i; i < logoInfos.sdtClaimable.length; ) {
            if (_cvgOracle.getPoolAddressByToken(address(logoInfos.sdtClaimable[i].token)) != address(0)) {
                claimableInUsd +=
                    logoInfos.sdtClaimable[i].amount *
                    _cvgOracle.getPriceOracleUnverified(address(logoInfos.sdtClaimable[i].token));
            } else {
                erroneousAmount = true;
            }

            unchecked {
                ++i;
            }
        }

        if (logoInfos.unlockingTimestamp > block.timestamp) {
            hoursLock = (logoInfos.unlockingTimestamp - block.timestamp) / 3600;
            isLocked = true;
        }

        return (claimableInUsd, hoursLock, isLocked, erroneousAmount);
    }

    function _tokenURI(ISdtStakingLogo.LogoInfos memory logoInfos) external view returns (string memory) {
        (uint256 _claimableInUsd, uint256 _hoursLock, bool _isLocked, bool _erroneousAmount) = _getLockInfos(logoInfos);

        // BASE
        string
            memory output = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000"><path fill="#00f" d="M0 0h800v1000H0z"/><path stroke="#fff" stroke-miterlimit="10" stroke-width="5" d="M26 26h748v948H26z"/><path fill="none" stroke="#fff" stroke-miterlimit="10" stroke-width="5" d="M41 41.3h718V959H41z"/><path fill="#fff" fill-rule="evenodd" d="M717.9 347v43.8L701.7 406H82.1v-59h635.8zm0 203.6v43.8l-16.2 15.2H82.1v-59h635.8zm0 105.5v43.8l-16.2 15.2H82.1v-59h635.8z"/><path fill="#00f" d="m711.1 846.6-27.2 47.5-6.8-11.9 13.6-23.7h-54.3l6.8-11.9h67.9z"/><path fill="#ff0" d="m717.9 858.5-34 59.4-27.1-47.5h13.6l13.5 23.7 27.2-47.5 6.8 11.9z"/><path fill="red" d="m656.8 870.4 27.1 47.5h-13.5l-34-59.4h54.3l-6.8 11.9h-27.1z"/><path fill="none" stroke="#fff" stroke-miterlimit="11.3" stroke-width="2" d="M601 82.4h117.4l-.5 219.6M199 917.9l-116.4.3V766"/><path fill="#fff" fill-rule="evenodd" d="M717.9 448.8v43.8l-16.2 15.2H82.1v-59h635.8z"/><path fill="#fff" d="M117.2 765.9H199v116.5h-81.8z"/><text transform="translate(98.3 388.1)" font-weight="bold" font-size="35" font-family="andale mono, monospace">ID</text><text transform="translate(98.3 591.8)" font-weight="bold" font-size="35" font-family="andale mono, monospace">Balance</text><text transform="translate(98.3 697.3)" font-weight="bold" font-size="35" font-family="andale mono, monospace">Claimable</text><text transform="translate(98.3 490)" font-weight="bold" font-size="35" font-family="andale mono, monospace">Pending</text>';

        // LOGO
        if (bytes(tokenLogo[logoInfos.symbol]).length == 0) {
            output = string(abi.encodePacked(output, DEFAULT_TOKEN_LOGO));
        } else {
            output = string(abi.encodePacked(output, tokenLogo[logoInfos.symbol]));
        }

        // SYMBOL
        output = string(
            abi.encodePacked(
                output,
                '<text x="87%" y="22%" text-anchor="end" font-size="60" fill="#fff" font-family="andale mono, monospace">',
                logoInfos.symbol,
                "</text>"
            )
        );

        // TOKEN ID
        output = string(
            abi.encodePacked(
                output,
                '<text x="87%" y="39%" text-anchor="end" font-size="35" font-family="andale mono, monospace">',
                _toString(logoInfos.tokenId),
                "</text>"
            )
        );

        // PENDING
        output = string(
            abi.encodePacked(
                output,
                '<text x="87%" y="49%" text-anchor="end" font-size="35" font-family="andale mono, monospace">',
                _toString(logoInfos.pending / 10 ** 18),
                "</text>"
            )
        );

        // BALANCE
        output = string(
            abi.encodePacked(
                output,
                '<text x="87%" y="59%" text-anchor="end" font-size="35" font-family="andale mono, monospace">',
                _toString(logoInfos.totalStaked / 10 ** 18),
                "</text>"
            )
        );

        // CLAIMABLE
        output = string(
            abi.encodePacked(
                output,
                '<text x="87%" y="70%" text-anchor="end" font-size="35" font-family="andale mono, monospace">$',
                _toString(_claimableInUsd / 10 ** 36),
                "</text>"
            )
        );

        // RED ICON FOR ERRONEOUS CLAIMABLE AMOUNT
        if (_erroneousAmount) {
            output = string(
                abi.encodePacked(
                    output,
                    '<path d="M15.29,19.82l.13.13v2.11l-.13.13H13.17L13,22.06V20l.13-.13ZM15.18,7.1l.13.13V17.75l-.13.13h-1.9l-.13-.13V7.23l.13-.13Z" fill="red" transform="translate(300 672)"/><path d="M14.23,28.46A14.23,14.23,0,1,1,28.46,14.23,14.25,14.25,0,0,1,14.23,28.46Zm0-26.66A12.43,12.43,0,1,0,26.66,14.23,12.44,12.44,0,0,0,14.23,1.8Z" fill="red" transform="translate(300 672)"/>'
                )
            );
        }

        // LOCK
        if (_isLocked) {
            // PADLOCK CLOSED GREEN
            output = string(
                abi.encodePacked(
                    output,
                    '<path fill="#00FF00" d="M178.26,800.21V790.12h-5V780H163.12v-5H153v5H142.94v10.09h-5v10.09h-5.05v35.32H183.3V800.21ZM163.12,820.4H160.6v5h-5v-5H153v-7.57h10.09Zm5-20.19H148V790.12h5v-5h10.09v5h5Z" />'
                )
            );
            output = string(
                abi.encodePacked(
                    output,
                    '<text x="19.9%" y="87%" text-anchor="middle" font-size="25" font-family="andale mono, monospace">&lt;',
                    _toString(_hoursLock + 1),
                    " h</text></svg>"
                )
            );
        } else {
            // PADLOCK OPEN RED
            output = string(
                abi.encodePacked(
                    output,
                    '<path fill="#FF0000" d="M148,800.21V790.12h5v-5h10.09v5h10.09V780H163.12v-5H153v5H142.94v10.09h-5v10.09h-5.05v35.32H183.3V800.21Zm15.13,20.18H160.6v5.05h-5v-5.05H153v-7.56h10.09Z" />'
                )
            );
            output = string(
                abi.encodePacked(
                    output,
                    '<text x="19.9%" y="87%" text-anchor="middle" font-size="25" font-family="andale mono, monospace">-</text></svg>'
                )
            );
        }

        // METADATA
        string memory json = Base64.encode(
            bytes(
                string(
                    abi.encodePacked(
                        '{"name": "Cvg Staking Position #',
                        _toString(logoInfos.tokenId),
                        '", "description": "Staked Cvg Token", "image": "data:image/svg+xml;base64,',
                        Base64.encode(bytes(output)),
                        '"}'
                    )
                )
            )
        );

        return string(abi.encodePacked("data:application/json;base64,", json));
    }

    function setTokensLogo(string[] memory _symbols, string[] memory _tokensLogo) external onlyOwner {
        uint256 length = _tokensLogo.length;
        require(_symbols.length == length, "LENGTH_MISMATCH");

        for (uint256 i; i < length; ) {
            tokenLogo[_symbols[i]] = _tokensLogo[i];
            unchecked {
                ++i;
            }
        }
    }

    /// @dev Inspired by OraclizeAPI's implementation - MIT license
    /// https://github.com/oraclize/ethereum-api/blob/b42146b063c7d6ee1358846c198246239e9360e8/oraclizeAPI_0.4.25.sol
    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0";
        }
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}
