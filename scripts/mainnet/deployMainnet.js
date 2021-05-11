const { ethers } = require('hardhat');
const { deploy, deployArgs, printPositionAndBufferBalance, bnDecimal, getTokenPrices } = require('../helpers');
const addresses = require('../uniswapAddresses.json').mainnet;
require('dotenv').config();

const swapRouter = require('@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json')
const NFTPositionManager = 
require('@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json');
const UniFactory = require('@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json');

/**
 * Mainnet Deployment script
 * Deploys xU3LPStable contract with DAI/USDC as token 0 and token 1
 * Mints initial liquidity
 * Need to connect to alchemy Mainnet node in hardhat config and run with --network mainnet
 */
async function deployMainnet() {
    const [admin] = await ethers.getSigners();
    let proxyAdminAddress = process.env.PROXY_ADMIN_ADDRESS;
    let token0 = await ethers.getContractAt('DAI', '0x6b175474e89094c44da98b954eedeac495271d0f');
    let token1 = await ethers.getContractAt('USDC', '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48');
    // Swap addresses if they aren't ordered
    if(token0.address > token1.address) {
      let tmp = token0;
      token0 = token1;
      token1 = tmp;
    }
    let token0Decimals = await token0.decimals();
    let token1Decimals = await token1.decimals();

    const uniFactory = await ethers.getContractAt(UniFactory.abi, addresses.v3CoreFactoryAddress);
    const positionManager = await ethers.getContractAt(NFTPositionManager.abi, 
                                    addresses.nonfungibleTokenPositionManagerAddress);
    const router = await ethers.getContractAt(swapRouter.abi, 
                                    addresses.swapRouter);

    // DAI/USDC - 1.000 - 1.001 *
    // tick lower: -276330
    // tick upper: -276310
    // price lower: 0.9994
    // price upper: 1.0014
    const lowTick = -276330;
    const highTick = -276310;
    const poolAddress = await uniFactory.getPool(token0.address, token1.address, 500);
    if(!poolAddress) {
      console.log('pool not found, exiting script');
      return;
    }
    console.log('pool address:', poolAddress);
    
    // Deploy xU3LP
    const xU3LPImpl = await deploy('xU3LPStable');
    await xU3LPImpl.deployed();
    console.log('deployed xU3LP !')
    const xU3LPProxy = await deployArgs('xU3LPStableProxy', xU3LPImpl.address, proxyAdminAddress);
    await xU3LPProxy.deployed();
    console.log('deployed Proxy !')
    const xU3LP = await ethers.getContractAt('xU3LPStable', xU3LPProxy.address);
    let tx = await xU3LP.initialize('xU3LPa', lowTick, highTick, token0.address, token1.address, 
        poolAddress, router.address, positionManager.address, 
        {mintFee: 1250, burnFee: 1250, claimFee: 50}, 200, token0Decimals, token1Decimals);
    await tx.wait();
    console.log('initialized xU3LP');
    
    // approve xU3LP
    approveAmount = bnDecimal(100000000000000);
    tx = await token0.approve(xU3LP.address, approveAmount);
    await tx.wait();
    tx = await token1.approve(xU3LP.address, approveAmount);
    await tx.wait();

    console.log('approved both tokens');

    // mint initial - required to initialize the liquidity position
    // and create the NFT representing it
    let mintAmount = bnDecimal(45);
    // check if the mint amounts match for mintInitial function
    let actualAmounts = await xU3LP.calculatePoolMintedAmounts(mintAmount, mintAmount);
    tx = await xU3LP.mintInitial(actualAmounts.amount0Minted, actualAmounts.amount1Minted);
    await tx.wait();
    console.log('mint initial success');

    await xU3LP.setManager(admin.address);
    await tx.wait();
    console.log('set manager');

    await xU3LP.transferOwnership(process.env.XU3LP_ADMIN_ADDRESS);
    await tx.wait();
    console.log('transferred ownership');
    console.log('finished with deployment');

    await printPositionAndBufferBalance(xU3LP);
    await getTokenPrices(xU3LP);
  }

deployMainnet()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });