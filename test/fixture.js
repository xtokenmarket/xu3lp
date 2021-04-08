const { ethers, upgrades } = require('hardhat');
const { deploy, deployArgs } = require('../scripts/helpers');

const swapRouter = require('@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json')
const UniFactory = require('@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json');
const UniPool = require('@uniswap/v3-core/artifacts/contracts/UniswapV3Pool.sol/UniswapV3Pool.json');

const deploymentFixture = deployments.createFixture(async () => {
    const signers = await ethers.getSigners();
    const dai = await deployArgs('DAI', 'DAI', 'DAI');
    const usdc = await deployArgs('USDC', 'USDC', 'USDC');

    let Factory = new ethers.ContractFactory(UniFactory.abi, UniFactory.bytecode, signers[0]);
    const uniFactory = await Factory.deploy();

    await uniFactory.createPool(dai.address, usdc.address, 500);
    const poolAddress = await uniFactory.getPool(dai.address, usdc.address, 500);
    console.log('pool deployed');

    const pool = await ethers.getContractAt(UniPool.abi, poolAddress);
    // Initialize pool with price 1
    await pool.initialize(ethers.BigNumber.from('79228162514264337593543950336'));

    const Router = new ethers.ContractFactory(swapRouter.abi, swapRouter.bytecode, signers[0]);
    const router = await Router.deploy(uniFactory.address, dai.address);

    // 0.997 - 1.003 price
    const lowTick = -30;
    const highTick = 30;
    // Prices calculated using the ticks above from TickMath.getSqrtRatioAtTick()
    const lowPrice = ethers.BigNumber.from('79109415290437042302807587396');
    const highPrice = ethers.BigNumber.from('79347087983666005045280518415');
    
    const XU3LP = await ethers.getContractFactory("xU3LPStable");
    const xU3LP = await upgrades.deployProxy(XU3LP, ["xU3LP", lowTick, highTick, lowPrice, highPrice,
                                             dai.address, usdc.address, pool.address, router.address, 500, 500, 100]);
    await uniFactory.setOwner(xU3LP.address);

    // approve xU3LP
    await dai.approve(xU3LP.address, 1000000);
    await usdc.approve(xU3LP.address, 1000000);

    return {
      dai, usdc, pool, router, xU3LP
    }
});
  
module.exports = { deploymentFixture }