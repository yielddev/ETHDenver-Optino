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
    OptionPrice public oracle = OptionPrice(0x2a8cEabFE96Cd8E780c84296AE9a0E100fc12B93);
    Expiry[3] public calls;
    Expiry[3] public puts;

    uint256 public liquidityAvailable;
    uint256 public poolCollateral;
    uint256 public realizedLoss;

    //Map the results of option after expiry
    mapping (uint256 => bool) public optionExpiredITM;
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

    

    constructor(address _usdc, uint256 startTime) {
        USDC = ERC20(_usdc); 
        LPShares = new OptinoLPShares();
        OptionCollection = new OptionContract(); 
        currentEpoch = Epoch({
            startTime: 0,
            endTime: 0,
            isResolved: true,
            referencePrice: 0
        });
        startNewEpoch(startTime);  
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

    // Rewrite to use recalculation of strike based on exp and starttime
    function strikeIsInEpoch(uint256 strike, uint256 expiry, bool isCall) public view returns(bool) {
        if (isCall) {
            for (uint i; i < calls.length; i++) {
                if (calls[i].expiry == expiry) {
                    if (
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

    // is this read only?
    function getDelta(bool isCall, uint256 expiry, uint256 delta) public view returns(uint256) {
        return oracle.optionStrikePriceWithCertainProb(isCall, expiry, delta);
    }

    function startNewEpoch(uint256 startTime) onlyOwner public {
        // TODO: change block.timestamp to some value in the future?
        // add puts
        // add 3 other deltas, refactor?
        // uint256 current_time = block.timestamp;
        require(
            currentEpoch.isResolved,
            "CurrentEpoch not resolved"
        );
        currentEpoch = Epoch({
            startTime: startTime,
            endTime: startTime+(24 hours),
            isResolved: false,
            referencePrice: oracle.getPrice()
        });
        calls[0] = Expiry({
                    expiry: startTime+(6 hours),
                    ten_delta: getDelta(true, startTime+(6 hours), 100),
                    twenty_five_delta: getDelta(true, startTime+(6 hours), 250),
                    fifty_delta: getDelta(true, startTime+(6 hours), 500)
        });
        calls[1] = Expiry({
                    expiry: startTime+(12 hours),
                    ten_delta: getDelta(true, startTime+(12 hours), 100),
                    twenty_five_delta: getDelta(true, startTime+(12 hours), 250),
                    fifty_delta: getDelta(true, startTime+(12 hours), 500)
        });
        calls[2] = Expiry({
                    expiry: startTime+(24 hours),
                    ten_delta: getDelta(true, startTime+(24 hours), 100),
                    twenty_five_delta: getDelta(true, startTime+(24 hours), 250),
                    fifty_delta: getDelta(true, startTime+(24 hours), 500)
        });

        puts[0] =  Expiry({
                    expiry: startTime+(6 hours),
                    ten_delta: getDelta(false, startTime+(6 hours), 100),
                    twenty_five_delta: getDelta(false, startTime+(6 hours), 250),
                    fifty_delta: getDelta(false, startTime+(6 hours), 500)
        });

        puts[1] = Expiry({
                    expiry: startTime+(12 hours),
                    ten_delta: getDelta(false, startTime+(12 hours), 100),
                    twenty_five_delta: getDelta(false, startTime+(12 hours), 250),
                    fifty_delta: getDelta(false, startTime+(12 hours), 500)
        });

        puts[2] = Expiry({
                    expiry: startTime+(24 hours),
                    ten_delta: getDelta(false, startTime+(24 hours), 100),
                    twenty_five_delta: getDelta(false, startTime+(24 hours), 250),
                    fifty_delta: getDelta(false, startTime+(24 hours), 500)
        });
                
        
    }
    function endEpoch() onlyOwner public {
        // add precision
        epochDistributionPerShare[currentEpoch.endTime] = LPEquity() / LPShares.totalSupply();
        uint256 newDistributions = (epochDistributionPerShare[currentEpoch.endTime] * totalWithdrawRequestedShares);
        totalUSDCPendingWithdraw += newDistributions;
        liquidityAvailable = liquidityAvailable - newDistributions;
        LPShares.burn(totalWithdrawRequestedShares);
        totalWithdrawRequestedShares = 0;
        currentEpoch.isResolved = true;
    }
    // TODO: expiredITM arg should be oracle?
    function resolveOption(uint256 expiry, uint256 strike, bool isCall, bool expiredITM) onlyOwner public {
        // Checks Option is in Epoch 
        require(
            isOptionValidInEpoch(strike, expiry, isCall),
            "Option not Valid in this Epoch"
        );
        require(
            expiry < block.timestamp,
            "Option has not expired yet"
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
            "Option expired out of the money"
        );
        
        OptionCollection.burn(msg.sender, tokenId, amount);
        USDC.transfer(msg.sender, (amount * 1 ether));
        realizedLoss = realizedLoss - (amount * 1 ether);
    }

    function getPrice(uint256 expiry, uint256 strike, bool isCall) public view returns(uint256) {
        return (oracle.optionPrice(isCall, strike, expiry) * 1 ether) / 100;
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
                    puts[i].expiry, puts[i].ten_delta, true
                ) + navByStrike(
                    puts[i].expiry, puts[i].twenty_five_delta, true
                ) + navByStrike(
                    puts[i].expiry, puts[i].fifty_delta, true
                )
            );
        }
        return netValue;
    }

    function LPValueOfOptions() public view returns(uint256){
        // Add current (1 - currentPrice) * total supply of outstanding options
        return LPValueOfCalls() + LPValueOfPuts(); 
    }

    function LPEquity() public returns(uint256) {
        return LPValueOfOptions() + liquidityAvailable;
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
        uint256 distribution = user_shares_pending * distributionPerShare;
        require(
            USDC.transfer(msg.sender, distribution),
            "USD: Distribution Transfer Failed"
        );
        totalUSDCPendingWithdraw = totalUSDCPendingWithdraw - distribution;
        withdrawRequested[msg.sender].isClaimed = true;
    }

    // function liquidityWithdraw(uint256 amount) public {
    //     
    //     uint256 currentLPEquity = LPEquity();
    //     uint256 outstandingShares = LPShares.totalSupply();

    //     // Add precision
    //     uint256 equityPerShare = currentLPEquity / outstandingShares;
    //     uint256 distribution = amount * equityPerShare;
    //     
    //     LPShares.burnFrom(msg.sender, amount);
    //     require(
    //         USDC.transfer(msg.sender, distribution),
    //         "USD: Distribution Transfer Fails"
    //     );

    //     liquidityAvailable = liquidityAvailable - distribution;
    // }
}
