const { ethers } = require('hardhat');
const { deploy, printPositionAndBufferBalance, 
  bnDecimal, bnDecimals, bn, getTokenPrices, mineBlocks, deployAndLink } = require('../../../helpers');
const addresses = require('../../../uniswapAddresses.json').mainnet;
require('dotenv').config();
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
    let token0 = await ethers.getContractAt('sUSD', tokenAddresses.SUSD);
    let token1 = await ethers.getContractAt('USDC', tokenAddresses.USDC);
    // Swap addresses if they aren't ordered
    if(token0.address > token1.address) {
      let tmp = token0;
      token0 = token1;
      token1 = tmp;
    }
    let token0Decimals = await token0.decimals();
    let token1Decimals = await token1.decimals();

    const positionManager = await ethers.getContractAt(NFTPositionManager.abi, 
      addresses.nonfungibleTokenPositionManagerAddress);

    // Accounts with USDC and sUSD balances
    let USDCAddress = '0x47ac0Fb4F2D84898e4D9E7b4DaB3C24507a6D503'
    let sUSDAddress = '0x042eD37d32B88AB6b1C2E7B8a400dcDc728050bc';
    // Impersonate account with USDC
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [USDCAddress]}
    )
    // Impersonate account with sUSD
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [sUSDAddress]}
    )
    const token0Signer = await ethers.getSigner(sUSDAddress);
    const token1Signer = await ethers.getSigner(USDCAddress);
    let ethSendTx = {
        to: USDCAddress,
        value: bnDecimal(1)
    }
    await admin.sendTransaction(ethSendTx);
    await token0.connect(token0Signer).transfer(admin.address, bnDecimals(1000000, token0Decimals))
    await token1.connect(token1Signer).transfer(admin.address, bnDecimals(1000000, token1Decimals))
    console.log('received token0 and token1 from impersonated account');

    // impersonate proxy owner to upgrade contract
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [proxyAdminAddress]
    });
    let proxyOwner = await ethers.getSigner(proxyAdminAddress);
    ethSendTx.to = proxyOwner.address;
    await admin.sendTransaction(ethSendTx);

    // Deploy xU3LP
    const uniLib = await deploy('UniswapLibrary');
    const xU3LPImpl = await deployAndLink('xU3LPStable', 'UniswapLibrary', uniLib.address);
    await xU3LPImpl.deployed();
    let proxyAddress = '0x74e87fba6c4bcd17fe5f14d73f590ed3c13e821b'
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
    // set twap to 3600
    await xU3LP.setTwapPeriod(3600);
    // swap susd for usdc
    await xU3LP.adminSwap(bnDecimal(6), true);
    await xU3LP.resetTwap();

    await printPositionAndBufferBalance(xU3LP);
    await getTokenPrices(xU3LP);


    let mintTx = await xU3LP.mintWithToken(0, bnDecimals(50, token0Decimals));
    await mineBlocks(5);
    let mintTx2 = await xU3LP.mintWithToken(1, bnDecimals(100, token1Decimals));
    await mineBlocks(5);
    let actualAmounts = await xU3LP.calculatePoolMintedAmounts(bnDecimals(100, token0Decimals), bnDecimals(100, token1Decimals));
    console.log('actual amounts minted:', actualAmounts.amount0Minted.toString(), actualAmounts.amount1Minted.toString());

    await xU3LP.rebalance();
    console.log('rebalance successful');
    await printPositionAndBufferBalance(xU3LP);
    await getTokenPrices(xU3LP);

    let burnTx = await xU3LP.burn(0, bnDecimal(1));
    await mineBlocks(5);
    let burnTx2 = await xU3LP.burn(1, bnDecimal(1));
    await mineBlocks(5);

    console.log('burn successful');
    await printPositionAndBufferBalance(xU3LP);
    await getTokenPrices(xU3LP);

    // mint more liquidity to pool to be able to migrate ticks
    // mint 100 sUSD and 1000 USDC
    let amount0 = bnDecimals(100, token0Decimals);
    let amount1 = bnDecimals(1000, token1Decimals);
    tx = await token0.approve(positionManager.address, approveAmount);
    tx = await token1.approve(positionManager.address, approveAmount);

    await xU3LP.mintWithToken(0, bnDecimals(1000, token0Decimals));
    // swap to equalize pool balances
    await xU3LP.adminSwap(bnDecimal(200), true)

    await printPositionAndBufferBalance(xU3LP);

    // mint some liquidity to try to migrate position
    const lowTick = -276350;
    const highTick = -276290;
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

    // price lower: 0.998
    // price upper: 1.001
    const newLowTick = -276360;
    const newHighTick = -276280;
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