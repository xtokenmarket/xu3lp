const { ethers, upgrades, admin } = require('hardhat');
const { deployArgs, deployWithAbi, printPositionAndBufferBalance, getPriceInX96Format, 
        getNumberNoDecimals, bnDecimal, getRatio, mineBlocks, deploy } = require('./helpers');

const swapRouter = require('@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json')
const NFTPositionDescriptor =
 require('@uniswap/v3-periphery/artifacts/contracts/NonFungibleTokenPositionDescriptor.sol/NonFungibleTokenPositionDescriptor.json');
const NFTPositionManager = 
require('@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json');

const UniFactory = require('@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json');

async function deployXU3LP() {
    const signers = await ethers.getSigners();
    const admin = signers[0];

    const dai = await deployArgs('DAI', 'DAI', 'DAI');
    const usdc = await deployArgs('USDC', 'USDC', 'USDC');
    const weth = await deployArgs('WETH', 'WETH', 'WETH');
    
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
    
    const XU3LP = await ethers.getContractFactory("xU3LPStable");
    const xU3LP = await upgrades.deployProxy(XU3LP, ["xU3LP", lowTick, highTick, dai.address, usdc.address, 
                                          poolAddress, router.address, positionManager.address, 500, 500, 100]);
    console.log('proxy xu3lp address:', xU3LP.address);
    
    
    // approve xU3LP
    let approveAmount = bnDecimal(100000000000000);
    await dai.approve(xU3LP.address, approveAmount);
    await usdc.approve(xU3LP.address, approveAmount);

    // mint initial - required to initialize the liquidity position
    // and create the NFT representing it
    let mintAmount = bnDecimal(100000000);
    await xU3LP.mintInitial(mintAmount, mintAmount);
    console.log('first mint success');

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

    // burning
    let burnAmount = bnDecimal(10000);
    await xU3LP.burn(0, burnAmount);
    await mineBlocks(5);
    console.log('burning 10 000 DAI successful');
    await printPositionAndBufferBalance(xU3LP);

    burnAmount = bnDecimal(30000);
    await xU3LP.burn(1, burnAmount);
    await mineBlocks(5);
    console.log('burning 30 000 USDC successful');
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
    console.log('minting 1 000 000 DAI and USDC successful');

    await xU3LP.rebalance();
    console.log('rebalance successful');
    await printPositionAndBufferBalance(xU3LP);

    // burning - triggering swap (not enough USDC balance)
    burnAmount = bnDecimal(10000000);
    await xU3LP.burn(1, burnAmount);
    await mineBlocks(5);
    console.log('burning 10 000 000 USDC successful');
    await printPositionAndBufferBalance(xU3LP);

    await xU3LP.rebalance();
    console.log('rebalance successful');
    await getRatio(xU3LP);

    // Get fees
    let feesDAI = await xU3LP.withdrawableToken0Fees();
    let feesUSDC = await xU3LP.withdrawableToken1Fees();
    console.log('fees dai:', getNumberNoDecimals(feesDAI), 'usdc:', getNumberNoDecimals(feesUSDC));
    
    console.log('setting manager 1 to user1');
    let user1 = signers[1];
    await xU3LP.setManager(user1.address);
    await xU3LP.connect(user1).withdrawFees();
    console.log('success withdrawing fees from manager 1');
    
    feesDAI = await xU3LP.withdrawableToken0Fees();
    feesUSDC = await xU3LP.withdrawableToken1Fees();
    console.log('fees dai:', getNumberNoDecimals(feesDAI), 'usdc:', getNumberNoDecimals(feesUSDC));

    const newProxy = await upgrades.upgradeProxy(xU3LP.address, XU3LP);
    console.log('upgraded xu3lp:', newProxy.address);

    // mint initial - required to initialize the liquidity position
    // and create the NFT representing it
    // mintAmount = bnDecimal(100000000);
    // await xU3LP.mintInitial(mintAmount, mintAmount);
    // console.log('first mint success');

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

    // burning
    burnAmount = bnDecimal(10000);
    await xU3LP.burn(0, burnAmount);
    await mineBlocks(5);
    console.log('burning 10 000 DAI successful');
    await printPositionAndBufferBalance(xU3LP);

    burnAmount = bnDecimal(30000);
    await xU3LP.burn(1, burnAmount);
    await mineBlocks(5);
    console.log('burning 30 000 USDC successful');
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
    console.log('minting 1 000 000 DAI and USDC successful');

    await xU3LP.rebalance();
    console.log('rebalance successful');
    await printPositionAndBufferBalance(xU3LP);

    // burning - triggering swap (not enough USDC balance)
    burnAmount = bnDecimal(9000000);
    await xU3LP.burn(1, burnAmount);
    await mineBlocks(5);
    console.log('burning 9 000 000 USDC successful');
    await printPositionAndBufferBalance(xU3LP);

    await xU3LP.rebalance();
    console.log('rebalance successful');
    await getRatio(xU3LP);

    // Get fees
    feesDAI = await xU3LP.withdrawableToken0Fees();
    feesUSDC = await xU3LP.withdrawableToken1Fees();
    console.log('fees dai:', getNumberNoDecimals(feesDAI), 'usdc:', getNumberNoDecimals(feesUSDC));
    
    console.log('setting manager 1 to user1');
    user1 = signers[1];
    await xU3LP.setManager(user1.address);
    await xU3LP.connect(user1).withdrawFees();
    console.log('success withdrawing fees from manager 1');
    
    feesDAI = await xU3LP.withdrawableToken0Fees();
    feesUSDC = await xU3LP.withdrawableToken1Fees();
    console.log('fees dai:', getNumberNoDecimals(feesDAI), 'usdc:', getNumberNoDecimals(feesUSDC));
  }

deployXU3LP()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });