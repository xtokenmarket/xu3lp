const { ethers, upgrades } = require('hardhat');
const { deploy, deployArgs, deployWithAbi, getBalance, getPriceInX96Format, 
        bn, bnDecimal, getRatio, getTokenPrices, mineBlocks, printPositionAndBufferBalance } = require('./helpers');

const swapRouter = require('@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json')
const NFTPositionDescriptor =
 require('@uniswap/v3-periphery/artifacts/contracts/NonFungibleTokenPositionDescriptor.sol/NonFungibleTokenPositionDescriptor.json');
const NFTPositionManager = 
require('@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json');

const UniFactory = require('@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json');

async function edgeCases() {
    const [admin, user1, proxyAdmin] = await ethers.getSigners();

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
    const lowPrice = getPriceInX96Format(0.997);
    const highPrice = getPriceInX96Format(1.003);

    await positionManager.createAndInitializePoolIfNecessary(dai.address, usdc.address, 500, price);
    const poolAddress = await uniFactory.getPool(dai.address, usdc.address, 500);
    
    const xU3LPImpl = await deploy('xU3LPStable');
    const xU3LPProxy = await deployArgs('xU3LPStableProxy', xU3LPImpl.address, proxyAdmin.address);
    const xU3LP = await ethers.getContractAt('xU3LPStable', xU3LPProxy.address);
    await xU3LP.initialize('xU3LP', lowTick, highTick, dai.address, usdc.address, 
        poolAddress, router.address, positionManager.address, 500, 500, 100);
    

    // approve xU3LP
    let decimal = Math.pow(10, 18);
    let decimals = bn(decimal.toString());
    let approveAmount = bnDecimal(100000000000000);
    await dai.approve(xU3LP.address, approveAmount);
    await usdc.approve(xU3LP.address, approveAmount);

    // mint initial - required to initialize the liquidity position
    // and create the NFT representing it
    let mintAmount = bnDecimal(100000000);
    await xU3LP.mintInitial(mintAmount, mintAmount);
    console.log('first mint success');

    // rebalance
    await xU3LP.rebalance();
    console.log('rebalance successful');

    const pendingBlock = await network.provider.send("eth_getBlockByNumber", ["pending", false])
    const timestamp = pendingBlock.timestamp + 10000;
    await dai.approve(router.address, approveAmount);
    await usdc.approve(router.address, approveAmount);

    // Swap 80 000 000 USDC for DAI
    // Leaving DAI:USDC Ratio to 1:10
    await router.exactInputSingle({
      tokenIn: usdc.address,
      tokenOut: dai.address,
      fee: 500,
      recipient: admin.address,
      deadline: timestamp,
      amountIn: bnDecimal(80000000),
      amountOutMinimum: bnDecimal(7900000),
      sqrtPriceLimitX96: highPrice
    });

    console.log('swapped 80M USDC for DAI from admin account');
    await printPositionAndBufferBalance(xU3LP);

    await getTokenPrices(xU3LP);
    console.log('xU3LP balance:');
    await xU3LP.rebalance();
    console.log('balances after rebalancing:');
    await printPositionAndBufferBalance(xU3LP);

    // burning - triggering swap (not enough USDC balance)
    burnAmount = bnDecimal(9870000);
    await xU3LP.burn(0, burnAmount);
    console.log('burning 9870000 DAI successful');
    await mineBlocks(5);
    await printPositionAndBufferBalance(xU3LP);

    await xU3LP.rebalance();
    console.log('rebalance successful');
    await printPositionAndBufferBalance(xU3LP);
    await getRatio(xU3LP);

    // Swap 150 000 000 DAI for USDC
    // Leaving DAI:USDC Ratio to < 1:10
    await router.exactInputSingle({
      tokenIn: dai.address,
      tokenOut: usdc.address,
      fee: 500,
      recipient: admin.address,
      deadline: timestamp,
      amountIn: bnDecimal(150000000),
      amountOutMinimum: bnDecimal(14900000),
      sqrtPriceLimitX96: lowPrice
    });

    console.log('swapped 150M USDC for DAI from admin account');
    await printPositionAndBufferBalance(xU3LP);

    // burning - triggering swap (not enough DAI balance)
    burnAmount = bnDecimal(9300000);
    await xU3LP.burn(0, burnAmount);
    console.log('burning 9300000 DAI successful');
    await printPositionAndBufferBalance(xU3LP);

    await xU3LP.rebalance();
    console.log('rebalance successful');

    await printPositionAndBufferBalance(xU3LP);
    
    await getRatio(xU3LP);

    // Get fees
    let feesDAI = await xU3LP.withdrawableToken0Fees();
    let feesUSDC = await xU3LP.withdrawableToken1Fees();
    console.log('fees dai:', feesDAI.div(decimals).toString(), 'usdc:', feesUSDC.div(decimals).toString())
  }

edgeCases()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });