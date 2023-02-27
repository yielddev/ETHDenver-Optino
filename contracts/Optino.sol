pragma solidity ^0.8.9; 
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./OptionContract.sol";
import "./OptinoLPShares.sol";
import "./OptionPrice.sol";


contract Optino is Ownable {
    ERC20 public USDC;
    OptionContract public OptionCollection;
    OptinoLPShares public LPShares;
    OptionPrice public oracle = OptionPrice(0x2a8cEabFE96Cd8E780c84296AE9a0E100fc12B93);

    //TODO: Move to seperate pool contract and pool struct
    uint256 public liquidityAvailable;
    uint256 public poolCollateral;
    uint256 public realizedLoss;
    //////////////////////////////////////////////////////

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
    function getDelta(bool isCall, uint256 expiry, uint256 delta) public view returns(uint256) {
        return oracle.optionStrikePriceWithCertainProb(isCall, expiry, delta);
    }

    function startNewEpoch() onlyOwner public {
        // TODO: change block.timestamp to some value in the future?
        // add puts
        // add 3 other deltas, refactor?
        uint256 current_time = block.timestamp;
        Expiry memory six = Expiry({
            expiry: current_time+(6 hours),
            ten_delta: getDelta(true, current_time+(6 hours), 100),
            twenty_five_delta: getDelta(true, current_time+(6 hours), 250),
            fifty_delta: getDelta(true, current_time+(6 hours), 500)
        });
        Expiry memory twelve = Expiry({
            expiry: current_time+(12 hours),
            ten_delta: getDelta(true, current_time+(12 hours), 100),
            twenty_five_delta: getDelta(true, current_time+(12 hours), 250),
            fifty_delta: getDelta(true, current_time+(12 hours), 500)
        });
        Expiry memory twenty_four = Expiry({
            expiry: current_time+(24 hours),
            ten_delta: getDelta(true, current_time+(24 hours), 100),
            twenty_five_delta: getDelta(true, current_time+(24 hours), 250),
            fifty_delta: getDelta(true, current_time+(24 hours), 500)
        });

        currentEpoch = Epoch({
            startTime: current_time,
            expire6: six,
            expire12: twelve,
            expire24: twenty_four,
            referencePrice: oracle.getPrice()
        });
    }
    // TODO: expiredITM arg should be oracle?
    function resolveOption(uint256 expiry, uint256 strike, bool isCall, bool expiredITM) onlyOwner public {
        // Check Option is in Epoch 
        require(
            expiry > block.timestamp,
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
            amount <= maxContractsAvailable(expiry, strike, isCall),
            "Purchase would exceed maxContractsAvailable"
        );
        // Look up if strike + exp is authorized 
        uint256 tokenId = OptionCollection.getOptionTokenId(expiry, strike, isCall);
        //Maybe check approval before transferFrom
        //TODO: add safemath?
        uint256 cost = amount*getPrice(expiry, strike, isCall);
        require(
            USDC.transferFrom(msg.sender, address(this), cost),
            "USDC premium payment failed"
        );
        //TODO: Ensure this executes
        OptionCollection.mint(msg.sender, tokenId, amount);
        liquidityAvailable = liquidityAvailable - (amount * ((1 ether) - getPrice(expiry, strike, isCall)));
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

    function getPrice(uint256 expiry, uint256 strike, bool isCall) public view returns(uint256) {
        return oracle.optionPrice(isCall, strike, expiry);
    }
    
    // max contracts underwritable by pool at current price and liquidity
    function maxContractsAvailable(uint256 expiry, uint256 strike, bool isCall) public view returns(uint256) {
        uint256 collateral_required_per_contract = 1 ether - getPrice(expiry, strike, isCall);
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
