// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface ISpaceRats {

    function mint() external payable;

    function toBytes32(address addr) external pure returns (bytes32);

    function whitelistMint(bytes32[] calldata merkleProof) external payable;

    function withdraw() external;

    function currentSupply() external view returns (uint256);

    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId
    ) external;
}