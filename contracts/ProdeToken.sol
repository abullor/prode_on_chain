// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title NFT to store score predictions
/// @author Ariel Bullor
contract ProdeToken is ERC721, Ownable {
    using Counters for Counters.Counter;
    
    Counters.Counter private tokenIds;
    mapping (uint256 => uint96) private matches;

    constructor() ERC721("ProdeToken", "PTO") {
    }

    /// @notice Mints a new NFT storing the bet on chain.
    /// @dev Returns NFT id.
    function mintBet(address _tokenOwner, uint96 _bet) external onlyOwner returns (uint256) {
        tokenIds.increment();
        uint256 newItemId = tokenIds.current();
        matches[newItemId] = _bet;

        _mint(_tokenOwner, newItemId);

        return newItemId;
    }

    /// @notice Returns the bet for a given NFT id.
    function getBet(uint256 n) external view returns (uint96) {
        return matches[n];
    }
}