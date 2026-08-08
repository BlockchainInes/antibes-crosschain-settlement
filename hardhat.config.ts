import "dotenv/config";

import {
  configVariable,
  defineConfig,
} from "hardhat/config";

import hardhatToolboxMochaEthers from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import hardhatVerify from "@nomicfoundation/hardhat-verify";

export default defineConfig({
  plugins: [
    hardhatToolboxMochaEthers,
    hardhatVerify,
  ],

  solidity: {
    version: "0.8.30",
    settings: {
      optimizer: {
        enabled: true,
        runs: 1000,
      },
      viaIR: true,
    },
  },

  networks: {
    sepolia: {
      type: "http",
      chainType: "l1",
      url: configVariable("SEPOLIA_RPC_URL"),
      accounts: [
        configVariable("DEPLOYER_PRIVATE_KEY"),
      ],
    },
  },

  verify: {
    etherscan: {
      apiKey: configVariable("ETHERSCAN_API_KEY"),
    },
  },

  test: {
    mocha: {
      timeout: 20_000,
    },
  },
});