const { ethers } = require('hardhat');
const { deploy, deployArgs, printPositionAndBufferBalance, 
        getPriceInX96Format, bnDecimal, getTokenPrices } = require('./helpers');
const addresses = require('./uniswapAddresses.json').kovan;

const swapRouter = require('@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json')
const NFTPositionManager = 
require('@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json');
const UniFactory = require('@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json');

/**
 * Testnet script designed to work with Uniswap Kovan deployment
 * Gets xU3LP AUM
 * Need to connect to alchemy Kovan node in hardhat config before running and run with --network kovan
 */
async function interactKovan() {
    const [admin, user1, proxyAdmin] = await ethers.getSigners();
    let token0 = await ethers.getContractAt('DAI', '0x7444b6f093e9a3cb80aebb11503fa12f2748690e');
    let token1 = await ethers.getContractAt('USDC', '0xee512781d102288fa9e29033bcfd7cb73430c528');
    
    const uniFactory = await ethers.getContractAt(UniFactory.abi, addresses.v3CoreFactoryAddress);
    const positionManager = await ethers.getContractAt(NFTPositionManager.abi, 
                                    addresses.nonfungibleTokenPositionManagerAddress);
    const router = await ethers.getContractAt(swapRouter.abi, 
                                    addresses.swapRouter);

    // Swap addresses if they don't match
    if(token0.address > token1.address) {
      let tmp = token0;
      token0 = token1;
      token1 = tmp;
    }
    const poolAddress = await uniFactory.getPool(token0.address, token1.address, 500);
    console.log('pool address:', poolAddress);

    const proxyAddress = '0xA7ab15A9166334bB2EFe3Dc59625a6FEdEcfD517';
    let xU3LP = await ethers.getContractAt('xU3LPStable', proxyAddress);
    
    await getTokenPrices(xU3LP);
    console.log('rebalance successful');
    await printPositionAndBufferBalance(xU3LP);
  }

interactKovan()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });