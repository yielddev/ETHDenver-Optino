# Info

We build a option product which settle to 0 or 1 based on its underlying asset’s price on expiration date. Traders receive a payout if the option expires in the money and incur a loss if it expires out of the money.


For example , a trader buy a ETH-2000-CALL that will expire on April 1 , 2023 , at 12:00am . So when we come to expire time , if ETH price aboves 2000 , the option will settle to 1 , if ETH price belows 2000 , the option will settle to 0. 

The option price is determined at the time of purchase based on the probability that the option will be in-the-money at expiry. This pricing model is written in solidity and utilizes a Chainlink price feed oracle.

Options are settled after expiry using an off chain price API to determine the ether price at the specific expiry time. This settlement task is run periodically via OpenZeppelin Defender autotasks and the transactions to update the options with off chain settlement data are executed with OpenZeppelin relays for added security. 

As for trader's counterparty , liquidity provider stake money into pool . When trader makes money , the LP incur a loss . When trader lose money , the LP can realize the profit. Unlike traditional option , the upside of call is limited , so the LP has a limited risk and realizes a more stable earning.


# Scripts 

Get all option prices 

`npx hardhat OptinoInfo --network goerliarb 0xC9B2caf52bF6252478B708350D9eAaae195D3EB6`

Provide Liquidity

`npx hardhat provideLiquidity --network goerliarb 0xC9B2caf52bF6252478B708350D9eAaae195D3EB6`

# Local Testing 


run forked node 

`npx hardhat node --fork https://eth-goerli.nodereal.io/v1/[API_KEY]`

`npx hardhat run scripts/LocalDeploy.ts --network localhost`


# Sample Hardhat Project

This project demonstrates a basic Hardhat use case. It comes with a sample contract, a test for that contract, and a script that deploys that contract.

Try running some of the following tasks:

```shell
npx hardhat help
npx hardhat test
REPORT_GAS=true npx hardhat test
npx hardhat node
npx hardhat run scripts/deploy.ts
```
