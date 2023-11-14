// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../libs/Base64.sol";
import "../interfaces/ICvgControlTower.sol";

contract LockingLogo {
    /// @dev cvg control tower address
    ICvgControlTower internal cvgControlTower;

    /// @dev constants to define gauge data in SVG
    uint256 internal constant GAUGE_X_REFERENCE = 260;
    uint256 internal constant GAUGE_WIDTH = 449;

    /// @dev constant to define the number of TDE to check to calculate claimable amount for token
    uint256 internal constant CLAIMABLE_REWARDS_TDE_NUMBER = 2;

    /// @dev gauge ysPercentage => GaugePosition
    mapping(uint256 => ILockingLogo.GaugePosition) internal gaugePositions;

    struct ClaimableData {
        address token;
        uint256 tokenPrice;
    }

    constructor(ICvgControlTower _cvgControlTower) {
        cvgControlTower = _cvgControlTower;

        /// @dev define gauge positions according to token's ysPercentage
        gaugePositions[10] = ILockingLogo.GaugePosition({ysWidth: 45, veWidth: 404});
        gaugePositions[20] = ILockingLogo.GaugePosition({ysWidth: 90, veWidth: 359});
        gaugePositions[30] = ILockingLogo.GaugePosition({ysWidth: 135, veWidth: 314});
        gaugePositions[40] = ILockingLogo.GaugePosition({ysWidth: 180, veWidth: 269});
        gaugePositions[50] = ILockingLogo.GaugePosition({ysWidth: 225, veWidth: 224});
        gaugePositions[60] = ILockingLogo.GaugePosition({ysWidth: 270, veWidth: 179});
        gaugePositions[70] = ILockingLogo.GaugePosition({ysWidth: 315, veWidth: 134});
        gaugePositions[80] = ILockingLogo.GaugePosition({ysWidth: 359, veWidth: 90});
        gaugePositions[90] = ILockingLogo.GaugePosition({ysWidth: 404, veWidth: 45});
    }

    /// @dev Inspired by OraclizeAPI's implementation - MIT license
    ///      https://github.com/oraclize/ethereum-api/blob/b42146b063c7d6ee1358846c198246239e9360e8/oraclizeAPI_0.4.25.sol
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

    /**
     *  @notice Finds the index of the _token in the _claimableData array
     *  @param _token address of the token to look up in the array
     *  @param _claimableData array containing token address and current price
     *  @param _arrayLength actual length of the _claimableData array
     */
    function findIndex(
        address _token,
        ClaimableData[] memory _claimableData,
        uint256 _arrayLength
    ) internal pure returns (uint256) {
        for (uint256 i; i < _arrayLength; ) {
            if (_claimableData[i].token == _token) {
                return i;
            }

            unchecked {
                ++i;
            }
        }

        return 999;
    }

    /**
     *  @notice Get actual token share based on TDE
     *  @param _cvgControlTower control tower address
     *  @param _tokenId token id
     *  @param _lockEnd lock end of the token
     *  @param _cvgCycle actual cvg cycle
     *  @param _tdeId TDE id
     *  @param _tdeDuration duration of a TDE
     */
    function getTokenShare(
        ICvgControlTower _cvgControlTower,
        uint256 _tokenId,
        uint256 _lockEnd,
        uint256 _cvgCycle,
        uint256 _tdeId,
        uint256 _tdeDuration
    ) internal view returns (uint256) {
        uint256 claimCycle = _tdeId * _tdeDuration;
        if (
            _lockEnd < claimCycle ||
            _cvgCycle < claimCycle ||
            _cvgControlTower.ysDistributor().rewardsClaimedForToken(_tokenId, _tdeId)
        ) return 0;
        uint256 ysCvgSupply = _cvgControlTower.lockingPositionService().totalSupplyYsCvgHistories(claimCycle);
        if (ysCvgSupply == 0) return 0;

        return
            (_cvgControlTower.lockingPositionService().balanceOfYsCvgAt(_tokenId, claimCycle) * 10 ** 20) / ysCvgSupply;
    }

    /**
     *  @notice Calculates the claimable amount in USD for a specified token
     *  @param _tokenId token id
     *  @param _lockEnd token lock end
     *  @param _cvgCycle actual cvgCycle
     */
    function _getClaimableAmountInUsd(
        uint256 _tokenId,
        uint256 _lockEnd,
        uint256 _cvgCycle
    ) internal view returns (uint256) {
        uint256 claimableUsdAmount;
        ICvgControlTower _cvgControlTower = cvgControlTower;
        ICvgOracle _cvgOracle = _cvgControlTower.cvgOracle();
        uint256 tdeDuration = _cvgControlTower.lockingPositionService().TDE_DURATION();

        uint256 currentTdeId = _cvgCycle / tdeDuration;
        uint256 lastTde = currentTdeId > CLAIMABLE_REWARDS_TDE_NUMBER ? currentTdeId - CLAIMABLE_REWARDS_TDE_NUMBER : 1;

        uint256 claimableDataLength;
        ClaimableData[] memory claimableData = new ClaimableData[](15);
        for (; currentTdeId >= lastTde; currentTdeId--) {
            uint256 tokenShare = getTokenShare(
                _cvgControlTower,
                _tokenId,
                _lockEnd,
                _cvgCycle,
                currentTdeId,
                tdeDuration
            );
            if (tokenShare == 0) continue;

            address[] memory tokens = _cvgControlTower.ysDistributor().getTokensDepositedAtTde(currentTdeId);
            for (uint256 i; i < tokens.length; ) {
                uint256 amountUser = _cvgControlTower.ysDistributor().getTokenRewardAmountForTde(
                    IERC20(tokens[i]),
                    currentTdeId,
                    tokenShare
                );
                uint256 tokenIndex = findIndex(tokens[i], claimableData, claimableDataLength);

                /// @dev index of 999 is equivalent to not found in array
                if (tokenIndex == 999) {
                    uint256 price = _cvgOracle.getPriceOracleUnverified(tokens[i]);
                    claimableData[claimableDataLength] = ClaimableData({token: tokens[i], tokenPrice: price});

                    claimableUsdAmount += amountUser * claimableData[claimableDataLength].tokenPrice;
                    unchecked {
                        ++claimableDataLength;
                    }
                } else {
                    claimableUsdAmount += amountUser * claimableData[tokenIndex].tokenPrice;
                }

                unchecked {
                    ++i;
                }
            }
        }

        return claimableUsdAmount;
    }

    function _getLockInfo(
        ILockingLogo.LogoInfos memory _logoInfos
    )
        internal
        view
        returns (
            uint256 cvgLockedInUsd,
            uint256 ysCvg,
            uint256 veCvg,
            ILockingLogo.GaugePosition memory gaugePosition,
            uint256 claimableInUsd,
            bool isLocked,
            uint256 hoursLock
        )
    {
        ICvgOracle _cvgOracle = cvgControlTower.cvgOracle();
        cvgLockedInUsd = _logoInfos.cvgLocked * _cvgOracle.getCvgPriceOracleUnverified();

        claimableInUsd = _getClaimableAmountInUsd(_logoInfos.tokenId, _logoInfos.lockEnd, cvgControlTower.cvgCycle());

        if (_logoInfos.unlockingTimestamp > block.timestamp) {
            hoursLock = (_logoInfos.unlockingTimestamp - block.timestamp) / 3600;
            isLocked = true;
        }

        (ysCvg, veCvg) = (
            cvgControlTower.lockingPositionService().balanceOfYsCvgAt(_logoInfos.tokenId, cvgControlTower.cvgCycle()),
            cvgControlTower.votingPowerEscrow().balanceOf(_logoInfos.tokenId)
        );

        gaugePosition = gaugePositions[_logoInfos.ysPercentage];
    }

    function getLogoInfo(uint256 tokenId) external view returns (ILockingLogo.LogoInfosFull memory) {
        ILockingLogo.LogoInfos memory _logoInfo = cvgControlTower.lockingPositionManager().logoInfo(tokenId);
        (
            uint256 cvgLockedInUsd,
            uint256 ysCvg,
            uint256 veCvg,
            ILockingLogo.GaugePosition memory gaugePosition,
            uint256 claimableInUsd,
            bool isLocked,
            uint256 hoursLock
        ) = _getLockInfo(_logoInfo);

        return (
            ILockingLogo.LogoInfosFull({
                tokenId: _logoInfo.tokenId,
                cvgLocked: _logoInfo.cvgLocked,
                lockEnd: _logoInfo.lockEnd,
                ysPercentage: _logoInfo.ysPercentage,
                mgCvg: _logoInfo.mgCvg,
                unlockingTimestamp: _logoInfo.unlockingTimestamp,
                cvgLockedInUsd: cvgLockedInUsd,
                ysCvg: ysCvg,
                veCvg: veCvg,
                gaugePosition: gaugePosition,
                claimableInUsd: claimableInUsd,
                isLocked: isLocked,
                hoursLock: hoursLock
            })
        );
    }

    function _tokenURI(ILockingLogo.LogoInfos calldata _logoInfos) external view returns (string memory output) {
        (
            uint256 cvgLockedInUsd,
            uint256 ysCvg,
            uint256 veCvg,
            ILockingLogo.GaugePosition memory gaugePosition,
            uint256 claimableInUsd,
            bool isLocked,
            uint256 hoursLock
        ) = _getLockInfo(_logoInfos);

        output = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1404.99"><path fill="#00f" d="M0 0h800v1404.99H0z"/><path stroke="#fff" stroke-miterlimit="10" stroke-width="5" d="M26 26.01h748v1352.98H26z"/><path fill="none" stroke="#fff" stroke-miterlimit="10" stroke-width="5" d="M41 41.33h718v1322.66H41z"/><path fill="#00f" d="m711.1 1251.57-27.17 47.54-6.79-11.88 13.58-23.78h-54.33l6.79-11.88h67.92z"/><path fill="#ff0" d="m717.89 1263.45-33.96 59.43-27.17-47.54h13.59l13.58 23.77 27.17-47.54 6.79 11.88z"/><path fill="red" d="m656.76 1275.34 27.17 47.54h-13.58l-33.96-59.43h54.33l-6.79 11.89h-27.17z"/><path fill="none" stroke="#fff" stroke-miterlimit="11.34" stroke-width="2" d="M601 78.99h117.39l-.5 219.56M199 1322.85l-116.89.38V1175.7"/><path fill="#fff" d="M116.96 1175.7h81.85v116.45h-81.85z"/><path fill="#00f" d="m269.35 111.99-66.59 116.54-16.65-29.14 33.3-58.27H86.22l16.65-29.13h166.48z"/><path fill="#ff0" d="M286 141.12 202.76 286.8l-66.59-116.54h33.29l33.3 58.27 66.59-116.54L286 141.12z"/><path fill="red" d="m136.17 170.26 66.59 116.54h-33.3L86.22 141.12h133.19l-16.65 29.14h-66.59z"/><path fill="#fff" fill-rule="evenodd" d="M717.89 536.4v43.8l-16.22 15.2H82.11v-59h635.78zm0 414.64v43.8l-16.22 15.2H82.11v-59h635.78zm0 105.5v43.8l-16.22 15.2H82.11v-59h635.78zm0-207.32v43.8l-16.22 15.2H82.11v-59h635.78zm0-414.64v43.8l-16.22 15.2H82.11v-59h635.78zm0 203.64v43.8l-16.22 15.2H82.11v-59h635.78zm0 105.5v43.8l-16.22 15.2H82.11v-59h635.78z"/><path d="M716.89 336.18v49H253.8v-49h463.09m5-5H248.8v59h473.09v-59Z" fill="#fff"/><path fill="#fff" fill-rule="evenodd" d="M227 331.19v43.8l-16.22 15.2H82.11v-59H227z"/><text transform="translate(408.56 212.43)" font-size="60" fill="#fff" font-family="andale mono, monospace" font-weight="bold">Lock</text><text transform="translate(103.48 370.47)" font-size="35" font-family="andale mono, monospace" font-weight="bold">ys/ve</text><text transform="translate(98.36 475.73)" font-size="35" font-family="andale mono, monospace" font-weight="bold">ID</text><text transform="translate(98.36 577.55)" font-size="35" font-family="andale mono, monospace" font-weight="bold">CVG Locked</text><text transform="translate(98.36 679.37)" font-size="35" font-family="andale mono, monospace" font-weight="bold">Lock end</text><text transform="translate(98.36 784.87)" font-size="35" font-family="andale mono, monospace" font-weight="bold">ysCVG</text><text transform="translate(98.36 890.37)" font-size="35" font-family="andale mono, monospace" font-weight="bold">veCVG</text><text transform="translate(98.36 992.18)" font-size="35" font-family="andale mono, monospace" font-weight="bold">mgCVG</text><text transform="translate(98.36 1097.68)" font-size="35" font-family="andale mono, monospace" font-weight="bold">Claimable</text>';

        if (_logoInfos.ysPercentage == 0) {
            output = string(
                abi.encodePacked(
                    output,
                    '<rect x="',
                    _toString(GAUGE_X_REFERENCE),
                    '" y="341.99" width="',
                    _toString(GAUGE_WIDTH),
                    '" height="37.33" fill="#ff0"/>'
                )
            );

            output = string(
                abi.encodePacked(
                    output,
                    '<text x="484.5" y="26.3%" text-anchor="middle" font-size="22" fill="#1d1d1b" font-family="andale mono, monospace">100%</text>'
                )
            );
        } else if (_logoInfos.ysPercentage == 100) {
            output = string(
                abi.encodePacked(
                    output,
                    '<rect x="',
                    _toString(GAUGE_X_REFERENCE),
                    '" y="341.99" width="',
                    _toString(GAUGE_WIDTH),
                    '" height="37.33" fill="blue"/>'
                )
            );

            output = string(
                abi.encodePacked(
                    output,
                    '<text x="484.5" y="26.3%" text-anchor="middle" font-size="22" fill="#fff" font-family="andale mono, monospace">100%</text>'
                )
            );
        } else {
            output = string(
                abi.encodePacked(
                    output,
                    '<rect x="',
                    _toString(GAUGE_X_REFERENCE),
                    '" y="341.99" width="',
                    _toString(gaugePosition.ysWidth),
                    '" height="37.33" fill="blue"/>',
                    '<rect x="',
                    _toString(GAUGE_X_REFERENCE + gaugePosition.ysWidth),
                    '" y="341.99" width="',
                    _toString(gaugePosition.veWidth),
                    '" height="37.33" fill="#ff0"/>'
                )
            );

            uint256 ysTextX = GAUGE_X_REFERENCE + (gaugePosition.ysWidth / 2);
            uint256 veTextX = GAUGE_X_REFERENCE + gaugePosition.ysWidth + (gaugePosition.veWidth / 2);
            output = string(
                abi.encodePacked(
                    output,
                    '<text x="',
                    _toString(ysTextX),
                    '" y="26.3%" text-anchor="middle" font-size="22" fill="#fff" font-family="andale mono, monospace">',
                    _toString(_logoInfos.ysPercentage),
                    "%</text>",
                    '<text x="',
                    _toString(veTextX),
                    '" y="26.3%" text-anchor="middle" font-size="22" fill="#1d1d1b" font-family="andale mono, monospace">',
                    _toString(100 - _logoInfos.ysPercentage),
                    "%</text>"
                )
            );
        }

        output = string(
            abi.encodePacked(
                output,
                '<text x="87%" y="34%" text-anchor="end" font-size="35" font-family="andale mono, monospace">',
                _toString(_logoInfos.tokenId),
                "</text>"
            )
        );
        output = string(
            abi.encodePacked(
                output,
                '<text x="87%" y="41.3%" text-anchor="end" font-size="35" font-family="andale mono, monospace">',
                _toString(_logoInfos.cvgLocked / 10 ** 18),
                " ($",
                _toString(cvgLockedInUsd / 10 ** 36),
                ")</text>"
            )
        );
        output = string(
            abi.encodePacked(
                output,
                '<text x="87%" y="48.4%" text-anchor="end" font-size="35" font-family="andale mono, monospace">cvgCycle ',
                _toString(_logoInfos.lockEnd),
                "</text>"
            )
        );
        output = string(
            abi.encodePacked(
                output,
                '<text x="87%" y="56%" text-anchor="end" font-size="35" font-family="andale mono, monospace">',
                _toString(ysCvg / 10 ** 18),
                "</text>"
            )
        );
        output = string(
            abi.encodePacked(
                output,
                '<text x="87%" y="63.4%" text-anchor="end" font-size="35" font-family="andale mono, monospace">',
                _toString(veCvg / 10 ** 18),
                "</text>"
            )
        );
        output = string(
            abi.encodePacked(
                output,
                '<text x="87%" y="70.8%" text-anchor="end" font-size="35" font-family="andale mono, monospace">',
                _toString(_logoInfos.mgCvg / 10 ** 18),
                "</text>"
            )
        );
        output = string(
            abi.encodePacked(
                output,
                '<text x="87%" y="78.2%" text-anchor="end" font-size="35" font-family="andale mono, monospace">$',
                _toString(claimableInUsd / 10 ** 36),
                "</text>"
            )
        );
        //LOCK
        if (isLocked) {
            //PADLOCK CLOSED GREEN
            output = string(
                abi.encodePacked(
                    output,
                    '<path fill="#00FF00" d="M178.07 1209.99v-10.1h-5v-10.09h-10.14v-5h-10.09v5h-10.09v10.09h-5v10.1h-5.05v35.31h50.45v-35.31Zm-15.14 20.18h-2.52v5h-5v-5h-2.53v-7.57h10.09Zm5-20.18H147.8v-10.1h5v-5h10.09v5h5Z" />'
                )
            );
            output = string(
                abi.encodePacked(
                    output,
                    '<text x="19.9%" y="91%" text-anchor="middle" font-size="23" font-family="andale mono, monospace">&lt;',
                    _toString(hoursLock + 1),
                    " h</text></svg>"
                )
            );
        } else {
            //PADLOCK OPEN RED
            output = string(
                abi.encodePacked(
                    output,
                    '<path fill="#FF0000" d="M147.8,1212v-10.09h5v-5h10.09v5H173v-10.09H162.93v-5H152.84v5H142.75v10.09h-5V1212h-5.05v35.32h50.45V1212Zm15.13,20.18h-2.52v5h-5v-5h-2.52v-7.56h10.09Z" />'
                )
            );
            output = string(
                abi.encodePacked(
                    output,
                    '<text x="19.9%" y="91%" text-anchor="middle" font-size="25" font-family="andale mono, monospace">-</text></svg>'
                )
            );
        }

        string memory json = Base64.encode(
            bytes(
                string(
                    abi.encodePacked(
                        '{"name": "Locking Position #',
                        _toString(_logoInfos.tokenId),
                        '", "description": "Cvg Locked", "image": "data:image/svg+xml;base64,',
                        Base64.encode(bytes(output)),
                        '"}'
                    )
                )
            )
        );
        output = string(abi.encodePacked("data:application/json;base64,", json));
    }
}
