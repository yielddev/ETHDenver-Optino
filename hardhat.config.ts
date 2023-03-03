import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "./scripts/advanceTime.ts"
import "./scripts/resolveOptionTask.ts"

const config: HardhatUserConfig = {
  solidity: "0.8.17",
  networks:{
    hardhat: {

    },
    goerli: {
      url: "https://eth-goerli.nodereal.io/v1/7317fd4c827945d3ae81a93c1d1442ea",

    },

  }
};

export default config;
