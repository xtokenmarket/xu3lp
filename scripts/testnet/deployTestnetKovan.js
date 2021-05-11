const { ethers } = require('hardhat');
const { deploy, deployArgs, printPositionAndBufferBalance, getPriceInX96Format, bnDecimal } = require('../helpers');
const addresses = require('../uniswapAddresses.json').kovan;

const swapRouter = require('@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json')
const NFTPositionManager = 
require('@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json');
const UniFactory = require('@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json');

/**
 * Testnet script designed to work with Uniswap Kovan deployment
 * Deploys xU3LP to Kovan network
 * Need to connect to alchemy Kovan node in hardhat config before running and run with --network kovan
 */
async function deployXU3LP() {
    const [admin, user1, proxyAdmin] = await ethers.getSigners();
    let token0 = await deployArgs('DAI', 'DAI', 'DAI');
    await token0.deployed();
    let token1 = await deployArgs('USDC', 'USDC', 'USDC');
    await token1.deployed();
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

    // 0.997 - 1.003 price
    const lowTick = -30;
    const highTick = 30;
    // Price = 1
    const price = getPriceInX96Format(1);

    let initTx = await positionManager.createAndInitializePoolIfNecessary(token0.address, token1.address, 500, price);
    await initTx.wait();
    console.log('initialized pool');
    const poolAddress = await uniFactory.getPool(token0.address, token1.address, 500);
    console.log('pool address:', poolAddress);
    
    const xU3LPImpl = await deploy('xU3LPStable');
    await xU3LPImpl.deployed();
    const xU3LPProxy = await deployArgs('xU3LPStableProxy', xU3LPImpl.address, user1.address);
    await xU3LPProxy.deployed();
    const xU3LP = await ethers.getContractAt('xU3LPStable', xU3LPProxy.address);
    let tx = await xU3LP.initialize('xU3LPa', lowTick, highTick, token0.address, token1.address, 
        poolAddress, router.address, positionManager.address,
        {mintFee: 1250, burnFee: 1250, claimFee: 50}, 200, token0Decimals, token1Decimals);
    await tx.wait();
    
    // approve xU3LP
    approveAmount = bnDecimal(100000000000000);
    tx = await token0.approve(xU3LP.address, approveAmount);
    await tx.wait();
    tx = await token1.approve(xU3LP.address, approveAmount);
    await tx.wait();

    // mint initial - required to initialize the liquidity position
    // and create the NFT representing it
    let mintAmount = bnDecimal(100000000);
    tx = await xU3LP.mintInitial(mintAmount.toString(), mintAmount.toString());
    await tx.wait();
    console.log('first mint success');

    // rebalance
    tx = await xU3LP.rebalance();
    await tx.wait();
    console.log('rebalance successful');
    await printPositionAndBufferBalance(xU3LP);
  }

deployXU3LP()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });