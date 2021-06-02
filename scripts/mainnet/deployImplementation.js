const { ethers } = require("hardhat");
const { deploy } = require("../helpers");
const addresses = require('../uniswapAddresses.json').mainnet;

const UniFactory = require('@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json');

/**
 * Deploy and initialize xU3LP Implementation on mainnet
 * Initializes with xU3LPa details: DAI/USDC as pool
 */
async function deployImplementation() {
    let [admin] = await ethers.getSigners();
    console.log('deploying xU3LP from', admin.address);
    let xU3LP = await deploy('xU3LPStable');
    await xU3LP.deployed();
    console.log('xu3lp deployed at:', xU3LP.address);


    // Initialize implementation with xU3LPa details
    let token0 = await ethers.getContractAt('DAI', '0x6b175474e89094c44da98b954eedeac495271d0f');
    let token1 = await ethers.getContractAt('USDC', '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48');
    const uniFactory = await ethers.getContractAt(UniFactory.abi, addresses.v3CoreFactoryAddress);
    const poolAddress = await uniFactory.getPool(token0.address, token1.address, 500);
    if(!poolAddress) {
      console.log('pool not found, exiting script');
      return;
    }
    let tx = await xU3LP.initialize('xU3LP', -10, 10, token0.address, token1.address, 
        poolAddress, addresses.swapRouter, addresses.nonfungibleTokenPositionManagerAddress, 
        {mintFee: 1000, burnFee: 1000, claimFee: 50}, 200, 18, 6);
    await tx.wait();
    console.log('initialized xU3LP');
}

deployImplementation()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
});