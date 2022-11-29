// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IGeode {

    function mint(address to) external;

    function crack(uint256 tokenId) external;

    function setMinter(address newMinter) external;

    function setBurner(address newBurner) external;
}