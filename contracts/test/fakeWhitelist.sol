// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract Whitelist is ERC721 {
    uint256 counter;

    constructor() ERC721('Whitelist', 'LIST') {
        counter = 1;
    }

    function mint(address to) public {
        uint256 tokenId = counter;
        counter++;
        _safeMint(to, tokenId);
    }
}