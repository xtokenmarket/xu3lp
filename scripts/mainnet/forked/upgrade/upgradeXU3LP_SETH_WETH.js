const { ethers } = require('hardhat');
const { deploy, printPositionAndBufferBalance, 
  bnDecimal, bnDecimals, getTokenPrices, mineBlocks } = require('../../../helpers');
require('dotenv').config();
const addresses = require('../../../uniswapAddresses.json').mainnet;
const tokenAddresses = require('../../../tokenAddresses.json');
const NFTPositionManager = 
require('@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json');

/**
 * Mainnet Forking Upgrade script
 * Deployes new xU3LP implementation
 * Upgrades existing proxies to point to new implementation - a/b/c and d contracts
 * Tests mint tokens, rebalance, burn and migrate position
 * Need to connect to alchemy Mainnet node in hardhat config and enable forking
 */
async function deployForked() {
    const [admin] = await ethers.getSigners();
    let proxyAdminAddress = process.env.PROXY_ADMIN_ADDRESS;
    let token0 = await ethers.getContractAt('sETH', tokenAddresses.SETH);
    let token1 = await ethers.getContractAt('WETH', tokenAddresses.WETH);
    // Swap addresses if they aren't ordered
    if(token0.address > token1.address) {
      let tmp = token0;
      token0 = token1;
      token1 = tmp;
    }
    let token0Decimals = await token0.decimals();
    let token1Decimals = await token1.decimals();

    // Accounts with SETH and WETH balances
    let sethAddress = '0xc34a7c65aa08cb36744bda8eeec7b8e9891e147c'
    let wethAddress = '0x0F4ee9631f4be0a63756515141281A3E2B293Bbe';
    // Impersonate account with wETH
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [sethAddress]}
    )
    // Impersonate account with sUSD
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [wethAddress]}
    )
    const sethSigner = await ethers.getSigner(sethAddress);
    const wethSigner = await ethers.getSigner(wethAddress);
    await token0.connect(sethSigner).transfer(admin.address, bnDecimals(100, token0Decimals))
    await token1.connect(wethSigner).transfer(admin.address, bnDecimals(100, token1Decimals))
    console.log('received token0 and token1 from impersonated account');

    // impersonate proxy owner to upgrade contract
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [proxyAdminAddress]
    });
    let proxyOwner = await ethers.getSigner(proxyAdminAddress);
    let ethSendTx = {
      to: proxyOwner.address,
      value: bnDecimal(1)
    }
    await admin.sendTransaction(ethSendTx);

    // Deploy xU3LP
    const xU3LPImpl = await deploy('xU3LPStable');
    await xU3LPImpl.deployed();
    let proxyAddress = '0x81E183b1eb969C87c65619b9A653b79812129cC9'
    let xU3LP = await ethers.getContractAt('xU3LPStable', proxyAddress);
    console.log('deployed and initialized xU3LP');

    // Upgrade proxy
    let proxy = await ethers.getContractAt('xU3LPStableProxy', proxyAddress);
    await proxy.connect(proxyOwner).upgradeTo(xU3LPImpl.address);
    console.log('proxy upgraded to new implementation');

    // impersonate xu3lp admin account
    let adminAddress = process.env.XU3LP_ADMIN_ADDRESS;
    // Impersonate manager account
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [adminAddress]}
    )

    const adminSigner = await ethers.getSigner(adminAddress);

    await xU3LP.connect(adminSigner).setManager2(admin.address);
    console.log('success making own address manager');
    
    // approve xU3LP
    approveAmount = bnDecimal(100000000000000);
    tx = await token0.approve(xU3LP.address, approveAmount);
    await tx.wait();
    tx = await token1.approve(xU3LP.address, approveAmount);
    await tx.wait();

    console.log('approved token 0 and token 1 to xU3LP');

    await printPositionAndBufferBalance(xU3LP);
    await getTokenPrices(xU3LP);

    let mintTx = await xU3LP.mintWithToken(0, bnDecimals(25, token0Decimals));
    await mineBlocks(5);
    let mintTx2 = await xU3LP.mintWithToken(1, bnDecimals(25, token1Decimals));
    await mineBlocks(5);

    await xU3LP.rebalance();
    console.log('rebalance successful');
    await printPositionAndBufferBalance(xU3LP);
    await getTokenPrices(xU3LP);

    let burnTx = await xU3LP.burn(0, 1);
    await mineBlocks(5);
    let burnTx2 = await xU3LP.burn(1, 1);

    console.log('burn successful');
    await printPositionAndBufferBalance(xU3LP);
    await getTokenPrices(xU3LP);
    

    // mint more liquidity to pool to be able to migrate ticks
    // mint 1 SETH and 1 WETH
    const positionManager = await ethers.getContractAt(NFTPositionManager.abi, 
      addresses.nonfungibleTokenPositionManagerAddress);
    let amount0 = bnDecimals(1, token0Decimals);
    let amount1 = bnDecimals(1, token1Decimals);
    tx = await token0.approve(positionManager.address, approveAmount);
    tx = await token1.approve(positionManager.address, approveAmount);
    const lowTick = -10;
    const highTick = 10;
    const pendingBlock = await network.provider.send("eth_getBlockByNumber", ["pending", false])
    await positionManager.mint({
      token0: token0.address,
      token1: token1.address,
      fee: 500,
      tickLower: lowTick,
      tickUpper: highTick,
      amount0Desired: amount0,
      amount1Desired: amount1,
      amount0Min: 0,
      amount1Min: 0,
      recipient: admin.address,
      deadline: pendingBlock.timestamp
    })

    // price lower: 0.997
    // price upper: 1.001
    const newLowTick = -30;
    const newHighTick = 10;
    await xU3LP.migratePosition(newLowTick, newHighTick);

    console.log('success migrating position:');
    let newTicks = await xU3LP.getTicks();
    console.log('new ticks:', newTicks.tick0, newTicks.tick1);
  }

deployForked()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });