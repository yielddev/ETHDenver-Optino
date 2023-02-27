pragma solidity ^0.8.9; 
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./OptionContract.sol";
import "./OptinoLPShares.sol";



contract Optino is Ownable {
    ERC20 public USDC;
    OptionContract public OptionCollection;
    OptinoLPShares public LPShares;

    //TODO: Move to seperate pool contract and pool struct
    uint256 public liquidityAvailable;
    uint256 public poolCollateral;
    uint256 public realizedLoss;
    //////////////////////////////////////////////////////

    //TODO: Remove this! Only for debug/testing
    uint256 public currentPrice;

    //Map the results of option after expiry
    mapping (uint256 => bool) public optionExpiredITM;


    // EPOCH 
    // EPOCH Rolls over at end of longest Period
    // 6 hrs 
    // 12 hrs
    // 24 hrs
    struct Expiry {
        uint256 expiry;
        uint256 ten_delta;
        uint256 twenty_five_delta;
        uint256 fifty_delta;
    }

    struct Epoch {
        uint256 startTime;
        Expiry expire6;
        Expiry expire12;
        Expiry expire24;
        uint256 referencePrice;
    }

    Epoch public currentEpoch;

    

    constructor(address _usdc) {
        //TODO: REMOVE 
        currentPrice = 500000000 gwei;
        USDC = ERC20(_usdc); 
        LPShares = new OptinoLPShares();
        OptionCollection = new OptionContract(); 
    }


    function expiryIsInEpoch(uint256 expiry) public view returns(bool) {
        if (
            expiry == currentEpoch.expire6.expiry || 
            expiry == currentEpoch.expire12.expiry || 
            expiry == currentEpoch.expire24.expiry
        ) {
            return true;
        } else {
            return false;
        }
    }

    // Rewrite to use recalculation of strike based on exp and starttime
    function strikeIsInEpoch(uint256 strike) public view returns(bool) {
        if (
            strike == currentEpoch.expire6.ten_delta ||
            strike == currentEpoch.expire6.twenty_five_delta ||
            strike == currentEpoch.expire6.fifty_delta
        ) {
            return true;
        } else {
            return false;
        }
    }

    function isOptionValidInEpoch(uint256 strike, uint256 expiry) public view returns(bool) {
        if (expiryIsInEpoch(expiry) && strikeIsInEpoch(strike)) {
            return true;
        } else {
            return false;
        }
    }

    // is this read only?
    // TODO: Remove current price when feed is available
    function getDelta(uint256 delta, uint256 currentPrice) public view returns(uint256) {
        return currentPrice + (delta * 1 ether);
    }
    // TODO: Remove current price
    function startNewEpoch(uint256 start, uint256 currentPrice) onlyOwner public {
        Expiry memory six = Expiry({
            expiry: start+(6 hours),
            ten_delta: getDelta(10, currentPrice),
            twenty_five_delta: getDelta(25, currentPrice),
            fifty_delta: getDelta(50, currentPrice)
        });
        Expiry memory twelve = Expiry({
            expiry: start+(12 hours),
            ten_delta: getDelta(10, currentPrice),
            twenty_five_delta: getDelta(25, currentPrice),
            fifty_delta: getDelta(50, currentPrice)
        });
        Expiry memory twenty_four = Expiry({
            expiry: start+(24 hours),
            ten_delta: getDelta(10, currentPrice),
            twenty_five_delta: getDelta(25, currentPrice),
            fifty_delta: getDelta(50, currentPrice)
        });

        currentEpoch = Epoch({
            startTime: start,
            expire6: six,
            expire12: twelve,
            expire24: twenty_four,
            referencePrice: currentPrice
        });
    }
    // TODO: Protect function, make onlyOwner
    // TODO: expiredITM arg should be oracle?
    function resolveOption(uint256 expiry, uint256 strike, bool isCall, bool expiredITM) onlyOwner public {
        // Check Option is in Epoch 
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
        // Check Option is in Epoch
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

    function LPEquity() public view returns(uint256){
        // Add current (1 - currentPrice) * total supply of outstanding options
        return liquidityAvailable;
    }
        
    function liquidityDeposit(uint256 amount) public {
        // TODO: implement LP shares, and shares/amount calculation
        uint256 currentLPEquity = LPEquity();
        uint256 outstandingShares = LPShares.totalSupply();
        // Add precision for Floating Point
        if (outstandingShares > 0) {
            uint256 equityPerShare = currentLPEquity / outstandingShares;
            uint256 new_shares = amount / equityPerShare;
        } else {
            uint256 new_shares = amount;
        }

        require(
            USDC.transferFrom(msg.sender, address(this), amount),
            "LiquidityDeposit: Transfer Failed"
        );
        LPShares.mint(msg.sender, amount);
        liquidityAvailable += amount;
    }
}
