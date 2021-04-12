const { ethers, upgrades } = require('hardhat');
const { deploy, deployArgs, getPositionKey, getBalance } = require('./helpers');

const swapRouter = require('@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json')
const UniFactory = require('@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json');
const UniPool = require('@uniswap/v3-core/artifacts/contracts/UniswapV3Pool.sol/UniswapV3Pool.json');

async function deployXU3LP() {
    const signers = await ethers.getSigners();

    const dai = await deployArgs('DAI', 'DAI', 'DAI');
    const usdc = await deployArgs('USDC', 'USDC', 'USDC');

    let Factory = new ethers.ContractFactory(UniFactory.abi, UniFactory.bytecode, signers[0]);
    const uniFactory = await Factory.deploy();

    await uniFactory.createPool(dai.address, usdc.address, 500);
    const poolAddress = await uniFactory.getPool(dai.address, usdc.address, 500);
    console.log('pool deployed');

    // 0.997 - 1.003 price
    const lowTick = -30;
    const highTick = 30;
    // Prices calculated using the ticks above with TickMath.getSqrtRatioAtTick()
    const lowPrice = ethers.BigNumber.from('79109415290437042302807587396');
    const highPrice = ethers.BigNumber.from('79347087983666005045280518415');
    const price = ethers.BigNumber.from('79228162514264337593543950336');

    const pool = await ethers.getContractAt(UniPool.abi, poolAddress);
    await pool.initialize(price);

    const Router = new ethers.ContractFactory(swapRouter.abi, swapRouter.bytecode, signers[0]);
    const router = await Router.deploy(uniFactory.address, dai.address);

    
    const XU3LP = await ethers.getContractFactory("xU3LPStable");
    const xU3LP = await upgrades.deployProxy(XU3LP, ["xU3LP", lowTick, highTick, lowPrice, highPrice, 
                                  dai.address, usdc.address, pool.address, router.address, 500, 500, 100]);
    await uniFactory.setOwner(xU3LP.address);

    // approve xU3LP
    await dai.approve(xU3LP.address, 1000000);
    await usdc.approve(xU3LP.address, 1000000);

    // minting
    await xU3LP.mintWithToken(0, '10000');
    await xU3LP.mintWithToken(1, '10000');
    console.log('minting successful');

    await getBalance(dai, usdc, xU3LP.address);
    await getBalance(dai, usdc, pool.address);

    // rebalance

    await xU3LP.rebalance();
    console.log('rebalance successful');

    await getBalance(dai, usdc, xU3LP.address);
    await getBalance(dai, usdc, pool.address);

    // burning
    await xU3LP.burn(0, '100');
    console.log('burning successful');
    await getBalance(dai, usdc, xU3LP.address);
    await getBalance(dai, usdc, pool.address);
    await xU3LP.burn(1, '300');
    console.log('burning successful');

    await getBalance(dai, usdc, xU3LP.address);
    await getBalance(dai, usdc, pool.address);

    // rebalance
    await xU3LP.rebalance();
    console.log('rebalance successful');

    await getBalance(dai, usdc, xU3LP.address);
    await getBalance(dai, usdc, pool.address);

    // minting
    await xU3LP.mintWithToken(0, '10000');
    await xU3LP.mintWithToken(1, '10000');
    console.log('minting successful');

    await xU3LP.rebalance();
    console.log('rebalance successful');
    await getBalance(dai, usdc, xU3LP.address);
    await getBalance(dai, usdc, pool.address);

    // burning - triggering swap (not enough DAI balance)
    await xU3LP.burn(0, '1500');
    console.log('burning successful');
    await getBalance(dai, usdc, xU3LP.address);
    await getBalance(dai, usdc, pool.address);

    await xU3LP.rebalance();
    console.log('rebalance successful');

    await getBalance(dai, usdc, xU3LP.address);
    await getBalance(dai, usdc, pool.address);

    // Get fees
    let feesDAI = await xU3LP.withdrawableToken0Fees();
    let feesUSDC = await xU3LP.withdrawableToken1Fees();
    console.log('fees dai:', feesDAI.toString(), 'usdc:', feesUSDC.toString())
  }

deployXU3LP()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });