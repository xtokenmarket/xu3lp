const { ethers, upgrades } = require('hardhat');
const { deployArgs, getPriceInX96Format, getRatio, getNumberNoDecimals,
        bn, bnDecimal, printPositionAndBufferBalance } = require('./helpers');

const swapRouter = require('@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json')
const NFTPositionDescriptor =
 require('@uniswap/v3-periphery/artifacts/contracts/NonFungibleTokenPositionDescriptor.sol/NonFungibleTokenPositionDescriptor.json');
const NFTPositionManager = 
require('@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json');

const UniFactory = require('@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json');

async function migratePosition() {
    const signers = await ethers.getSigners();

    const dai = await deployArgs('DAI', 'DAI', 'DAI');
    const usdc = await deployArgs('USDC', 'USDC', 'USDC');
    const weth = await deployArgs('WETH', 'WETH', 'WETH');

    let Factory = new ethers.ContractFactory(UniFactory.abi, UniFactory.bytecode, signers[0]);
    const uniFactory = await Factory.deploy();

    // 0.997 - 1.003 price
    const lowTick = -60;
    const highTick = 60;
    // Price = 1
    const price = getPriceInX96Format(1);

    const TokenDescriptor = new ethers.ContractFactory(NFTPositionDescriptor.abi, NFTPositionDescriptor.bytecode, signers[0]);
    const PositionManager = new ethers.ContractFactory(NFTPositionManager.abi, NFTPositionManager.bytecode, signers[0]);
    const tokenDescriptor = await TokenDescriptor.deploy(weth.address);
    const positionManager = await PositionManager.deploy(uniFactory.address, weth.address, tokenDescriptor.address);
    console.log('deployed position manager');

    await positionManager.createAndInitializePoolIfNecessary(dai.address, usdc.address, 500, price);
    const poolAddress = await uniFactory.getPool(dai.address, usdc.address, 500);
    console.log('pool deployed');

    const Router = new ethers.ContractFactory(swapRouter.abi, swapRouter.bytecode, signers[0]);
    const router = await Router.deploy(uniFactory.address, weth.address);
    
    const XU3LP = await ethers.getContractFactory("xU3LPStable");
    const xU3LP = await upgrades.deployProxy(XU3LP, ["xU3LP", lowTick, highTick, dai.address, usdc.address, 
                                          poolAddress, router.address, positionManager.address, 500, 500, 100]);

    // xU3LP contract which represents a different position
    let liquidityPosition2 = await upgrades.deployProxy(XU3LP, ["xU3LP", -200, 200, dai.address, usdc.address, 
                                                poolAddress, router.address, positionManager.address, 500, 500, 100]);
    
    // approve xU3LP
    let approveAmount = bnDecimal(100000000000000);
    await dai.approve(xU3LP.address, approveAmount);
    await usdc.approve(xU3LP.address, approveAmount);
    await dai.approve(liquidityPosition2.address, approveAmount);
    await usdc.approve(liquidityPosition2.address, approveAmount);

    // mint initial - required to initialize the liquidity position
    // and create the NFT representing it
    let mintAmount = bnDecimal(100000000);
    await xU3LP.mintInitial(mintAmount, mintAmount);
    console.log('first mint success');
    await liquidityPosition2.mintInitial(mintAmount.mul(10), mintAmount.mul(10));
    console.log('second mint success');

    // minting
    mintAmount = bnDecimal(1000000);
    await xU3LP.mintWithToken(0, mintAmount);
    await xU3LP.mintWithToken(1, mintAmount);
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
    await xU3LP.mintWithToken(1, mintAmount);
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
    console.log('burning 100 000 DAI successful');
    await printPositionAndBufferBalance(xU3LP);

    burnAmount = bnDecimal(300000);
    await xU3LP.burn(1, burnAmount);
    console.log('burning 300 000 USDC successful');
    await printPositionAndBufferBalance(xU3LP);

    // rebalance
    await xU3LP.rebalance();
    console.log('rebalance successful');

    await printPositionAndBufferBalance(xU3LP);

    // minting
    await xU3LP.mintWithToken(0, mintAmount);
    await xU3LP.mintWithToken(1, mintAmount);
    console.log('minting 10 000 DAI and USDC successful');

    await xU3LP.rebalance();
    console.log('rebalance successful');
    await printPositionAndBufferBalance(xU3LP);

    // burning - triggering swap (not enough DAI balance)
    burnAmount = bnDecimal(9400000);
    await xU3LP.burn(0, burnAmount);
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