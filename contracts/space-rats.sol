// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/common/ERC2981.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

error mint_incorrectPrice();
error mint_maxSupplyReached();
error whitelist_alreadyClaimed();
error URI_isFrozen();
error URI_alreadyFrozen();
error royalty_exceedsMax();
error whitelist_invalidMerkleProof();

///@title Space Rats NFT Collection
///@author 0xGusMcCrae
///@notice main contract for minting space rat NFTs to be used throughout the ecosystem
contract SpaceRats is ERC721, ERC2981, Ownable {

    ///@notice merkleRoot generated offchain to be used for whitelist tracking
    bytes32 immutable public merkleRoot;
    ///@notice mapping to track which addresses have claimed their whitelist spots
    mapping(address => bool) public claimed; 
    ///@notice mint price in ETH
    uint256 public immutable mintPrice;
    ///@notice counter for incrementing tokenId at time of mint and tracking publicly minted supply
    uint256 public counter;
    ///@notice 1000 non-whitelist NFTs available for mint
    uint256 public maxPublicSupply = 1000;
    ///@notice tracks number of non-whitelist NFTs that have been minted
    uint256 public publicSupply;
    ///@notice baseURI string
    string public baseURI;
    ///@notice whether baseURI is frozen/finalized
    bool public frozen;
    ///@notice max royalty --> 10%
    uint96 public constant maxRoyalty = 1000;

    ///@notice alert for change to baseURI
    ///@param baseURI the new baseURI
    event newBaseURI(string baseURI);
    ///@notice alert for freezing baseURI
    event URIFrozen();
    ///@notice alert for change of royalty 
    ///@param receiver address that will receive paid royalties
    ///@param royalty the new royalty in bps
    event newRoyaltySet(address indexed receiver, uint96 royalty);

    constructor(uint256 _mintPrice, bytes32 _merkleRoot) ERC721('Space Rats', 'SPRAT') {
        merkleRoot = _merkleRoot;
        mintPrice = _mintPrice;
        counter = 1;
        _setDefaultRoyalty(msg.sender, 250); // 2.5% in bps
    }

    ///@notice mint function for public (non-whitelist) NFTs
    function mint() external payable{
        if(publicSupply >= maxPublicSupply){
            revert mint_maxSupplyReached();
        }
        if(msg.value != mintPrice){
            revert mint_incorrectPrice();
        }
        uint256 tokenId = counter;
        counter++;
        publicSupply++;
        _safeMint(msg.sender, tokenId);
        
    }

    ///@notice helper function for merkle tree whitelist 
    ///@param addr address to be converted
    function toBytes32(address addr) pure internal returns (bytes32) {
        return keccak256(bytes.concat(keccak256(abi.encode(addr))));
    }

    ///@notice mint function for whitelist 
    ///@param merkleProof merkle proof generated offchain to prove whitelist status
    ///@dev see getMerkleProof.js
    function whitelistMint(bytes32[] calldata merkleProof) external payable { 
        if(msg.value != mintPrice){
            revert mint_incorrectPrice();
        }
        if(claimed[msg.sender]){
            revert whitelist_alreadyClaimed();
        }
        if(MerkleProof.verify(merkleProof, merkleRoot, toBytes32(msg.sender)) != true){
            revert whitelist_invalidMerkleProof();
        }
        uint256 tokenId = counter;
        counter++;
        claimed[msg.sender] = true;
        _safeMint(msg.sender, tokenId);
    }

    ///@notice Contract owner can withdraw mint proceeds here
    function withdraw() external onlyOwner {
        payable(msg.sender).transfer(address(this).balance);
    }

    ///@notice set the baseURI string
    ///@param _baseURI the new baseURI
    function setBaseURI(string memory _baseURI) external onlyOwner {
        if(frozen) {
            revert URI_isFrozen();
        }
        baseURI = _baseURI;
        emit newBaseURI(_baseURI);
    }

    ///@notice freeze and finalize the baseURI - cannot be undone!
    function freezeURI() external onlyOwner {
        if(frozen){
            revert URI_alreadyFrozen();
        }
        frozen = true;

        emit URIFrozen();
    }

    ///@notice change the royalty
    ///@param newRoyalty the new royalty in bps (i.e. 100 = 1%), may not exceed 10%
    function setNewRoyalty(uint96 newRoyalty) external onlyOwner {
        if(newRoyalty > maxRoyalty){
            revert royalty_exceedsMax();
        }
        _setDefaultRoyalty(owner(), newRoyalty);

        emit newRoyaltySet(owner(), newRoyalty);
    }
    

    /**
     * @dev See {IERC165-supportsInterface}.
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC721, ERC2981) returns (bool) {
        return
            interfaceId == type(ERC2981).interfaceId || 
            super.supportsInterface(interfaceId); // Call super.supportsInterface to catch upstream things
    }

}