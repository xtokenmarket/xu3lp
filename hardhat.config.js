require('@nomiclabs/hardhat-ethers');
require('@nomiclabs/hardhat-web3');
require('@nomiclabs/hardhat-waffle');
require('hardhat-deploy');
require('hardhat-deploy-ethers');
require('solidity-coverage')
require('@openzeppelin/hardhat-upgrades');

module.exports = {
  networks: {
    hardhat: {
      gas: 12000000,
      blockGasLimit: 0x1fffffffffffff,
      allowUnlimitedContractSize: true,
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
}
}
