require("@nomicfoundation/hardhat-toolbox");
import { time } from "@nomicfoundation/hardhat-network-helpers";
require('axios')
import axios from 'axios';

const {
  ether
} = require("@openzeppelin/test-helpers");

task("resolveOption", "Resovles an expired Option")
  .addPositionalParam("optinoAddress")
  .setAction(async(taskArgs, hre) => {
  const ethers = hre.ethers;
  const delay = function(ms: number) {
    return new Promise( resolve => setTimeout(resolve, ms) );
  }
  const getPrice = async function (expiry) {
    let pro_key = "xxx"
    let sandbox_key = "b54bcf4d-1bca-4e8e-9a24-22ff2c3d462c"
    let sand_box = 'sandbox-api.coinmarketcap.com/'
    let pro_api = 'pro-api.coinmarketcap.com/'
    let start = expiry
    let end = start+1
    try {
      const response = await axios.get('https://'+ sand_box + '/v3/cryptocurrency/quotes/historical', {
        params: { symbol: "ETH", time_start: start, time_end: end, count: 1, interval: "5m", aux: "price" },
        headers: {
          "X-CMC_PRO_API_KEY": sandbox_key
        }

      });
      // console.log(response.data)
      // console.log(response.data.data.ETH.quotes[0].quote)
      // console.log(response.data.data.ETH.quotes[0].quote.USD.price)
      return ether(response.data.data.ETH.quotes[0].quote.USD.price.toString())
      // return response
    } catch (exception) {
      // console.log(exception.response)
      process.stderr.write(`ERROR received from getPrice: ${exception}\n`);
    }

  }
  const mockPrice = async function (expiry) {
    return ether("1750")
  }

  const Optino = await ethers.getContractFactory("Optino");
  const optino = await Optino.attach(taskArgs.optinoAddress);
  
  while (true) {
    //console.log("Is Polling")
    console.log( (await time.latest()) )
    let six_hours = (await optino.calls(0)).expiry
    let twelve_hours = (await optino.calls(1)).expiry
    let twenty_four_hours = (await optino.calls(2)).expiry
    let now = await time.latest();
    //console.log(  )
    // console.log((await getPrice(now)).toString())
    let price;
    if(now > six_hours) {
      let isResolved = await optino.expiryIsResolved(six_hours)
      if (!isResolved) {
        console.log("Resolving: ", six_hours)
        price = await getPrice(six_hours)
        // price = await mockPrice(six_hours)
        await optino.resolveExpiredOptions(six_hours, price.toString())
        console.log("Resolved: ", six_hours, " at price: ", price.toString())
      }
    }
    if(now > twelve_hours) {
      let isResolved = await optino.expiryIsResolved(twelve_hours)
      if (!isResolved) {
        console.log("Resolving: ", twelve_hours)
        price = await getPrice(twelve_hours)
        // price = await mockPrice(twelve_hours)
        await optino.resolveExpiredOptions(twelve_hours, price.toString())
        console.log("Resolved: ", twelve_hours, " at price: ", price.toString())
      }
    }
    if(now > twenty_four_hours) {
      let isResolved = await optino.expiryIsResolved(twenty_four_hours)
      if (!isResolved) {
        console.log("Resolving: ", twenty_four_hours)
        price = await getPrice(twenty_four_hours)
        await optino.resolveExpiredOptions(twenty_four_hours, price.toString())
        console.log("Resolved: ", twenty_four_hours, " at price: ", price.toString())
      }
    }

    // 60 minutes: 60000 * 60 
    let sixty_minutes = 60000 * 60 
    await delay((sixty_minutes))


  }
  
  
  // await optino.resolveExpiredOptions(1234, ether("1750").toString())
  // console.log("resolved expiry: ", 1234)
});
