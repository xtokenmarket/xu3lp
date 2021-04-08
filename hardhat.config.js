require('@nomiclabs/hardhat-ethers');
require('hardhat-deploy');
require('hardhat-deploy-ethers');
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
      runs: 800,
    }
  }
}
}
