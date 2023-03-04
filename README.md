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
