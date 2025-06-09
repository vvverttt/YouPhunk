// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import { getDefaultWallets, RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { configureChains, WagmiConfig } from 'wagmi';
import { mainnet, sepolia } from 'wagmi/chains';
import { alchemyProvider } from 'wagmi/providers/alchemy';
import { createClient } from '@rainbow-me/rainbowkit';

contract PhunkTradeMint is ERC721, ERC721Enumerable, Ownable {
    using Counters for Counters.Counter;
    
    // Constants
    address public constant BURN_ADDRESS = 0x000000000000000000000000000000000000dEaD;
    address public constant PHUNK_CONTRACT = 0x51AE5B2536907Fc2f61A1d1D59c2c8F0F76cF6d0; // Ethereum Phunks contract address
    
    // State variables
    Counters.Counter private _tokenIdCounter;
    mapping(uint256 => uint256) public phunkNumberToTokenId; // Maps Phunk number to our token ID
    mapping(uint256 => bool) public isLeftSide; // Tracks if token is left side of pair
    
    // Events
    event PhunkBurned(address indexed user, uint256 phunkNumber);
    event NewPairMinted(address indexed user, uint256 leftTokenId, uint256 rightTokenId);
    
    constructor() ERC721("PhunkTradeMint", "PTM") Ownable(msg.sender) {}
    
    // Function to burn Phunk and mint new pair
    function burnAndMint(uint256 phunkNumber) external {
        require(phunkNumber < 4269, "Invalid Phunk number");
        require(IERC721(PHUNK_CONTRACT).ownerOf(phunkNumber) == msg.sender, "Not Phunk owner");
        
        // Transfer Phunk to burn address
        IERC721(PHUNK_CONTRACT).transferFrom(msg.sender, BURN_ADDRESS, phunkNumber);
        emit PhunkBurned(msg.sender, phunkNumber);
        
        // Mint new pair
        uint256 leftTokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();
        uint256 rightTokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();
        
        // Mint left side to user
        _safeMint(msg.sender, leftTokenId);
        isLeftSide[leftTokenId] = true;
        
        // Mint right side to contract owner
        _safeMint(owner(), rightTokenId);
        isLeftSide[rightTokenId] = false;
        
        // Store mapping
        phunkNumberToTokenId[phunkNumber] = leftTokenId;
        
        emit NewPairMinted(msg.sender, leftTokenId, rightTokenId);
    }
    
    // Required overrides
    function _update(address to, uint256 tokenId, address auth)
        internal
        override(ERC721, ERC721Enumerable)
        returns (address)
    {
        return super._update(to, tokenId, auth);
    }
    
    function _increaseBalance(address account, uint128 amount)
        internal
        override(ERC721, ERC721Enumerable)
    {
        super._increaseBalance(account, amount);
    }
    
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
} 