// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

error mint_notAuthorized();
error burn_notBurner();

///@title Iridium tokens for space rats nft ecosystem
///@author 0xGusMcCrae
contract Iridium is ERC20, Ownable {

    ///@notice Address of asteroid mine staking contract
    address public asteroidMine;
    ///@notice Address of geode NFT contract
    address public geode;
    ///@notice address of holder of burner role
    ///@dev this will probalby end up being whatever contract iridium is consumed by
    address public burner; 

    ///@notice alert for change in burner role
    ///@param newBurner address of the new burner role holder
    event newBurnerSet(address newBurner);
    ///@notice alert for change in asteroid mine address
    ///@param newMine address of new asteroid mine
    event newAsteroidMineSet(address newMine);
    ///@notice alert for change in geode contract address
    ///@param geode address of new geode contract
    event geodeSet(address geode);
    ///@notice alert for iridium mint
    ///@param amount of iridium minted
    event iridiumMinted(uint256 amount);

    constructor() ERC20('Iridium', 'IRDM') {
        burner = msg.sender;
    }

    ///@notice mint new iridium tokens
    ///@dev this can only be called by the geode and asteroid mines contracts
    ///@param amount the amount of tokens to mint
    ///@param to the address of the recipient of the minted tokens
    function mint(uint256 amount, address to) external {
        if(msg.sender != asteroidMine && msg.sender != geode) {
            revert mint_notAuthorized();
        }
        _mint(to,amount);
        emit iridiumMinted(amount);
    }

    ///@notice burn iridium tokens
    ///@dev this will be called by the contract that is implemented to consume iridium
    ///@param amount the amount of tokens to burn
    function burn(uint256 amount) external {
        if (msg.sender != burner) {
            revert burn_notBurner();
        }
        _burn(msg.sender, amount);
    }

    ///@notice switch the burner role to a new address
    ///@param newBurner the address of the account that will take on the burner role
    function setBurner(address newBurner) external onlyOwner {
        burner = newBurner;
        emit newBurnerSet(newBurner);
    }

    ///@notice set/update the address of the asteroid mines
    ///@param newMine the address of the deployed asteroid mine contract
    function setAsteroidMine(address newMine) external onlyOwner{
        asteroidMine = newMine;
        emit newAsteroidMineSet(newMine);
    }

    ///@notice set the address of the geode NFT contract
    ///@param _geode the address of the deployed geode NFT contract
    function setGeode(address _geode) external onlyOwner{
        geode = _geode;
        emit geodeSet(_geode);
    }
}