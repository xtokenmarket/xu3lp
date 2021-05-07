const { ethers } = require('hardhat');
const { deploy, deployArgs, printPositionAndBufferBalance, getPriceInX96Format, deployWithAbi,
        getNumberNoDecimals, bnDecimal, getRatio, mineBlocks, bnCustomDecimals, getTokenPrices } = require('./helpers');

const swapRouter = require('@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json')
const NFTPositionManager = 
require('@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json');
const NFTPositionDescriptor =
 require('@uniswap/v3-periphery/artifacts/contracts/NonFungibleTokenPositionDescriptor.sol/NonFungibleTokenPositionDescriptor.json');
const UniFactory = require('@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json');

/**
 * Designed for Hardhat Network
 * Testing mint and burn on pools with different token decimals
 */
async function deployXU3LP() {
    const [admin, user1, proxyAdmin] = await ethers.getSigners();
    let token0 = await deployArgs('DAI', 'DAI', 'DAI');
    let token1 = await deployArgs('USDT', 'USDT', 'USDT');
    const weth = await deployArgs('WETH', 'WETH', 'WETH');
    
    const uniFactory = await deployWithAbi(UniFactory, admin);
    const tokenDescriptor = await deployWithAbi(NFTPositionDescriptor, admin, weth.address);
    const positionManager = await deployWithAbi(NFTPositionManager, admin, 
                                                uniFactory.address, weth.address, tokenDescriptor.address);
    const router = await deployWithAbi(swapRouter, admin, uniFactory.address, weth.address);

    // 0.997 - 1.003 price
    // okay so these ticks are actually for tokens with identical decimals;
    let lowTick = -60;
    let highTick = 60;
    // these are for tokens with 18 : 6 decimals
    lowTick = -276350;
    highTick = -276290;
    let lowPrice = '79125342561396703567017'
    let highPrice = '79363063105786882359298'
    let price = '79244202833591792963157'

    // Tokens must be sorted by address
    if(token0.address > token1.address) {
      let tmp = token0;
      token0 = token1;
      token1 = tmp;
    }
    await positionManager.createAndInitializePoolIfNecessary(token0.address, token1.address, 500, price);
    const poolAddress = await uniFactory.getPool(token0.address, token1.address, 500);
    
    const xU3LPImpl = await deploy('xU3LPStable');
    const xU3LPProxy = await deployArgs('xU3LPStableProxy', xU3LPImpl.address, proxyAdmin.address);
    const xU3LP = await ethers.getContractAt('xU3LPStable', xU3LPProxy.address);
    await xU3LP.initialize('xU3LP', lowTick, highTick, token0.address, token1.address, 
        poolAddress, router.address, positionManager.address, 500, 500, 100);
    
    // approve xU3LP
    let approveAmount = bnDecimal(100000000000000);
    await token0.approve(xU3LP.address, approveAmount);
    await token1.approve(xU3LP.address, approveAmount);

    // mint initial - required to initialize the liquidity position
    // and create the NFT representing it
    let mintAmount = bnDecimal(100000000);
    let mintAmount2 = bnCustomDecimals(100000000, 6);
    await xU3LP.mintInitial(mintAmount, mintAmount2);
    console.log('first mint success');
    await printPositionAndBufferBalance(xU3LP);

    // minting
    mintAmount = bnDecimal(1000000);
    mintAmount2 = bnCustomDecimals(1000000, 6);

    await xU3LP.mintWithToken(0, mintAmount);
    await mineBlocks(5);
    await xU3LP.mintWithToken(1, mintAmount2);
    await mineBlocks(5);
    console.log('minting 1 000 000 token0 and token1 successful');
    await printPositionAndBufferBalance(xU3LP);

    // rebalance
    await xU3LP.rebalance();
    console.log('rebalance successful');
    await printPositionAndBufferBalance(xU3LP);

    // burning
    let burnAmount = bnDecimal(10000);
    await xU3LP.burn(0, burnAmount);
    await mineBlocks(5);
    console.log('burning 10 000 token0 successful');
    await printPositionAndBufferBalance(xU3LP);

    burnAmount = bnCustomDecimals(30000, 6);
    await xU3LP.burn(1, burnAmount);
    await mineBlocks(5);
    console.log('burning 30 000 token1 successful');
    await printPositionAndBufferBalance(xU3LP);

    // rebalance
    await xU3LP.rebalance();
    console.log('rebalance successful');

    await printPositionAndBufferBalance(xU3LP);

    // minting
    await xU3LP.mintWithToken(0, mintAmount);
    await mineBlocks(5);
    await xU3LP.mintWithToken(1, mintAmount2);
    await mineBlocks(5);
    console.log('minting 1 000 000 token0 and token1 successful');

    await xU3LP.rebalance();
    console.log('rebalance successful');
    await printPositionAndBufferBalance(xU3LP);

    // burning - triggering swap (not enough token1 balance)
    burnAmount = bnCustomDecimals(10000000, 6);
    await xU3LP.burn(1, burnAmount);
    await mineBlocks(5);
    console.log('burning 10 000 000 token1 successful');
    await printPositionAndBufferBalance(xU3LP);

    await xU3LP.rebalance();
    console.log('rebalance successful');
    await getRatio(xU3LP);

    // Get fees
    let feestoken0 = await xU3LP.withdrawableToken0Fees();
    let feestoken1 = await xU3LP.withdrawableToken1Fees();
    console.log('fees token0:', getNumberNoDecimals(feestoken0), 'token1:', getNumberNoDecimals(feestoken1));
    
    console.log('setting manager 1 to user1');
    await xU3LP.setManager(user1.address);
    await xU3LP.connect(user1).withdrawFees();
    console.log('success withdrawing fees from manager 1');
    
    feestoken0 = await xU3LP.withdrawableToken0Fees();
    feestoken1 = await xU3LP.withdrawableToken1Fees();
    console.log('fees token0:', getNumberNoDecimals(feestoken0), 'token1:', getNumberNoDecimals(feestoken1));
  }

deployXU3LP()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });