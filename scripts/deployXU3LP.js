const { ethers, upgrades } = require('hardhat');
const { deployArgs, printPositionAndBufferBalance, getPriceInX96Format, 
        getNumberNoDecimals, bn, bnDecimal, getRatio } = require('./helpers');

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

    // burning
    let burnAmount = bnDecimal(10000);
    await xU3LP.burn(0, burnAmount);
    console.log('burning 10 000 DAI successful');
    await printPositionAndBufferBalance(xU3LP);

    burnAmount = bnDecimal(30000);
    await xU3LP.burn(1, burnAmount);
    console.log('burning 30 000 USDC successful');
    await printPositionAndBufferBalance(xU3LP);

    // rebalance
    await xU3LP.rebalance();
    console.log('rebalance successful');

    await printPositionAndBufferBalance(xU3LP);

    // minting
    await xU3LP.mintWithToken(0, mintAmount);
    await xU3LP.mintWithToken(1, mintAmount);
    console.log('minting 1 000 000 DAI and USDC successful');

    await xU3LP.rebalance();
    console.log('rebalance successful');
    await printPositionAndBufferBalance(xU3LP);

    // burning - triggering swap (not enough USDC balance)
    burnAmount = bnDecimal(10000000);
    await xU3LP.burn(1, burnAmount);
    console.log('burning 10 000 000 USDC successful');
    await printPositionAndBufferBalance(xU3LP);

    await xU3LP.rebalance();
    console.log('rebalance successful');
    await getRatio(xU3LP);

    // Get fees
    let feesDAI = await xU3LP.withdrawableToken0Fees();
    let feesUSDC = await xU3LP.withdrawableToken1Fees();
    console.log('fees dai:', getNumberNoDecimals(feesDAI), 'usdc:', getNumberNoDecimals(feesUSDC));
    
    console.log('setting manager 1 to user1');
    let user1 = signers[1];
    await xU3LP.setManager(user1.address);
    await xU3LP.connect(user1).withdrawFees();
    console.log('success withdrawing fees from manager 1');
    
    feesDAI = await xU3LP.withdrawableToken0Fees();
    feesUSDC = await xU3LP.withdrawableToken1Fees();
    console.log('fees dai:', getNumberNoDecimals(feesDAI), 'usdc:', getNumberNoDecimals(feesUSDC));
  }

deployXU3LP()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });