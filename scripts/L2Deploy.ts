import { ethers } from "hardhat";
const {
    BN,
    constants,
    ether,
} = require("@openzeppelin/test-helpers")


async function main() {
  const OptionPrice = await ethers.getContractFactory("OptionPrice")
  //const option_price = await OptionPrice.attach("0x2a8cEabFE96Cd8E780c84296AE9a0E100fc12B93")
  // Arbitrum Goerli 0x62CAe0FA2da220f43a51F86Db2EDb36DcA9A5A08
  const option_price = await OptionPrice.deploy("0x62CAe0FA2da220f43a51F86Db2EDb36DcA9A5A08")

  const USDC = await ethers.getContractFactory("USDC")
  const usdc = await USDC.deploy()

  const Optino = await ethers.getContractFactory("Optino")
  const optino = await Optino.deploy(usdc.address, option_price.address)


  const OptionContract = await ethers.getContractFactory("OptionContract")
  const option_contract_address = await optino.OptionCollection();
  
  const lp_shares_address = await optino.LPShares();

  const mock_users = await ethers.getSigners()

  await usdc.mint(mock_users[0].address, ether("1000000000").toString())
  //await usdc.mint(mock_users[0].address, ether("1000").toString())
  //await usdc.mint(mock_users[1].address, ether("1000").toString())
  //await usdc.mint(mock_users[2].address, ether("1000").toString())
  //await usdc.mint(mock_users[3].address, ether("1000").toString())
  //await usdc.mint(mock_users[4].address, ether("1000").toString())

  


  console.log("Optino Contract: ", optino.address)
  console.log("Mock USDC: ", usdc.address)
  console.log("LPShares: ", lp_shares_address)
  console.log("Option Contracts: ", option_contract_address)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
