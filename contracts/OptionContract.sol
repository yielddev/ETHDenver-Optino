pragma solidity ^0.8.9;
import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract OptionContract is ERC1155Supply, Ownable{

    uint256 public expiry;
    uint256 public strike;
    bytes32 public optionCode;
    

    constructor() ERC1155("ipfs://null/") {
        //optionCode = keccak256(abi.encodePacked(_expiry, _strike));
        
    }
    
    // function mint(address account, uint256 amount) onlyOwner public {
    //    _mint(account, amount); 
    // }

    function mint(address to, uint256 tokenId, uint256 amount) onlyOwner public {
        _mint(to, tokenId, amount, '0x00');
    }

    function getOptionCode(uint256 _expiry, uint256 _strike, bool isCall) public view returns(bytes32) {
        if (isCall) {
            return keccak256(abi.encodePacked(_expiry, _strike, "call"));
        } else {
            return keccak256(abi.encodePacked(_expiry, _strike, "put"));
        }
    }

    function getOptionTokenId(uint256 _expiry, uint256 _strike, bool isCall) public view returns(uint256) {
        bytes32 option_code = getOptionCode(_expiry, _strike, isCall);
        return uint256(option_code);
    }
    function burn(address account, uint256 id, uint256 value) public {
        require(
            account == _msgSender() || isApprovedForAll(account, _msgSender()),
            "ERC1155: caller is not token owner or approved"
        );

        _burn(account, id, value);
    }

    function burnBatch(address account, uint256[] memory ids, uint256[] memory values) public virtual {
        require(
            account == _msgSender() || isApprovedForAll(account, _msgSender()),
            "ERC1155: caller is not token owner or approved"
        );
        _burnBatch(account, ids, values);
    }

    function isApprovedForAll(
        address _owner,
        address _operator
    ) public override view returns (bool isOperator) {
        if (_operator == owner()) {
            return true;
        }
        return ERC1155.isApprovedForAll(_owner, _operator);
    }
}
