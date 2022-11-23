// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract ProdeToken is ERC721, Ownable {
    using Counters for Counters.Counter;
    
    Counters.Counter private tokenIds;
    mapping (uint256 => uint96) private matches;

    constructor() ERC721("ProdeToken", "PTO") {
    }

    function mintBet(address _tokenOwner, uint96 _bet) public onlyOwner returns (uint256) {
        tokenIds.increment();
        uint256 newItemId = tokenIds.current();
        matches[newItemId] = _bet;

        _mint(_tokenOwner, newItemId);

        return newItemId;
    }
    
    function getBet(uint256 n) public view returns (uint96) {
        return matches[n];
    }
}