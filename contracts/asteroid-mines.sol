// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../interfaces/IIridium.sol";
import "../interfaces/ISpaceRats.sol";
import "../interfaces/IGeode.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

error unstake_tokenNotStakedByCaller();

///@title Asteroid Mine staking contract for Space Rats NFT collection
///@author 0xGusMcCrae
///@notice Stake your space rats nfts to earn iridium and geodes
contract AsteroidMine is IERC721Receiver, Ownable {

    ISpaceRats private immutable spaceRats;
    IIridium private immutable iridium;
    IGeode private immutable geode;

    ///@notice iridium accumulated per second per staked token
    uint256 public iridiumRate;
    //Owner's address => tokenIds
    mapping(address => uint256[]) public stakedTokens;
    //tokenId => timestamp at time of latest reward update or initial stake if no claims yet
    mapping(uint256 => uint256) public latestTimestamps;
    //user address => accumulated iridium
    mapping(address => uint256) public iridiumBalances;

    ///@notice alert for a token staking function call
    ///@param tokenId the tokenId of the NFT being staked
    event tokenStaked(uint256 tokenId);
    ///@notice alert for a token unstaking function call
    ///@param tokenId the tokenId of the NFT being unstaked
    event tokenUnstaked(uint256 tokenId);
    ///@notice alert for a claim of iridium rewards
    ///@param amount the size of the iridium claim
    event iridiumMined(uint256 amount);
    ///@notice alert for when a geode has been mined during an iridium claim
    event geodeMined();

    constructor(
        address _spaceRatsAddress, 
        address _iridiumAddress, 
        address _geodeAddress,
        uint256 _iridiumRate
        ) {
        spaceRats = ISpaceRats(_spaceRatsAddress);
        iridium = IIridium(_iridiumAddress);
        geode = IGeode(_geodeAddress);
        iridiumRate = _iridiumRate;
    }

    ///@notice stake space rat to accumulate rewards
    ///@param tokenId tokenId of the space rat to be staked
    function stake(uint256 tokenId) external {
        spaceRats.safeTransferFrom(msg.sender, address(this), tokenId);
        stakedTokens[msg.sender].push(tokenId);
        latestTimestamps[tokenId] = block.timestamp;
        emit tokenStaked(tokenId);
    }

    ///@notice unstake space rat token
    ///@param tokenId tokenId of the space rat to be unstaked
    function unstake(uint256 tokenId) external { 
        //check for token ownership
        bool tokenOwner = false;
        for(uint256 i = 0; i < stakedTokens[msg.sender].length; i++){
            if(stakedTokens[msg.sender][i] == tokenId){
                tokenOwner = true;
            }
        }
        if(!tokenOwner){
            revert unstake_tokenNotStakedByCaller();
        }
        spaceRats.safeTransferFrom(address(this), msg.sender, tokenId);
        _getIridiumBalance(msg.sender);
        for (uint256 i = 0; i < stakedTokens[msg.sender].length; i++)  {
            if(stakedTokens[msg.sender][i] == tokenId){
                delete latestTimestamps[stakedTokens[msg.sender][i]];
                delete stakedTokens[msg.sender][i];
            }
        }
        emit tokenUnstaked(tokenId);
    }

    ///@notice claim iridium rewards with chances to receive geodes
    function claim() external {
        uint256 amount = _getIridiumBalance(msg.sender);
        iridiumBalances[msg.sender] = 0;
        iridium.mint(amount, msg.sender);
        emit iridiumMined(amount);
        //geode claim mechanism
        handleGeodes(amount);
    }

    ///@notice handles geode generation/minting within the claim() function
    ///@param amount the amount of iridium being claimed
    function handleGeodes(uint256 amount) internal {
        // for each 250 iridium claimed, you get a chance at a geode
        //not truly random, but good enough for this scenario 
        for(uint256 i = 1; 250*i*(10**18) < amount; i++){
            if(uint(keccak256(abi.encodePacked(block.difficulty,i*3, i+1, (i+4)*7, blockhash(block.number - 1), amount, block.timestamp))) % 3 == 0){
                geode.mint(msg.sender);
                emit geodeMined();
            }
        }
    }

    //////////////////////
    // Getter Functions //
    //////////////////////

    ///@notice get a list of user's currently staked tokens
    ///@return array of tokenIds the user currently has staked
    function getStakedTokenIds() external view returns (uint256[] memory){
        return stakedTokens[msg.sender];
    }
    
    ///@notice Calculate the user's currently claimable iridium balance
    ///@dev to be called within the claim() function or the below getIridiumBalance getter function
    ///@param account the user's address
    ///@return the user's claimable iridium balance
    function _getIridiumBalance(address account) internal returns (uint256) {
        for (uint256 i = 0; i < stakedTokens[account].length; i++) {
            iridiumBalances[account] += iridiumRate * (block.timestamp - latestTimestamps[stakedTokens[msg.sender][i]]);
            latestTimestamps[stakedTokens[msg.sender][i]] = block.timestamp;
        }
        return iridiumBalances[account];
    }

    ///@notice getter function to ge user's iridium balance
    /**@dev this function is state changing, access the mapping directly
     * for out of date but view only balance */
    ///@return the user's claimable iridium balance
    function getIridiumBalance() external returns (uint256) {
        return _getIridiumBalance(msg.sender);
    }


    ///@notice implementation of IERC721Receiver
    ///@dev fallback function called upon safeTransferFrom during staking
    function onERC721Received(
        address /*operator*/,
        address /*from*/,
        uint256 /*tokenId*/,
        bytes calldata /*data*/
    ) external pure returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }


}