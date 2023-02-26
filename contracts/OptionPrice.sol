// SPDX-License-Identifier: MIT
pragma solidity ^0.8.8;

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "hardhat/console.sol";


contract OptionPrice {


    uint8[100] public cdf_data = [50, 52, 53, 54, 55, 56, 58, 59, 60, 61, 62, 63, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 80, 81, 82, 83, 84, 84, 85, 86, 86, 87, 88, 88, 89, 90, 90, 91, 91, 92, 92, 93, 93, 93, 94, 94, 95, 95, 95, 96, 96, 96, 96, 97, 97, 97, 97, 98, 98, 98, 98, 98, 98, 99, 99, 99, 99, 99, 99, 99, 99, 99, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100]; 


    function getPrice() public view returns (uint256) {
        // Goerli ETH / USD Address
        // https://docs.chain.link/docs/ethereum-addresses/
        AggregatorV3Interface priceFeed = AggregatorV3Interface(
            0xD4a33860578De61DBAbDc8BFdb98FD742fA7028e
        );
        (, int256 answer, , , ) = priceFeed.latestRoundData();
        // ETH/USD rate in 18 digit
        return uint256(answer * 10000000000);
        // or (Both will do the same thing)
        // return uint256(answer * 1e10); // 1* 10 ** 10 == 10000000000
    }

    // 1000000000
    function getConversionRate(uint256 ethAmount)
        public
        view
        returns (uint256)
    {
        uint256 ethPrice = getPrice();
        uint256 ethAmountInUsd = (ethPrice * ethAmount) / 1000000000000000000;
        // or (Both will do the same thing)
        // uint256 ethAmountInUsd = (ethPrice * ethAmount) / 1e18; // 1 * 10 ** 18 == 1000000000000000000
        // the actual ETH/USD conversion rate, after adjusting the extra 0s.
        return ethAmountInUsd;
    }


    function sqrt(uint y) public view returns (uint z) {
        if (y > 3) {
            z = y;
            uint x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
        return z;
    }

    function optionPrice(bool is_call , uint strike_price , uint expire_timestamp) public view returns(uint256) {
        // use random walk model and discrete guassian table to calculate probability
        // returns 100*delta , for example , 0.2 call returns 20

        uint now_price = getConversionRate(1);

        bool need_reverse = false;


        uint diff_mul_thousand;
        if (strike_price > now_price) {
            diff_mul_thousand = (strike_price - now_price) * 1000;
            if (is_call) {
                need_reverse = true;
            }
        }
        else {
            diff_mul_thousand = (now_price - strike_price) * 1000;
            if (!is_call) {
                need_reverse = true;
            }
        }
        
        uint second_volatility_mul_thousand = now_price * 1000 / sqrt(86400*365);
        uint seconds_until_expire = expire_timestamp - block.timestamp;
        uint volatility_until_expire = sqrt(seconds_until_expire) * second_volatility_mul_thousand;
        uint z_score = diff_mul_thousand * 100 / volatility_until_expire;

        uint z_score_index = z_score / 3;

        uint prob;
        if (z_score_index > 99) {
            prob = 100;
        }
        else {
            prob = cdf_data[z_score_index];
        }

        if (need_reverse) {
            prob = 100 - prob;
        }


        return prob;
    }
}