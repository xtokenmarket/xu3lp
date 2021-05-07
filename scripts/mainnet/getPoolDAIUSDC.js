const { ethers, web3 } = require('hardhat');
const { deploy, deployArgs, deployWithAbi, printPositionAndBufferBalance, getPriceInX96Format, 
        getNumberNoDecimals, getNumberDivDecimals,
         bn, bnDecimal, bnCustomDecimals, getRatio, mineBlocks } = require('../helpers');
const addresses = require('../uniswapAddresses.json').mainnet;

const swapRouter = require('@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json')
const NFTPositionDescriptor =
 require('@uniswap/v3-periphery/artifacts/contracts/NonFungibleTokenPositionDescriptor.sol/NonFungibleTokenPositionDescriptor.json');
const NFTPositionManager = 
require('@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json');

const UniFactory = require('@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json');
const UniPool = require('@uniswap/v3-core/artifacts/contracts/UniswapV3Pool.sol/UniswapV3Pool.json');

/**
 * Script which connects to a mainnet pool and gets the available balance
 */
async function getPoolTokenBalance() {
    const [admin, user1, proxyAdmin] = await ethers.getSigners();

    // dai is 18 decimals
    const dai = await ethers.getContractAt('DAI', '0x6b175474e89094c44da98b954eedeac495271d0f');
    // usdc is 6 decimals
    const usdc = await ethers.getContractAt('USDT', '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48');

    const positionManager = await ethers.getContractAt(NFTPositionManager.abi, 
                                    addresses.nonfungibleTokenPositionManagerAddress);
    const router = await ethers.getContractAt(swapRouter.abi, 
                                    addresses.swapRouter);

    const uniFactory = await ethers.getContractAt(UniFactory.abi, addresses.v3CoreFactoryAddress);
    const poolAddress = await uniFactory.getPool(dai.address, usdc.address, 500);
    const uniPool = await ethers.getContractAt(UniPool.abi, poolAddress);

    let positions = await positionManager.positions(4971);

    // add xu3lp for fun
    const xU3LPImpl = await deploy('xU3LPStable');
    const xU3LPProxy = await deployArgs('xU3LPStableProxy', xU3LPImpl.address, proxyAdmin.address);
    const xU3LP = await ethers.getContractAt('xU3LPStable', xU3LPProxy.address);
    await xU3LP.initialize('xU3LP', positions.tickLower, positions.tickUpper, dai.address, usdc.address, 
        poolAddress, router.address, positionManager.address, 500, 500, 100);

    await getPoolState(uniPool);
    await getPositionLiquidity(positionManager, xU3LP);
    let balance0 = await dai.balanceOf(uniPool.address);
    let balance1 = await usdc.balanceOf(uniPool.address);
    let ratio = balance0.div(balance1);
    console.log('pool dai balance:', balance0.toString());
    console.log('usdc balance:', balance1.toString());
    console.log('ratio:', ratio.toString());
  }

  async function getPositionLiquidity(positionManager, xU3LP) {
    let positions = await positionManager.positions(4971);
    console.log('positions:', positions);
    let liquidity = positions.liquidity;
    let amounts = await xU3LP.getAmountsForLiquidity(liquidity);
    console.log('token amounts in position:')
    let amount0 = getNumberNoDecimals(amounts.amount0);
    let amount1 = getNumberDivDecimals(amounts.amount1, 6);
    console.log(amount0);
    console.log(amount1);
    console.log('token amounts with precision:');
    console.log(amounts.amount0.toString());
    console.log(amounts.amount1.toString())
    console.log('asset prices:');
    let asset1Price = await xU3LP.getAsset1Price();
    console.log(asset1Price.toString());
    let asset0Price = await xU3LP.getAsset0Price();
    console.log(asset0Price.toString());
  }

  async function getPoolState(uniPool) {
    const poolLiquidity = await uniPool.liquidity();
    const slot = await uniPool.slot0();
    const price = slot.sqrtPriceX96;
    const tick = slot.tick;
    console.log('liquidity:', poolLiquidity);
    console.log('price:', price.toString());
    console.log('tick:', tick);
  }

  getPoolTokenBalance()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });