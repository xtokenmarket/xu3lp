const { ethers, network } = require('hardhat');
const { deploy, deployArgs, deployWithAbi, printPositionAndBufferBalance, getPriceInX96Format, 
        getNumberNoDecimals, bnDecimal, bnCustomDecimals, getRatio, mineBlocks } = require('../helpers');
const addresses = require('../uniswapAddresses.json').mainnet;

const swapRouter = require('@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json')
const NFTPositionDescriptor =
 require('@uniswap/v3-periphery/artifacts/contracts/NonFungibleTokenPositionDescriptor.sol/NonFungibleTokenPositionDescriptor.json');
const NFTPositionManager = 
require('@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json');

const UniFactory = require('@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json');

/**
 * Script which tests deposits and swaps with tokens with different decimals
 * For mainnet fork
 */
async function deployXU3LP() {
    const [admin, user1, proxyAdmin] = await ethers.getSigners();

    // // dai is 18 decimals
    // const dai = await deployArgs('DAI', 'DAI', 'DAI');
    // // usdc is 6 decimals
    // const usdc = await deployArgs('USDC', 'USDC', 'USDC');

    // This address has 1.777 Million USDC
    // And 250 Million DAI
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: ["0x47ac0Fb4F2D84898e4D9E7b4DaB3C24507a6D503"]}
    )
    const signer = await ethers.getSigner("0x47ac0Fb4F2D84898e4D9E7b4DaB3C24507a6D503")
    console.log('got signer', signer);

    const dai = await ethers.getContractAt('DAI', '0x6b175474e89094c44da98b954eedeac495271d0f');
    // // usdc is 6 decimals
    const usdc = await ethers.getContractAt('USDC', '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48');

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


    // if(token0.address > token1.address) {
    //   let tmp = token0;
    //   token0 = token1;
    //   token1 = tmp;
    // }

    await positionManager.createAndInitializePoolIfNecessary(dai.address, usdc.address, 500, price);
    const poolAddress = await uniFactory.getPool(dai.address, usdc.address, 500);
    
    const xU3LPImpl = await deploy('xU3LPStable');
    const xU3LPProxy = await deployArgs('xU3LPStableProxy', xU3LPImpl.address, proxyAdmin.address);
    const xU3LP = await ethers.getContractAt('xU3LPStable', xU3LPProxy.address);
    await xU3LP.initialize('xU3LP', lowTick, highTick, dai.address, usdc.address, 
        poolAddress, router.address, positionManager.address, 500, 500, 100);
    await xU3LP.transferOwnership(signer.address);
    console.log('ownership transferred');
    
    // approve xU3LP
    let approveAmount = bnDecimal(100000000000000);
    await dai.connect(signer).approve(xU3LP.address, approveAmount);
    await usdc.connect(signer).approve(xU3LP.address, approveAmount);

    // mint initial - required to initialize the liquidity position
    // and create the NFT representing it
    let mintAmount = bnDecimal(100000000);
    let mintAmount2 = bnCustomDecimals(100000000, 6);
    await xU3LP.connect(signer).mintInitial(mintAmount, mintAmount2);
    console.log('first mint success');

    // minting
    mintAmount = bnDecimal(1000000);
    mintAmount2 = bnCustomDecimals(1000000, 6);

    await xU3LP.mintWithToken(0, mintAmount);
    await mineBlocks(5);
    await xU3LP.mintWithToken(1, mintAmount2);
    await mineBlocks(5);
    console.log('minting 1 000 000 DAI and USDC successful');
    await printPositionAndBufferBalance(xU3LP);

    // rebalance
    await xU3LP.rebalance();
    console.log('rebalance successful');
    await printPositionAndBufferBalance(xU3LP);

    return;

    // burning
    let burnAmount = bnDecimal(10000);
    await xU3LP.burn(0, burnAmount);
    await mineBlocks(5);
    console.log('burning 10 000 DAI successful');
    await printPositionAndBufferBalance(xU3LP);

    burnAmount = bnCustomDecimals(30000, 6);
    await xU3LP.burn(1, burnAmount);
    await mineBlocks(5);
    console.log('burning 30 000 USDC successful');
    await printPositionAndBufferBalance(xU3LP);

    // rebalance
    await xU3LP.rebalance();
    console.log('rebalance successful');

    await printPositionAndBufferBalance(xU3LP);

    // minting
    await xU3LP.mintWithToken(0, mintAmount);
    await mineBlocks(5);
    await xU3LP.mintWithToken(1, mintAmount2);
    await mineBlocks(5);
    console.log('minting 1 000 000 DAI and USDC successful');

    await xU3LP.rebalance();
    console.log('rebalance successful');
    await printPositionAndBufferBalance(xU3LP);

    // burning - triggering swap (not enough USDC balance)
    burnAmount = bnDecimal(10000000);
    await xU3LP.burn(1, burnAmount);
    await mineBlocks(5);
    console.log('burning 10 000 000 USDC successful');
    await printPositionAndBufferBalance(xU3LP);

    await xU3LP.rebalance();
    console.log('rebalance successful');
    await getRatio(xU3LP);
  }

deployXU3LP()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });