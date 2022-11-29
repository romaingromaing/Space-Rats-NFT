// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IIridium {

    function mint(uint256 amount, address to) external;

    function burn(uint256 amount) external;

    function setMinter(address newMinter) external;

    function setBurner(address newBurner) external;

    function decimals() external returns (uint8);
}