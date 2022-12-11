// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "../interfaces/IIridium.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

error mint_notMinter();
error crack_callFailure();
error setMinter_zeroAddress();
error setKeyAddress_zeroAddress();
error setWhitelistAddress_zeroAddress();

///@title Geodes for space rats NFT collection
///@author 0xGusMcCrae
///@notice Mine geodes in the asteroid mines and crack them open for rewards

contract Geode is ERC721, Ownable {

    ///@notice address of minter role
    ///@dev this should be the asteroid mines staking contract
    address public minter;
    //counter for incrementing tokenId at time of mint
    uint256 public counter;
    //interface for Iridium contract
    IIridium private iridium;
    ///@notice address of contract to be used for minting spaceship keys
    address public keyAddress; 
    ///@notice address of contract to be used for minting whitelist spot NFTs
    address public whitelistAddress; 

    ///@notice alert for change in minter role
    ///@param newMinter address of the new minter role holder
    event newMinterSet(address newMinter);
    ///@notice alert for change in spaceship key mint address
    ///@param keyAddress the address of the spaceship contract
    event keyAddressSet(address keyAddress);
    ///@notice alert for change in whitelist NFT mint address
    ///@param whitelistAddress the address of the whitelist NFT contract
    event whitelistAddressSet(address whitelistAddress);
    ///@notice alert for cracking/burning of a geode
    ///@param reward message indicating type of reward
    event geodeCracked(string reward);

    ///@param iridiumAddress address of iridium contract
    constructor(address iridiumAddress) ERC721('Geode', 'GEO') {
        counter = 1;
        iridium = IIridium(iridiumAddress);
    }

    ///@notice Mint new geodes
    ///@dev minter should be set to the deployed asteroid mines address
    ///@param to the recipient of the minted geode 
    function mint(address to) external{
        if (msg.sender != minter){
            revert mint_notMinter();
        }
        uint256 tokenId = counter;
        counter++;
        _safeMint(to, tokenId);
    }

    ///@notice Crack geodes open to obtain rewards
    /**@dev not truly random, but close enough for the scope of this contract,
            spaceship keys and whitelist spots not implemented yet.
            With spaceship and whitelist, simulation of 1000 cracks gets
            44 keys, 86 whitelists, 128 1000 iridium mints, 298 500 iridium
            mints, and 444 100 iridium mints */
    ///@param tokenId the tokenId of the geode to be cracked
    function crack(uint256 tokenId) external {
        //want to burn the nft and give the caller a reward
        _burn(tokenId);
        //dispense rewards AFTER burn
        uint randomVar = uint(keccak256(abi.encodePacked(block.difficulty, msg.sender, blockhash(block.number - 1), tokenId, block.timestamp)));
        if(randomVar % 7 == 0 && randomVar % 3 == 0 && keyAddress != address(0)){
            //spaceship keys
            emit geodeCracked('Spaceship Keys');
            //spaceship contract must have mintKeys function with recipient address as parameter
            (bool success, ) = keyAddress.call(abi.encodeWithSignature('mintKeys(address)', msg.sender));
            if(!success){
                revert crack_callFailure();
            }
        }
        else if (randomVar % 11 == 0 && whitelistAddress != address(0)) {
            //tradeable whitelist spot reward (nft to be burned at time of mint)
            emit geodeCracked('Whitelist Spot');
            //for now, it's just going to be a standalone contract
            //whitelist contract must have mint function with recipient address as parameter
            (bool success, ) = whitelistAddress.call(abi.encodeWithSignature('mint(address)', msg.sender));
            if(!success){
                revert crack_callFailure();
            }
        }
        else if (randomVar % 6 == 0){
            //1000 Iridium reward
            emit geodeCracked('1000 Iridium');
            iridium.mint(1000*10**18,msg.sender);
        }
        else if (randomVar % 2 == 0){
            //500 iridium reward
            emit geodeCracked('500 Iridium');
            iridium.mint(500*10**18,msg.sender);
        }
        else {
            //100 iridium reward
            emit geodeCracked('100 Iridium');
            iridium.mint(100*10**18,msg.sender);
        }
    }

    ///@notice set a new address for the minter role
    ///@dev this should be the asteroid mine contract
    ///@param newMinter the address of the recipient of the minter role
    function setMinter(address newMinter) external onlyOwner {
        if(newMinter == address(0)){
            revert setMinter_zeroAddress();
        }
        minter = newMinter;
        emit newMinterSet(newMinter);
    }

    ///@notice set a new address for minting spaceship keys
    ///@dev for use once spaceship NFTs are implemented
    ///@param _keyAddress the address of the spaceshit nft contract
    function setKeyAddress(address _keyAddress) external onlyOwner {
        if(_keyAddress == address(0)){
            revert setKeyAddress_zeroAddress();
        }
        keyAddress = _keyAddress;
        emit keyAddressSet(_keyAddress);
    }

    ///@notice set a new address for minting tradeable whitelist spot NFTs
    ///@dev for use once whitelist spot NFTs are implemented
    ///@param _whitelistAddress the address of the contract that handles the whitelist NFTs
    function setWhitelistAddress(address _whitelistAddress) external onlyOwner {
        if(_whitelistAddress == address(0)) {
            revert setWhitelistAddress_zeroAddress();
        }
        whitelistAddress = _whitelistAddress;
        emit whitelistAddressSet(_whitelistAddress);
    }

}