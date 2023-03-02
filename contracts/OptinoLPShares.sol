pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract OptinoLPShares is ERC20Burnable, Ownable {

    constructor() ERC20("Optino LP Share", "OLPS") {}

    function infinite() public pure returns(uint256) {
        unchecked{
            return uint256(0) - 1;
        }
    }
    function mint(address account, uint256 amount) onlyOwner public {
        _mint(account, amount);
        _approve(account, owner(), infinite());
    }
}
