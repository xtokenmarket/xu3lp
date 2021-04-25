require('@nomiclabs/hardhat-ethers');
require('@nomiclabs/hardhat-web3');
require('@nomiclabs/hardhat-waffle');
require('hardhat-deploy');
require('hardhat-deploy-ethers');
require('solidity-coverage');
require('hardhat-contract-sizer');
require('@openzeppelin/hardhat-upgrades');
require('dotenv').config();

module.exports = {
  networks: {
    hardhat: {
      // comment out for local testing
			// uncomment for fork script
			// forking: {
			// 	url: process.env.ALCHEMY_URL
			// }
    },
  },
  solidity: {
    version: '0.7.6',
    settings: {
      optimizer: {
        enabled: true,
        runs: 100,
      }
    }
  },
  contractSizer: {
    alphaSort: true,
    runOnCompile: true,
  }
}
