const { ethers } = require('hardhat');
const { deploy, deployArgs, bnDecimal, bnDecimals, deployWithAbi, getPriceInX96Format, deployAndLink } = require('../scripts/helpers');

const swapRouter = require('@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json')
const NFTPositionDescriptor =
 require('@uniswap/v3-periphery/artifacts/contracts/NonFungibleTokenPositionDescriptor.sol/NonFungibleTokenPositionDescriptor.json');
const NFTPositionManager = 
require('@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json');

const UniFactory = require('@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json');
const UniPool = require('@uniswap/v3-core/artifacts/contracts/UniswapV3Pool.sol/UniswapV3Pool.json');

const deploymentFixture = deployments.createFixture(async () => {
    const signers = await ethers.getSigners();
    const admin = signers[0];
    const proxyAdmin = signers[4];

    let token0 = await deployArgs('DAI', 'DAI', 'DAI');
    let token1 = await deployArgs('USDC', 'USDC', 'USDC');
    const weth = await deployArgs('WETH', 'WETH', 'WETH');
    // Tokens must be sorted by address
    if(token0.address > token1.address) {
      let tmp = token0;
      token0 = token1;
      token1 = tmp;
    }
    const token0Decimals = await token0.decimals();
    const token1Decimals = await token1.decimals();

    const uniFactory = await deployWithAbi(UniFactory, admin);
    const tokenDescriptor = await deployWithAbi(NFTPositionDescriptor, admin, weth.address);
    const positionManager = await deployWithAbi(NFTPositionManager, admin, 
                                                uniFactory.address, weth.address, tokenDescriptor.address);
    const router = await deployWithAbi(swapRouter, admin, uniFactory.address, weth.address);

    // 0.997 - 1.003 price
    // for tokens with 18 : 6 decimals
    let lowTick = -276350;
    let highTick = -276290;
    let price = '79244113692861321940131'

    // 0.997 - 1.003 price
    // for tokens with identical decimals
    // const lowTick = -30;
    // const highTick = 30;
    // // Price = 1
    // const price = getPriceInX96Format(1);

    await positionManager.createAndInitializePoolIfNecessary(token0.address, token1.address, 500, price);
    const poolAddress = await uniFactory.getPool(token0.address, token1.address, 500);
    const pool = await ethers.getContractAt(UniPool.abi, poolAddress);
    // increase stored oracle observations to 10
    await pool.increaseObservationCardinalityNext(10);

    // deploy Uniswap Library
    const uniLibrary = await deploy('UniswapLibrary');
    
    const xU3LPImpl = await deployAndLink('xU3LPStable', 'UniswapLibrary', uniLibrary.address);
    const xU3LPProxy = await deployArgs('xU3LPStableProxy', xU3LPImpl.address, proxyAdmin.address);
    const xU3LP = await ethers.getContractAt('xU3LPStable', xU3LPProxy.address);
    await xU3LP.initialize("xU3LP", lowTick, highTick, token0.address, token1.address, 
        poolAddress, router.address, positionManager.address, 
        {mintFee: 1250, burnFee: 1250, claimFee: 50}, 200, token0Decimals, token1Decimals);
    await xU3LP.setTwapPeriod(3600);
    

    // approve xU3LP
    let approveAmount = bnDecimal(100000000000000);
    await token0.approve(xU3LP.address, approveAmount);
    await token1.approve(xU3LP.address, approveAmount);

    let user = signers[1];

    await token0.transfer(user.address, bnDecimals(10000000, token0Decimals));
    await token1.transfer(user.address, bnDecimals(10000000, token1Decimals))
    await token0.connect(user).approve(xU3LP.address, approveAmount);
    await token1.connect(user).approve(xU3LP.address, approveAmount);

    return {
      token0, token1, token0Decimals, token1Decimals, router, xU3LP
    }
});
  
module.exports = { deploymentFixture }