const { ethers, upgrades } = require('hardhat');
const { deployArgs, getTWAP, getPriceInX96Format, 
        getXU3LPBalance, bnDecimal, getNumberNoDecimals } = require('./helpers');

const swapRouter = require('@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json')
const NFTPositionDescriptor =
 require('@uniswap/v3-periphery/artifacts/contracts/NonFungibleTokenPositionDescriptor.sol/NonFungibleTokenPositionDescriptor.json');
const NFTPositionManager = 
require('@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json');

const UniFactory = require('@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json');


// Functions to test retrieving the TWAP from the pool
// Using xU3LP.getAsset0Price()
// After making various swaps using the router
async function testTWAP() {
    const signers = await ethers.getSigners();
    const admin = signers[0].address;

    const dai = await deployArgs('DAI', 'DAI', 'DAI');
    const usdc = await deployArgs('USDC', 'USDC', 'USDC');
    const weth = await deployArgs('WETH', 'WETH', 'WETH');

    let Factory = new ethers.ContractFactory(UniFactory.abi, UniFactory.bytecode, signers[0]);
    const uniFactory = await Factory.deploy();

    // 0.997 - 1.003 price
    const lowTick = -60;
    const highTick = 60;
    const price = getPriceInX96Format(1);
    const lowPrice = getPriceInX96Format(0.997);
    const highPrice = getPriceInX96Format(1.003);

    const TokenDescriptor = new ethers.ContractFactory(NFTPositionDescriptor.abi, NFTPositionDescriptor.bytecode, signers[0]);
    const PositionManager = new ethers.ContractFactory(NFTPositionManager.abi, NFTPositionManager.bytecode, signers[0]);
    const tokenDescriptor = await TokenDescriptor.deploy(weth.address);
    const positionManager = await PositionManager.deploy(uniFactory.address, weth.address, tokenDescriptor.address);

    await positionManager.createAndInitializePoolIfNecessary(dai.address, usdc.address, 500, price);
    const poolAddress = await uniFactory.getPool(dai.address, usdc.address, 500);

    const Router = new ethers.ContractFactory(swapRouter.abi, swapRouter.bytecode, signers[0]);
    const router = await Router.deploy(uniFactory.address, weth.address);
    
    const XU3LP = await ethers.getContractFactory("xU3LPStable");
    const xU3LP = await upgrades.deployProxy(XU3LP, ["xU3LP", lowTick, highTick, dai.address, usdc.address, 
                                          poolAddress, router.address, positionManager.address, 500, 500, 100]);
    

    // approve xU3LP
    let approveAmount = bnDecimal('10000000000000000');
    await dai.approve(xU3LP.address, approveAmount);
    await usdc.approve(xU3LP.address, approveAmount);
    await dai.approve(router.address, approveAmount);
    await usdc.approve(router.address, approveAmount);
    // mint initial - required to initialize the liquidity position 
    // and create the NFT representing it
    // Deposit 100 000 000
    let mintAmount = bnDecimal(100000000);
    await xU3LP.mintInitial(mintAmount, mintAmount);

    console.log('initial balances: 100M DAI and 100M USDC' );

    // transfer some tokens to user1

    let user1 = signers[1];
    await dai.transfer(user1.address, bnDecimal(10000000));
    await usdc.transfer(user1.address, bnDecimal(10000000))
    await dai.connect(user1).approve(xU3LP.address, approveAmount);
    await usdc.connect(user1).approve(xU3LP.address, approveAmount);

    // Mint and burn at asset 0 price = 1
    console.log('\n---- Mint and burn at asset 0 price = 1 ----\n')

    // Mint some balance so as to have left in the contract when burning
    mintAmount = bnDecimal(1000000);
    await xU3LP.mintWithToken(0, mintAmount);

    // Mint at equal token proportion
    // Mint 1 000 000 tokens
    await xU3LP.connect(user1).mintWithToken(0, mintAmount);
    let xU3LPbalance = await getXU3LPBalance(xU3LP, user1.address);
    console.log('balance after minting 1M DAI:');
    console.log('xU3LP balance:', getNumberNoDecimals(xU3LPbalance));

    // Burn at equal token proportion
    // Burn 1 000 000 - fees = 998 000 tokens
    let fees = await xU3LP.withdrawableToken0Fees();
    console.log('withdrawable token fees:', getNumberNoDecimals(fees));
    let burnAmount = xU3LPbalance;
    await xU3LP.connect(user1).burn(0, burnAmount);
    xU3LPbalance = await getXU3LPBalance(xU3LP, user1.address);
    console.log(`balance after burning ${getNumberNoDecimals(burnAmount)} xU3LP for DAI:`);
    console.log('xU3LP balance:', getNumberNoDecimals(xU3LPbalance));

    // get block timestamp
    const pendingBlock = await network.provider.send("eth_getBlockByNumber", ["pending", false])
    const timestamp = pendingBlock.timestamp + 10000;

    // ---- Test 1 Swap 50 % of asset 1 for asset 0

    // Swap 50 000 000 USDC for DAI
    await router.exactInputSingle({
        tokenIn: usdc.address,
        tokenOut: dai.address,
        fee: 500,
        recipient: admin,
        deadline: timestamp,
        amountIn: bnDecimal(50000000),
        amountOutMinimum: bnDecimal(4900000),
        sqrtPriceLimitX96: highPrice
    });

    console.log('after swapping 50M USDC for DAI');
    let poolBalance = await xU3LP.getPoolTokenBalance();
    console.log('pool balances:', getNumberNoDecimals(poolBalance.amount0), 'DAI',
                                  getNumberNoDecimals(poolBalance.amount1), 'USDC');
    // Increase time by 1 hour = 3600 seconds to get previous price
    await network.provider.send("evm_increaseTime", [3600]);
    await network.provider.send("evm_mine");
    // Get asset 0 price
    let asset0Price = await xU3LP.getAsset0Price();
    let twap = getTWAP(asset0Price);
    console.log('twap token0:', twap);
    // Get Asset 1 Price
    let asset1Price = await xU3LP.getAsset1Price();
    twap = getTWAP(asset1Price);
    console.log('twap token1:', twap);

    // Mint and burn at asset 0 price = 1.0029
    console.log('\n---- Mint and burn at asset 0 price = 1.0029 ----\n')

    // Mint more xU3LP for DAI
    // Mint 1 000 000 tokens
    mintAmount = bnDecimal(1000000);
    await xU3LP.connect(user1).mintWithToken(0, mintAmount);
    xU3LPbalance = await getXU3LPBalance(xU3LP, user1.address);
    console.log('balance after minting 1M DAI:');
    console.log('xU3LP balance:', getNumberNoDecimals(xU3LPbalance));

    // Burn less xU3LP for DAI
    fees = await xU3LP.withdrawableToken0Fees();
    console.log('withdrawable token fees:', getNumberNoDecimals(fees));
    burnAmount = xU3LPbalance;
    await xU3LP.connect(user1).burn(0, burnAmount);
    xU3LPbalance = await getXU3LPBalance(xU3LP, user1.address);
    console.log(`balance after burning ${getNumberNoDecimals(burnAmount)} xU3LP for DAI:`);
    console.log('xU3LP balance:', getNumberNoDecimals(xU3LPbalance));

    // ---- Test 2 - Swap in reverse direction -----

    // Swap 150 000 000 DAI for USDC
    await router.exactInputSingle({
      tokenIn: dai.address,
      tokenOut: usdc.address,
      fee: 500,
      recipient: admin,
      deadline: timestamp,
      amountIn: bnDecimal(150000000),
      amountOutMinimum: bnDecimal(14900000),
      sqrtPriceLimitX96: lowPrice
    });

    console.log('after swapping 150M DAI for USDC');
    // Increase time by 1 hour = 3600 seconds to get previous price
    await network.provider.send("evm_increaseTime", [3600]);
    await network.provider.send("evm_mine");
    // Get asset 0 price
    asset0Price = await xU3LP.getAsset0Price();
    twap = getTWAP(asset0Price);
    console.log('twap token0:', twap);
    // Get Asset 1 Price
    asset1Price = await xU3LP.getAsset1Price();
    twap = getTWAP(asset1Price);
    console.log('twap token1:', twap);
    poolBalance = await xU3LP.getPoolTokenBalance();
    console.log('pool balances:', getNumberNoDecimals(poolBalance.amount0), 'DAI', 
                                  getNumberNoDecimals(poolBalance.amount1), 'USDC');

    // Mint and burn at asset 0 price = 0.994
    console.log('\n---- Mint and burn at asset 0 price = 0.994 ----\n')

    // Mint less xU3LP for DAI
    // Mint 1 000 000 tokens
    mintAmount = bnDecimal(1000000);
    await xU3LP.connect(user1).mintWithToken(0, mintAmount);
    xU3LPbalance = await getXU3LPBalance(xU3LP, user1.address);
    console.log('balance after minting 1M DAI:');
    console.log('xU3LP balance:', getNumberNoDecimals(xU3LPbalance));

    // Burn more xU3LP for DAI
    fees = await xU3LP.withdrawableToken0Fees();
    console.log('withdrawable token fees:', getNumberNoDecimals(fees));
    burnAmount = xU3LPbalance;
    await xU3LP.connect(user1).burn(0, burnAmount);
    xU3LPbalance = await getXU3LPBalance(xU3LP, user1.address);
    console.log(`balance after burning ${getNumberNoDecimals(burnAmount)} xU3LP for DAI:`);
    console.log('xU3LP balance:', getNumberNoDecimals(xU3LPbalance));


    // ---- Test 3 - Swap to equalize the balances -----

    console.log('\n---- Swap tokens back to get 1 to 1 ratio ----\n')

    // Swap 100 000 000 USDC for DAI
    await router.exactInputSingle({
      tokenIn: usdc.address,
      tokenOut: dai.address,
      fee: 500,
      recipient: admin,
      deadline: timestamp,
      amountIn: bnDecimal(100000000),
      amountOutMinimum: bnDecimal(99000000),
      sqrtPriceLimitX96: highPrice
    });

    console.log('after swapping 100M USDC for DAI');
    // Increase time by 1 hour = 3600 seconds to get previous price
    await network.provider.send("evm_increaseTime", [3600]);
    await network.provider.send("evm_mine");
    // Get asset 0 price
    asset0Price = await xU3LP.getAsset0Price();
    twap = getTWAP(asset0Price);
    console.log('twap token0:', twap);
    // Get Asset 1 Price
    asset1Price = await xU3LP.getAsset1Price();
    twap = getTWAP(asset1Price);
    console.log('twap token1:', twap);
    poolBalance = await xU3LP.getPoolTokenBalance();
    console.log('pool balances:', getNumberNoDecimals(poolBalance.amount0), 'DAI', 
                                  getNumberNoDecimals(poolBalance.amount1), 'USDC');

    return;
  }

testTWAP()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });