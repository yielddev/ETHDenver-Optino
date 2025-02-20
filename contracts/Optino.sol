pragma solidity ^0.8.9; 
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./OptionContract.sol";
import "./OptinoLPShares.sol";
import "./OptionPrice.sol";


contract Optino is Ownable {
    ERC20 public USDC;
    OptionContract public OptionCollection;

    OptinoLPShares public LPShares;
    OptionPrice public oracle;  // OptionPrice(0x2a8cEabFE96Cd8E780c84296AE9a0E100fc12B93);

    Expiry[3] public calls;
    Expiry[3] public puts;

    uint256 public liquidityAvailable;
    uint256 public poolCollateral;
    uint256 public realizedLoss;

    //Map the results of option after expiry
    mapping (uint256 => bool) public optionExpiredITM;
    // mapping (uint256 => bool) public optionIsResolved;
    mapping (uint256 => bool) public expiryIsResolved;
    // epoch.endTime => (equity/share_requested)
    mapping (uint256 => uint256) public epochDistributionPerShare;

    uint256 public totalWithdrawRequestedShares;
    uint256 public totalUSDCPendingWithdraw;

    struct Withdrawal {
        uint256 amount;
        uint256 epochEndTime;
        bool isClaimed;
    }
    mapping (address => Withdrawal) public withdrawRequested;
    // EPOCH Rolls over at end of longest Period
    // 6 hrs 
    // 12 hrs
    // 24 hrs
    struct Expiry {
        uint256 expiry;
        uint256 one_delta;
        uint256 ten_delta;
        uint256 twenty_five_delta;
        uint256 fifty_delta;
    }

    struct Epoch {
        uint256 startTime;
        uint256 endTime;
        bool isResolved;
        // Expiry expire6;
        // Expiry expire12;
        // Expiry expire24;
        uint256 referencePrice;
    }

    Epoch public currentEpoch;

    event OptionResolved(uint256 tokenId, bool indexed expiredITM);
    event OptionPurchased(address indexed account, uint256 indexed tokenId);

    

    constructor(address _usdc, address option_price_oracle) {
        oracle = OptionPrice(option_price_oracle);
        USDC = ERC20(_usdc); 
        LPShares = new OptinoLPShares();
        OptionCollection = new OptionContract(); 
        currentEpoch = Epoch({
            startTime: 0,
            endTime: 0,
            isResolved: true,
            referencePrice: 0
        });
        startNewEpoch();  
    }

    function isSuspended() public view returns (bool) {
        for (uint i; i < calls.length; i++) {
            if (calls[i].expiry < block.timestamp) {
                if (!expiryIsResolved[calls[i].expiry]) {
                    return true;
                }
            }
        }
    }

    function expiryIsInEpoch(uint256 expiry, bool isCall) public view returns(bool) {
        if (isCall) {
            for (uint i; i < calls.length; i++) {
                if (calls[i].expiry == expiry) {
                    return true;
                }
            }
            return false;
        } else {
            for (uint i; i < puts.length; i++) {
                if (puts[i].expiry == expiry) {
                    return true;
                }
            }
            return false;
        }
    }

    function strikeIsInEpoch(uint256 strike, uint256 expiry, bool isCall) public view returns(bool) {
        if (isCall) {
            for (uint i; i < calls.length; i++) {
                if (calls[i].expiry == expiry) {
                    if (
                        strike == calls[i].one_delta ||
                        strike == calls[i].ten_delta ||
                        strike == calls[i].twenty_five_delta ||
                        strike == calls[i].fifty_delta
                    ) {
                        return true;
                    } else {
                        return false;
                    }
                }
            }
        } else {
            for (uint i; i < puts.length; i++) {
                if (puts[i].expiry == expiry) {
                    if (
                        strike == puts[i].one_delta ||
                        strike == puts[i].ten_delta ||
                        strike == puts[i].twenty_five_delta ||
                        strike == puts[i].fifty_delta
                    ) {
                        return true;
                    } else {
                        return false;
                    }
                }
            }
        }
        return false;
    }

    function isOptionValidInEpoch(uint256 strike, uint256 expiry, bool isCall) public view returns(bool) {
        if (expiryIsInEpoch(expiry, isCall) && strikeIsInEpoch(strike, expiry, isCall)) {
            return true;
        } else {
            return false;
        }
    }

    function getDelta(bool isCall, uint256 expiry, uint256 delta) public view returns(uint256) {
        return oracle.optionStrikePriceWithCertainProb(isCall, expiry, delta);
    }

    function startNewEpoch() private {
        
        // add 3 other deltas, refactor?
        require(
            currentEpoch.isResolved,
            "CurrentEpoch not resolved"
        );
        uint256 startTime = block.timestamp;
        currentEpoch = Epoch({
            startTime: startTime,
            endTime: startTime+(24 hours),
            isResolved: false,
            referencePrice: oracle.getPrice()
        });
        calls[0] = Expiry({
                    expiry: startTime+(6 hours),
                    one_delta: getDelta(true, startTime+(6 hours), 10),
                    ten_delta: getDelta(true, startTime+(6 hours), 100),
                    twenty_five_delta: getDelta(true, startTime+(6 hours), 250),
                    fifty_delta: getDelta(true, startTime+(6 hours), 500)
        });
        calls[1] = Expiry({
                    expiry: startTime+(12 hours),
                    one_delta: getDelta(true, startTime+(12 hours), 10),
                    ten_delta: getDelta(true, startTime+(12 hours), 100),
                    twenty_five_delta: getDelta(true, startTime+(12 hours), 250),
                    fifty_delta: getDelta(true, startTime+(12 hours), 500)
        });
        calls[2] = Expiry({
                    expiry: startTime+(24 hours),
                    one_delta: getDelta(true, startTime+(24 hours), 10),
                    ten_delta: getDelta(true, startTime+(24 hours), 100),
                    twenty_five_delta: getDelta(true, startTime+(24 hours), 250),
                    fifty_delta: getDelta(true, startTime+(24 hours), 500)
        });

        puts[0] =  Expiry({
                    expiry: startTime+(6 hours),
                    one_delta: getDelta(false, startTime+(6 hours), 10),
                    ten_delta: getDelta(false, startTime+(6 hours), 100),
                    twenty_five_delta: getDelta(false, startTime+(6 hours), 250),
                    fifty_delta: getDelta(false, startTime+(6 hours), 500)
        });

        puts[1] = Expiry({
                    expiry: startTime+(12 hours),
                    one_delta: getDelta(false, startTime+(12 hours), 10),
                    ten_delta: getDelta(false, startTime+(12 hours), 100),
                    twenty_five_delta: getDelta(false, startTime+(12 hours), 250),
                    fifty_delta: getDelta(false, startTime+(12 hours), 500)
        });

        puts[2] = Expiry({
                    expiry: startTime+(24 hours),
                    one_delta: getDelta(false, startTime+(24 hours), 10),
                    ten_delta: getDelta(false, startTime+(24 hours), 100),
                    twenty_five_delta: getDelta(false, startTime+(24 hours), 250),
                    fifty_delta: getDelta(false, startTime+(24 hours), 500)
        });
                
        
    }
    function endEpoch() onlyOwner public {
        // TODO: add precision
        epochDistributionPerShare[currentEpoch.endTime] = ((LPEquity() * 1 ether) / LPShares.totalSupply());
        uint256 newDistributions = ((epochDistributionPerShare[currentEpoch.endTime] * totalWithdrawRequestedShares))/ 1 ether;
        totalUSDCPendingWithdraw += newDistributions;
        liquidityAvailable = liquidityAvailable - newDistributions;
        LPShares.burn(totalWithdrawRequestedShares);
        totalWithdrawRequestedShares = 0;
        currentEpoch.isResolved = true;
        startNewEpoch();
    }

    function allExpiredOptionsResolved() public view returns(bool) {
        for (uint i; i< calls.length; i++) {
            if (!expiryIsResolved[calls[i].expiry]) {
                return false;
            }
        }
        return true;
    }
    function isITM(uint256 strike, uint256 priceAtExpiry, bool isCall) public pure returns(bool) {
        if (isCall && (priceAtExpiry > (strike * 1 ether))) {
            return true;
        } else if (!isCall && (priceAtExpiry < (strike * 1 ether))) {
            return true;
        } else {
            return false;
        }
    }
    function resolveOption(uint256 expiry, uint256 strike, bool isCall, uint256 priceAtExpiry) private {
        uint256 tokenId = OptionCollection.getOptionTokenId(expiry, strike, isCall);
        // require(
        //     !optionIsResolved[tokenId],
        //     "Option is already resolved"
        // );
        uint256 optionSupplyOutstanding = OptionCollection.totalSupply(tokenId);
        poolCollateral = poolCollateral - (optionSupplyOutstanding * 1 ether);
        bool expiredITM = isITM(strike, priceAtExpiry, isCall);
        if (expiredITM) {
            realizedLoss = realizedLoss + (optionSupplyOutstanding * 1 ether);
        } else {
            liquidityAvailable = liquidityAvailable + (optionSupplyOutstanding * 1 ether);
        }
        optionExpiredITM[tokenId] = expiredITM;
        emit OptionResolved(tokenId, expiredITM);
    }
    // priceAtExpiry is in wei units
    function resolveExpiredOptions(uint256 expiry, uint256 priceAtExpiry) onlyOwner public {
        require(
            expiry < block.timestamp,
            "Option has not expired yet"
        );
        require(
            !expiryIsResolved[expiry],
            "Expiry is already resolved"
        );
        for (uint i; i < calls.length; i++) {
            // Assumption: puts and calls have the same expiry
            if (calls[i].expiry == expiry) {
                resolveOption(expiry, calls[i].one_delta, true, priceAtExpiry);
                resolveOption(expiry, calls[i].ten_delta, true, priceAtExpiry);
                resolveOption(expiry, calls[i].twenty_five_delta, true, priceAtExpiry);
                resolveOption(expiry, calls[i].fifty_delta, true, priceAtExpiry);
                resolveOption(expiry, puts[i].one_delta, false, priceAtExpiry);
                resolveOption(expiry, puts[i].ten_delta, false, priceAtExpiry);
                resolveOption(expiry, puts[i].twenty_five_delta, false, priceAtExpiry);
                resolveOption(expiry, puts[i].fifty_delta, false, priceAtExpiry);
                // resolve each option
                expiryIsResolved[expiry] = true;
                if (allExpiredOptionsResolved()) {
                    endEpoch();
                }
            }
        } 
    }

    function buyOption(uint256 expiry, uint256 strike, uint256 amount, bool isCall) public {
        // Checks Option is in Epoch
        require(
            isOptionValidInEpoch(strike, expiry, isCall),
            "Option not valid in this Epoch"
        );
        require(
            expiry > block.timestamp,
            "Option Already Expired"
        );
        // Check if Maximum Contracts purchased would be exceeded
        require(
            amount <= maxContractsAvailable(expiry, strike, isCall),
            "Purchase would exceed maxContractsAvailable"
        );
        uint256 tokenId = OptionCollection.getOptionTokenId(expiry, strike, isCall);
        uint256 price = getPrice(expiry, strike, isCall);
        require(
            price > 0,
            "No Free Lunch"
        );
        //Maybe check approval before transferFrom
        //TODO: add safemath?
        uint256 cost = amount*price;
        require(
            USDC.transferFrom(msg.sender, address(this), cost),
            "USDC premium payment failed"
        );
        //TODO: Ensure this executes
        OptionCollection.mint(msg.sender, tokenId, amount);
        liquidityAvailable = liquidityAvailable - ((amount * 1 ether) - cost);
        poolCollateral += (amount * 1 ether);

        emit OptionPurchased(msg.sender, tokenId);
    }

    // TODO: Add a function for user to exercise all of their winning options
    function exerciseOption(uint256 tokenId, uint256 amount) public {
        // Move these checks to seperate function? 
        require(
            optionExpiredITM[tokenId] == true,
            "Option expired out of the money"
        );
        
        OptionCollection.burn(msg.sender, tokenId, amount);
        USDC.transfer(msg.sender, (amount * 1 ether));
        realizedLoss = realizedLoss - (amount * 1 ether);
    }

    function exerciseBatch(uint256[] memory ids, uint256[] memory amounts) public virtual {
        uint256 payout = 0;
        for (uint i; i < ids.length; i++) {
            require(
                optionExpiredITM[ids[i]] == true,
                "Option Expired Out of the money"
            );
            payout += (amounts[i] * 1 ether);
        }
        OptionCollection.burnBatch(msg.sender, ids, amounts);
        USDC.transfer(msg.sender, payout);
        realizedLoss = realizedLoss - payout;
    }

    function getPrice(uint256 expiry, uint256 strike, bool isCall) public view returns(uint256) {
        if(expiry > block.timestamp) {
            return (oracle.optionPrice(isCall, strike, expiry) * 1 ether) / 100;
            
        } else {
            require(
                expiryIsResolved[expiry],
                "Expiry is not resolved"
            );
            if(optionExpiredITM[OptionCollection.getOptionTokenId(expiry, strike, isCall)]) {
                return 1 ether;                                                                                         
            } else {
                return 0;
            }
        }
    }
    
    // max contracts underwritable by pool at current price and liquidity
    function maxContractsAvailable(uint256 expiry, uint256 strike, bool isCall) public view returns(uint256) {
        uint256 collateral_required_per_contract = 1 ether - getPrice(expiry, strike, isCall);
        // Check Precision of division here
        return liquidityAvailable / collateral_required_per_contract;
    }

    
    function navByStrike(uint256 expiry, uint256 strike, bool isCall) public view returns(uint256) {
        uint256 netValue = (
            1 ether - getPrice(expiry, strike, isCall)
        ) * OptionCollection.totalSupply(
            OptionCollection.getOptionTokenId(
                expiry, strike, isCall 
            )
        );
        return netValue;
    }
    // function netValueOfOutstandingOptionsByExpiry(Expiry memory expiry, bool isCall) public view returns(uint256) {
    //     uint256 expire_time = expiry.expiry;
    //     return navByStrike(expire_time, expiry.ten_delta, isCall) + navByStrike(expire_time, expiry.twenty_five_delta, isCall) +navByStrike(expire_time, expiry.fifty_delta, isCall);
    //     
    // }

    function LPValueOfCalls() public view returns(uint256) {
        uint256 netValue = 0;
        for (uint i; i < calls.length; i++) {
            //Expiry memory this_expiry = currentEpoch.calls[i];
            netValue = netValue + (
                navByStrike(
                    calls[i].expiry, calls[i].one_delta, true
                ) + navByStrike(
                    calls[i].expiry, calls[i].ten_delta, true
                ) + navByStrike(
                    calls[i].expiry, calls[i].twenty_five_delta, true
                ) + navByStrike(
                    calls[i].expiry, calls[i].fifty_delta, true
                )
            );
        }
        return netValue;
    }

    function LPValueOfPuts() public view returns(uint256) {
        uint256 netValue = 0;
        for (uint i; i < puts.length; i++) {
            // Expiry memory this_expiry = currentEpoch.puts[i];
            netValue = netValue + (
                navByStrike(
                    puts[i].expiry, puts[i].one_delta, false
                ) + navByStrike(
                    puts[i].expiry, puts[i].ten_delta, false
                ) + navByStrike(
                    puts[i].expiry, puts[i].twenty_five_delta, false
                ) + navByStrike(
                    puts[i].expiry, puts[i].fifty_delta, false
                )
            );
        }
        return netValue;
    }

    function LPValueOfOptions() public view returns(uint256){
        // Add current (1 - currentPrice) * total supply of outstanding options
        return LPValueOfCalls() + LPValueOfPuts(); 
    }

    function LPEquity() public view returns(uint256) {
        return LPValueOfOptions() + liquidityAvailable;
    }
        
    function liquidityDeposit(uint256 amount) public {

        require(
            !isSuspended(),
            "Deposits Suspended Temporarily"
        );
        uint256 currentLPEquity = LPEquity();
        uint256 outstandingShares = LPShares.totalSupply();
        // Add precision for Floating Point
        if (outstandingShares > 0) {
            uint256 equityPerShare = ((currentLPEquity * 1 ether) / outstandingShares);
            uint256 new_shares = ((amount * 1 ether) / equityPerShare);
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

    function isWithdrawPending(address account) public view returns(bool) {
        if (
            !withdrawRequested[msg.sender].isClaimed &&
            withdrawRequested[msg.sender].epochEndTime < currentEpoch.endTime &&
            withdrawRequested[msg.sender].amount > 0
        ) {
            return true;
        } else {
            return false;
        }
    }

    function requestLiquidityWithdraw(uint256 amount) public {
        if (isWithdrawPending(msg.sender)) {
            withdrawLiquidity();
        }
        require(
            LPShares.transferFrom(msg.sender, address(this), amount),
            "LPShares Transfer Failed"
        );
        withdrawRequested[msg.sender] = Withdrawal(amount, currentEpoch.endTime, false);
        totalWithdrawRequestedShares += amount;
        
    }

    function withdrawLiquidity() public {
        require(
            withdrawRequested[msg.sender].epochEndTime < currentEpoch.endTime,
            "Epoch not ended yet"
        );
        require(
            !withdrawRequested[msg.sender].isClaimed,
            "Withdrawal Already Claimed"
        );
        uint256 distributionPerShare = epochDistributionPerShare[withdrawRequested[msg.sender].epochEndTime];
        uint256 user_shares_pending = withdrawRequested[msg.sender].amount;
        uint256 distribution = (user_shares_pending * distributionPerShare) / 1 ether;
        require(
            USDC.transfer(msg.sender, distribution),
            "USD: Distribution Transfer Failed"
        );
        totalUSDCPendingWithdraw = totalUSDCPendingWithdraw - distribution;
        withdrawRequested[msg.sender].isClaimed = true;
    }

}
