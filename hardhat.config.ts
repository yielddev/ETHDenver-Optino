import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "./scripts/advanceTime.ts"
import "./scripts/resolveOptionTask.ts"
import "./scripts/OptinoInfo.ts"
import "./scripts/provideLiquidity.ts"
import "./scripts/TransferOwnership.ts"

const config: HardhatUserConfig = {
  solidity: "0.8.17",
  networks:{
    hardhat: {

    },
    goerli: {
      url: "https://eth-goerli.nodereal.io/v1/7317fd4c827945d3ae81a93c1d1442ea",
      accounts: [],
      gasPrice: 3000000000
    },
    goerliarb: {
      url: "https://skilled-twilight-field.arbitrum-goerli.discover.quiknode.pro/db01000c063395e52eaf0a8d478e5860807cc690/",
      accounts: [],
      // gasPrice: 30000000,
      // gasMultiplier: 1
    }

  },
};

export default config;
