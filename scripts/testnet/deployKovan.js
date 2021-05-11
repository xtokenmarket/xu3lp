const { ethers } = require('hardhat');
const { deploy, deployArgs, printPositionAndBufferBalance, getPriceInX96Format, 
        getNumberNoDecimals, bnDecimal, getRatio, mineBlocks } = require('../helpers');
const addresses = require('../uniswapAddresses.json').kovan;

const swapRouter = require('@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json')
const NFTPositionManager = 
require('@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json');
const UniFactory = require('@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json');

/**
 * Testnet fork script designed to work with Uniswap Kovan deployment
 * Need to connect to alchemy Kovan node and enable forking in hardhat config before running
 */
async function deployXU3LP() {
    const [admin, user1, proxyAdmin] = await ethers.getSigners();
    let token0 = await deployArgs('DAI', 'DAI', 'DAI');
    let token1 = await deployArgs('USDC', 'USDC', 'USDC');
    // Tokens must be sorted by address
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
    const lowTick = -60;
    const highTick = 60;
    // Price = 1
    const price = getPriceInX96Format(1);

    await positionManager.createAndInitializePoolIfNecessary(token0.address, token1.address, 500, price);
    const poolAddress = await uniFactory.getPool(token0.address, token1.address, 500);
    
    const xU3LPImpl = await deploy('xU3LPStable');
    const xU3LPProxy = await deployArgs('xU3LPStableProxy', xU3LPImpl.address, proxyAdmin.address);
    const xU3LP = await ethers.getContractAt('xU3LPStable', xU3LPProxy.address);
    await xU3LP.initialize('xU3LP', lowTick, highTick, token1.address, token0.address, 
        poolAddress, router.address, positionManager.address,
        {mintFee: 1250, burnFee: 1250, claimFee: 50}, 200, token0Decimals, token1Decimals);
    
    // approve xU3LP
    let approveAmount = bnDecimal(100000000000000);
    await token0.approve(xU3LP.address, approveAmount);
    await token1.approve(xU3LP.address, approveAmount);

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

    burnAmount = bnDecimal(30000);
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
    await xU3LP.mintWithToken(1, mintAmount);
    await mineBlocks(5);
    console.log('minting 1 000 000 token0 and token1 successful');

    await xU3LP.rebalance();
    console.log('rebalance successful');
    await printPositionAndBufferBalance(xU3LP);

    // burning - triggering swap (not enough token1 balance)
    burnAmount = bnDecimal(10000000);
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