pragma solidity ^0.8.9; 
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./OptionContract.sol";



contract Optino is Ownable {
    ERC20 public USDC;
    OptionContract public OptionCollection;

    //TODO: Move to seperate pool contract and pool struct
    uint256 public liquidityAvailable;
    uint256 public poolCollateral;
    uint256 public realizedLoss;
    //////////////////////////////////////////////////////

    //TODO: Remove this! Only for debug/testing
    uint256 public currentPrice;

    //Map the results of option after expiry
    mapping (uint256 => bool) public optionExpiredITM;

    constructor(address _usdc) {
        //TODO: REMOVE 
        currentPrice = 500000000 gwei;
        USDC = ERC20(_usdc); 
        OptionCollection = new OptionContract(); 
    }
    // PROTECT THIS FUNCTION 
    // function startNewEpoch(uint256 expiry, uint256 price) {
    // }

    // TODO: Protect function, make onlyOwner
    // TODO: expiredITM arg should be oracle?
    function resolveOption(uint256 expiry, uint256 strike, bool isCall, bool expiredITM) onlyOwner public {
        require(
            expiry < block.timestamp,
            "Option has not expire yet"
        );
        // other checks
        uint256 tokenId = OptionCollection.getOptionTokenId(expiry, strike, isCall);

        uint256 optionSupplyOutstanding = OptionCollection.totalSupply(tokenId);
        poolCollateral = poolCollateral - (optionSupplyOutstanding * 1 ether);
        if (expiredITM) {
            realizedLoss = realizedLoss + (optionSupplyOutstanding * 1 ether);
        } else {
            liquidityAvailable = liquidityAvailable + (optionSupplyOutstanding * 1 ether);
        }
        optionExpiredITM[tokenId] = expiredITM;
    }

    function buyOption(uint256 expiry, uint256 strike, uint256 amount, bool isCall) public {
        // Check if Maximum Contracts purchased would be exceeded
        require(
            amount <= maxContractsAvailable(),
            "Purchase would exceed maxContractsAvailable"
        );
        // Look up if strike + exp is authorized 
        uint256 tokenId = OptionCollection.getOptionTokenId(expiry, strike, isCall);
        //Maybe check approval before transferFrom
        //TODO: add safemath?
        // TODO: Need to pass exp strike to getPrice
        uint256 cost = amount*getPrice();
        require(
            USDC.transferFrom(msg.sender, address(this), cost),
            "USDC premium payment failed"
        );
        //TODO: Ensure this executes
        OptionCollection.mint(msg.sender, tokenId, amount);
        liquidityAvailable = liquidityAvailable - (amount * ((1 ether) - getPrice()));
        poolCollateral += (amount * 1 ether);
    }
    function exerciseOption(uint256 tokenId, uint256 amount) public {
        // Move these checks to seperate function? 
        require(
            optionExpiredITM[tokenId] == true,
            "Option is out of the money"
        );
        
        OptionCollection.burn(msg.sender, tokenId, amount);
        USDC.transfer(msg.sender, (amount * 1 ether));
        realizedLoss = realizedLoss - (amount * 1 ether);
    }
    //TODO: REMOVE IN PRODUCTION. DANGEROUS!!!! Only for debugging/testing
    function setPrice(uint256 priceUSDC) public {
        currentPrice = priceUSDC; 
    }
    ///TODO: Reformat to read price from oracle based on strike&expiry
    function getPrice() public view returns(uint256) {
        return currentPrice;
    }
    
    // max contracts underwritable by pool at current price and liquidity
    function maxContractsAvailable() public view returns(uint256) {
        uint256 collateral_required_per_contract = 1 ether - getPrice();
        return liquidityAvailable / collateral_required_per_contract;
    }
        
    function liquidityDeposit(uint256 amount) public {
        // TODO: implement LP shares, and shares/amount calculation
        require(
            USDC.transferFrom(msg.sender, address(this), amount),
            "LiquidityDeposit: Transfer Failed"
        );
        liquidityAvailable += amount;
    }
}
