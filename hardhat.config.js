require('@nomiclabs/hardhat-ethers');
require('@nomiclabs/hardhat-web3');
require('@nomiclabs/hardhat-waffle');
require("@nomiclabs/hardhat-etherscan");
require('hardhat-deploy');
require('hardhat-deploy-ethers');
require('solidity-coverage');
require('hardhat-contract-sizer');
require('dotenv').config();

module.exports = {
  networks: {
    hardhat: {
			forking: {
				url: process.env.ALCHEMY_URL,
        enabled: false
			}
    },
    mainnet: {
      url: process.env.ALCHEMY_URL,
      accounts: [process.env.ADMIN_PRIVATE_KEY]
    }
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY
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
