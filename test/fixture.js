const { ethers, upgrades } = require('hardhat');
const { deployArgs, getPriceInX96Format, bn, bnDecimal } = require('../scripts/helpers');

const swapRouter = require('@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json')
const NFTPositionDescriptor =
 require('@uniswap/v3-periphery/artifacts/contracts/NonFungibleTokenPositionDescriptor.sol/NonFungibleTokenPositionDescriptor.json');
const NFTPositionManager = 
require('@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json');

const UniFactory = require('@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json');

const deploymentFixture = deployments.createFixture(async () => {
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

    let user = signers[1];

    await dai.transfer(user.address, bnDecimal(10000000));
    await usdc.transfer(user.address, bnDecimal(10000000))
    await dai.connect(user).approve(xU3LP.address, approveAmount);
    await usdc.connect(user).approve(xU3LP.address, approveAmount);

    return {
      dai, usdc, router, xU3LP
    }
});
  
module.exports = { deploymentFixture }