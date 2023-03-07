// Import dependencies available in the autotask environment
import { RelayerParams } from 'defender-relay-client/lib/relayer';
import { DefenderRelayProvider, DefenderRelaySigner } from 'defender-relay-client/lib/ethers';
import { ethers } from 'ethers';
import axios from 'axios';


// Import an ABI which will be embedded into the generated js
import Optino from '../Optino.json';
const Oracle = [{inputs:[],name: "getPrice",outputs:[{internalType: "uint256",name: "",type: "uint256"}],stateMutability:"view",type:"function"}]

// Import a dependency not present in the autotask environment which will be included in the js bundle
import isOdd from 'is-odd';

// Address of the DAI contract (for this example)
const optino_address = `0xC9B2caf52bF6252478B708350D9eAaae195D3EB6`;
const oracle_address = `0xe6759553714F52B2EDDdd5a8B90E9F221f198870`;
const findNextBlock = async function(expiry, lastBlock, provider) {
  let block_found = false;
  let difference = (lastBlock.timestamp - expiry);
  let searchBlock: number = lastBlock.number - difference;
  while (!block_found) {
    let last_block_object = await provider.getBlock(searchBlock)
    let next_block_object = await provider.getBlock(searchBlock+1)
    if(
      last_block_object.timestamp <= expiry &&
      expiry < next_block_object.timestamp)
    {
      block_found = true;
    } else {
      if (next_block_object.timestamp < expiry) {
        searchBlock += 2
      } else if (last_block_object.timestamp > expiry) {
        searchBlock = searchBlock -1
      }
    }

  }
  return searchBlock+1
}
const priceFromOracle = async function (expiry, lastBlock, archive_provider) {
  const oracle = new ethers.Contract(oracle_address, Oracle, archive_provider)
  let blockExpiry = findNextBlock(expiry, lastBlock, archive_provider)
  let price = oracle.getPrice({blockTag: blockExpiry})
  return price
}

const getPrice = async function (expiry) {
  let pro_key = "2304c863-4000-42d8-8afb-2874f107b54c"
  let sandbox_key = "b54bcf4d-1bca-4e8e-9a24-22ff2c3d462c"
  let sand_box = 'sandbox-api.coinmarketcap.com'
  let pro_api = 'pro-api.coinmarketcap.com'
  let start = expiry - (60*1)
  let end = start + (60*6)
  try {
    const response = await axios.get('https://'+ pro_api + '/v3/cryptocurrency/quotes/historical', {
      params: { symbol: "ETH", time_start: start, time_end: end, count: 1, interval: "5m", aux: "price" },
      headers: {
        "X-CMC_PRO_API_KEY": pro_key
      }
  
    });
    // console.log(response.data)
    // console.log(response.data.data.ETH.quotes[0].quote)
    // console.log(response.data.data.ETH.quotes[0].quote.USD.price)
    //
    //let ether_price = response.data.data.ETH[0].quotes[0].quote.USD.price
  
    // console.log(ether_price)
    // console.log(Math.round(ether_price))
    // let rounded = Math.round(ether_price)
    // console.log(rounded)

    //return response.data.data.ETH[0]
    let ether_price = response.data.data.ETH[0].quotes[0].quote.USD.price
    //if (ether_price != undefined) {
    return ethers.utils.parseUnits(ether_price.toString(), "ether")
    //} else {
    //  return "Price Returned undefined"
    //}
    // return Math.round(ether_price)
    // return response
  } catch (exception) {
    // console.log(exception.response)
    process.stderr.write(`ERROR received from getPrice: ${exception}\n`);
  }

}
// Entrypoint for the Autotask
export async function handler(credentials: RelayerParams) {
  const provider = new DefenderRelayProvider(credentials);
  const signer = new DefenderRelaySigner(credentials, provider, { speed: 'fast' });
  const optino = new ethers.Contract(optino_address, Optino.abi, signer);
  // const atto: ethers.BigNumber = await dai.totalSupply();
  //const supply: number = Math.ceil(atto.div(1e18.toString()).toNumber());
  //const parity = isOdd(supply) ? 'odd' : 'even';
  // console.log(`DAI total supply is ${supply} (${parity})`);
  
  let six_hours = (await optino.calls(0)).expiry
  let twelve_hours = (await optino.calls(1)).expiry
  let twenty_four_hours = (await optino.calls(2)).expiry

  let latestBlock = await provider.getBlockNumber();
  let block = await provider.getBlock(latestBlock-1);
  let now = block.timestamp
  console.log("now: ", now)
  // console.log("block: ", latestBlock)
  // console.log("block: ", latestBlock-100) //block.sub(ethers.BigNumber.from("100")))
  //console.log("current price: ", (await getPrice(now-(60*5))))
  //console.log((await priceFromOracle(now-(5*60), block, provider)).toString())
  // console.log((await getPrice(now-(5*60))).toString())
  // console.log((await getPrice(six_hours)).toString())
  let price;
  if(now-(60*5) > six_hours) {
    let isResolved = await optino.expiryIsResolved(six_hours)
    if (!isResolved) {
      console.log("Resolving: ", six_hours)
      price = await getPrice(six_hours)
      console.log(price.toString())
      // price = await mockPrice(six_hours)
      await optino.resolveExpiredOptions(six_hours, price.toString())
      console.log("Resolved: ", six_hours, " at price: ", price.toString())
    }
  }
  if(now-(60*5) > twelve_hours) {
    let isResolved = await optino.expiryIsResolved(twelve_hours)
    if (!isResolved) {
      console.log("Resolving: ", twelve_hours)
      price = await getPrice(twelve_hours)
      // price = await mockPrice(twelve_hours)
      await optino.resolveExpiredOptions(twelve_hours, price.toString())
      console.log("Resolved: ", twelve_hours, " at price: ", price.toString())
    }
  }
  if(now-(60*5) > twenty_four_hours) {
    let isResolved = await optino.expiryIsResolved(twenty_four_hours)
    if (!isResolved) {
      console.log("Resolving: ", twenty_four_hours)
      price = await getPrice(twenty_four_hours)
      await optino.resolveExpiredOptions(twenty_four_hours, price.toString())
      console.log("Resolved: ", twenty_four_hours, " at price: ", price.toString())
    }
  }

  console.log("Expired Option Check Complete")
}

// Sample typescript type definitions
type EnvInfo = {
  API_KEY: string;
  API_SECRET: string;
}

// To run locally (this code will not be executed in Autotasks)
if (require.main === module) {
  require('dotenv').config();
  const { API_KEY: apiKey, API_SECRET: apiSecret } = process.env as EnvInfo;
  handler({ apiKey, apiSecret })
    .then(() => process.exit(0))
    .catch((error: Error) => { console.error(error); process.exit(1); });
}
