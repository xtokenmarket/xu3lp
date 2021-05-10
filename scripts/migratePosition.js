const { ethers, upgrades } = require('hardhat');
const { deploy, deployArgs, deployWithAbi, getPriceInX96Format, getRatio, getNumberNoDecimals,
        bnDecimal, printPositionAndBufferBalance, mineBlocks } = require('./helpers');

const swapRouter = require('@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json')
const NFTPositionDescriptor =
 require('@uniswap/v3-periphery/artifacts/contracts/NonFungibleTokenPositionDescriptor.sol/NonFungibleTokenPositionDescriptor.json');
const NFTPositionManager = 
require('@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json');

const UniFactory = require('@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json');

async function migratePosition() {
    const [admin, proxyAdmin] = await ethers.getSigners();

    const dai = await deployArgs('DAI', 'DAI', 'DAI');
    const usdc = await deployArgs('sUSD', 'sUSD', 'sUSD');
    const weth = await deployArgs('WETH', 'WETH', 'WETH');
    let token0Decimals = await dai.decimals();
    let token1Decimals = await usdc.decimals();

    const uniFactory = await deployWithAbi(UniFactory, admin);
    const tokenDescriptor = await deployWithAbi(NFTPositionDescriptor, admin, weth.address);
    const positionManager = await deployWithAbi(NFTPositionManager, admin, 
                                                uniFactory.address, weth.address, tokenDescriptor.address);
    const router = await deployWithAbi(swapRouter, admin, uniFactory.address, weth.address);

    // 0.997 - 1.003 price
    const lowTick = -60;
    const highTick = 60;
    // Price = 1
    const price = getPriceInX96Format(1);

    await positionManager.createAndInitializePoolIfNecessary(dai.address, usdc.address, 500, price);
    const poolAddress = await uniFactory.getPool(dai.address, usdc.address, 500);
    
    const xU3LPImpl = await deploy('xU3LPStable');
    const xU3LPProxy = await deployArgs('xU3LPStableProxy', xU3LPImpl.address, proxyAdmin.address);
    const xU3LP = await ethers.getContractAt('xU3LPStable', xU3LPProxy.address);
    await xU3LP.initialize('xU3LP', lowTick, highTick, dai.address, usdc.address, 
        poolAddress, router.address, positionManager.address,
        {mintFee: 1250, burnFee: 1250, claimFee: 50}, 200, token0Decimals, token1Decimals);

    // xU3LP contract which represents a different position
    const xU3LPImpl2 = await deploy('xU3LPStable');
    const xU3LPProxy2 = await deployArgs('xU3LPStableProxy', xU3LPImpl2.address, proxyAdmin.address);
    const xU3LP2 = await ethers.getContractAt('xU3LPStable', xU3LPProxy2.address);
    await xU3LP2.initialize('xU3LP', -200, 200, dai.address, usdc.address, 
        poolAddress, router.address, positionManager.address,
        {mintFee: 1250, burnFee: 1250, claimFee: 50}, 200, token0Decimals, token1Decimals);
    
    // approve xU3LP
    let approveAmount = bnDecimal(100000000000000);
    await dai.approve(xU3LP.address, approveAmount);
    await usdc.approve(xU3LP.address, approveAmount);
    await dai.approve(xU3LP2.address, approveAmount);
    await usdc.approve(xU3LP2.address, approveAmount);

    // mint initial - required to initialize the liquidity position
    // and create the NFT representing it
    let mintAmount = bnDecimal(100000000);
    await xU3LP.mintInitial(mintAmount, mintAmount);
    console.log('first mint success');
    await xU3LP2.mintInitial(mintAmount.mul(10), mintAmount.mul(10));
    console.log('second mint success');

    // minting
    mintAmount = bnDecimal(1000000);
    await xU3LP.mintWithToken(0, mintAmount);
    await mineBlocks(5);
    await xU3LP.mintWithToken(1, mintAmount);
    await mineBlocks(5);
    console.log('minting 1 000 000 DAI and USDC successful');
    await printPositionAndBufferBalance(xU3LP);

    // rebalance
    await xU3LP.rebalance();
    console.log('rebalance successful');
    await printPositionAndBufferBalance(xU3LP);

    // migrating the position
    console.log('\n----- Migrating Pool Position to ticks -100 and 100 -----\n')
    await xU3LP.migratePosition(-100, 100);
    console.log('success migrating the position');
    await printPositionAndBufferBalance(xU3LP);

    // Do all the tests with the newly minted position
    console.log('\n----- Testing new position by minting and burning -----\n')

    // minting
    mintAmount = bnDecimal(1000000);

    await xU3LP.mintWithToken(0, mintAmount);
    await mineBlocks(5);
    await xU3LP.mintWithToken(1, mintAmount);
    await mineBlocks(5);
    console.log('minting 1 000 000 DAI and USDC successful');
    await printPositionAndBufferBalance(xU3LP);
    await getRatio(xU3LP);

    // rebalance
    await xU3LP.rebalance();
    console.log('rebalance successful');
    await printPositionAndBufferBalance(xU3LP);
    await getRatio(xU3LP);

    // burning
    burnAmount = bnDecimal(100000);
    await xU3LP.burn(0, burnAmount);
    await mineBlocks(5);
    console.log('burning 100 000 DAI successful');
    await printPositionAndBufferBalance(xU3LP);

    burnAmount = bnDecimal(300000);
    await xU3LP.burn(1, burnAmount);
    await mineBlocks(5);
    console.log('burning 300 000 USDC successful');
    await printPositionAndBufferBalance(xU3LP);

    // rebalance
    await xU3LP.rebalance();
    console.log('rebalance successful');

    await printPositionAndBufferBalance(xU3LP);

    // minting
    await xU3LP.mintWithToken(0, mintAmount);
    await mineBlocks(5);
    await xU3LP.mintWithToken(1, mintAmount);
    await mineBlocks(5);
    console.log('minting 10 000 DAI and USDC successful');

    await xU3LP.rebalance();
    console.log('rebalance successful');
    await printPositionAndBufferBalance(xU3LP);

    // burning - triggering swap (not enough DAI balance)
    burnAmount = bnDecimal(9400000);
    await xU3LP.burn(0, burnAmount);
    await mineBlocks(5);
    console.log('burning 9400000 DAI successful');
    await printPositionAndBufferBalance(xU3LP);
    await getRatio(xU3LP);

    await xU3LP.rebalance();
    console.log('rebalance successful');

    await printPositionAndBufferBalance(xU3LP);
    await getRatio(xU3LP);

    // Get fees
    feesDAI = await xU3LP.withdrawableToken0Fees();
    feesUSDC = await xU3LP.withdrawableToken1Fees();
    console.log('fees dai:', getNumberNoDecimals(feesDAI), 'usdc:', getNumberNoDecimals(feesUSDC));
  }

migratePosition()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });