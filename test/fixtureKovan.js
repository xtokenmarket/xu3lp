const { ethers } = require('hardhat');
const { deploy, deployArgs, getPriceInX96Format, bnDecimal, bnDecimals } = require('../scripts/helpers');
const addresses = require('../scripts/uniswapAddresses.json').kovan;

const swapRouter = require('@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json');
const NFTPositionManager = 
require('@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json');

const UniFactory = require('@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json');

// Test fixture designed to work with kovan or kovan fork
// Connects to Uni V3 contracts deployed on kovan
const deploymentFixture = deployments.createFixture(async () => {
    const signers = await ethers.getSigners();
    let token0 = await deployArgs('DAI', 'DAI', 'DAI');
    let token1 = await deployArgs('USDT', 'USDT', 'USDT');

    // Tokens must be sorted by address
    if(token0.address > token1.address) {
      let tmp = token0;
      token0 = token1;
      token1 = tmp;
    }
    const token0Decimals = await token0.decimals();
    const token1Decimals = await token1.decimals();

    const uniFactory = await ethers.getContractAt(UniFactory.abi, addresses.v3CoreFactoryAddress);
    const positionManager = await ethers.getContractAt(NFTPositionManager.abi, 
                                    addresses.nonfungibleTokenPositionManagerAddress);
    const router = await ethers.getContractAt(swapRouter.abi, 
                                    addresses.swapRouter);

    let lowTick, highTick, price;
    if(token0Decimals > token1Decimals) {
      // 0.997 - 1.003 price
      // for tokens with 18 : 6 decimals
      lowTick = -276350;
      highTick = -276290;
      price = '79244113692861321940131'
    } else {
      // 0.997 - 1.003 price
      // for tokens with 6 : 18 decimals
      lowTick = 276290;
      highTick = 276350;
      price = '79212214546506452527748886075123928'
    }

    // 0.997 - 1.003 price
    // const lowTick = -30;
    // const highTick = 30;
    // // Price = 1
    // const price = getPriceInX96Format(1);

    await positionManager.createAndInitializePoolIfNecessary(token0.address, token1.address, 500, price);
    const poolAddress = await uniFactory.getPool(token0.address, token1.address, 500);
    
    const xU3LPImpl = await deploy('xU3LPStable');
    const xU3LPProxy = await deployArgs('xU3LPStableProxy', xU3LPImpl.address, signers[3].address);
    const xU3LP = await ethers.getContractAt('xU3LPStable', xU3LPProxy.address);
    await xU3LP.initialize("xU3LP", lowTick, highTick, token0.address, token1.address, 
        poolAddress, router.address, positionManager.address, 
        {mintFee: 1250, burnFee: 1250, claimFee: 50}, 200, token0Decimals, token1Decimals);
    

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