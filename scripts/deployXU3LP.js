const { ethers, upgrades } = require('hardhat');
const { deploy, deployArgs, getBalance, getPriceInX96Format, bn } = require('./helpers');

const swapRouter = require('@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json')
const NFTPositionDescriptor =
 require('@uniswap/v3-periphery/artifacts/contracts/NonFungibleTokenPositionDescriptor.sol/NonFungibleTokenPositionDescriptor.json');
const NFTPositionManager = 
require('@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json');

const UniFactory = require('@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json');

async function deployXU3LP() {
    const signers = await ethers.getSigners();

    const dai = await deployArgs('DAI', 'DAI', 'DAI');
    const usdc = await deployArgs('USDC', 'USDC', 'USDC');

    let Factory = new ethers.ContractFactory(UniFactory.abi, UniFactory.bytecode, signers[0]);
    const uniFactory = await Factory.deploy();

    // 0.997 - 1.003 price
    const lowTick = -60;
    const highTick = 60;
    // Price = 1
    const price = getPriceInX96Format(1);

    const TokenDescriptor = new ethers.ContractFactory(NFTPositionDescriptor.abi, NFTPositionDescriptor.bytecode, signers[0]);
    const PositionManager = new ethers.ContractFactory(NFTPositionManager.abi, NFTPositionManager.bytecode, signers[0]);
    const tokenDescriptor = await TokenDescriptor.deploy(dai.address);
    const positionManager = await PositionManager.deploy(uniFactory.address, dai.address, tokenDescriptor.address);
    console.log('deployed position manager');

    await positionManager.createAndInitializePoolIfNecessary(dai.address, usdc.address, 500, price);
    const poolAddress = await uniFactory.getPool(dai.address, usdc.address, 500);
    console.log('pool deployed');

    const Router = new ethers.ContractFactory(swapRouter.abi, swapRouter.bytecode, signers[0]);
    const router = await Router.deploy(uniFactory.address, dai.address);
    
    const XU3LP = await ethers.getContractFactory("xU3LPStable");
    const xU3LP = await upgrades.deployProxy(XU3LP, ["xU3LP", lowTick, highTick, dai.address, usdc.address, 
                                          poolAddress, router.address, positionManager.address, 500, 500, 100]);
    

    // approve xU3LP
    let decimal = Math.pow(10, 18);
    let decimals = bn(decimal.toString());
    let approveAmount = bn(100000000000000).mul(decimals);
    await dai.approve(xU3LP.address, approveAmount);
    await usdc.approve(xU3LP.address, approveAmount);

    // mint initial - required to initialize the liquidity position 
    // and create the NFT representing it
    let mintAmount = bn(100000000).mul(decimals);
    await xU3LP.mintInitial(mintAmount, mintAmount);
    console.log('first mint success');

    let stakedBalance = await xU3LP.getStakedBalance();
    console.log('staked balance in pool:', stakedBalance.div(decimals).toString());

    // minting
    mintAmount = bn(10000).mul(decimals);
    await xU3LP.mintWithToken(0, mintAmount);
    await xU3LP.mintWithToken(1, mintAmount);
    console.log('minting 10 000 DAI and USDC successful');

    await getBalance(dai, usdc, xU3LP.address);
    await getBalance(dai, usdc, poolAddress);

    // rebalance
    await xU3LP.rebalance();
    console.log('rebalance successful');

    await getBalance(dai, usdc, xU3LP.address);
    await getBalance(dai, usdc, poolAddress);

    // burning
    let burnAmount = bn(100).mul(decimals);
    await xU3LP.burn(0, burnAmount);
    console.log('burning 100 DAI successful');
    await getBalance(dai, usdc, xU3LP.address);
    await getBalance(dai, usdc, poolAddress);

    burnAmount = bn(300).mul(decimals);
    await xU3LP.burn(1, burnAmount);
    console.log('burning 300 USDC successful');
    await getBalance(dai, usdc, xU3LP.address);
    await getBalance(dai, usdc, poolAddress);

    // rebalance
    await xU3LP.rebalance();
    console.log('rebalance successful');

    await getBalance(dai, usdc, xU3LP.address);
    await getBalance(dai, usdc, poolAddress);

    // minting
    await xU3LP.mintWithToken(0, mintAmount);
    await xU3LP.mintWithToken(1, mintAmount);
    console.log('minting 10 000 DAI and USDC successful');

    await xU3LP.rebalance();
    console.log('rebalance successful');
    await getBalance(dai, usdc, xU3LP.address);
    await getBalance(dai, usdc, poolAddress);

    // burning - triggering swap (not enough DAI balance)
    burnAmount = bn(1000000).mul(decimals);
    await xU3LP.burn(0, burnAmount);
    console.log('burning 1000000 DAI successful');
    await getBalance(dai, usdc, xU3LP.address);
    await getBalance(dai, usdc, poolAddress);

    await xU3LP.rebalance();
    console.log('rebalance successful');

    await getBalance(dai, usdc, xU3LP.address);
    await getBalance(dai, usdc, poolAddress);

    // Get fees
    let feesDAI = await xU3LP.withdrawableToken0Fees();
    let feesUSDC = await xU3LP.withdrawableToken1Fees();
    console.log('fees dai:', feesDAI.div(decimals).toString(), 'usdc:', feesUSDC.div(decimals).toString())
  }

deployXU3LP()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });