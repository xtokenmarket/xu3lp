const { ethers } = require('hardhat');
const { deploy, deployAndLink, printPositionAndBufferBalance, getMainnetxTokenManager,
  bnDecimal, bnDecimals, getTokenPrices, mineBlocks } = require('../../../helpers');
require('dotenv').config();
const tokenAddresses = require('../../../tokenAddresses.json');

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
    let token0 = await ethers.getContractAt('USDC', tokenAddresses.USDC);
    let token1 = await ethers.getContractAt('USDT', tokenAddresses.USDT);
    // Swap addresses if they aren't ordered
    if(token0.address > token1.address) {
      let tmp = token0;
      token0 = token1;
      token1 = tmp;
    }
    let token0Decimals = await token0.decimals();
    let token1Decimals = await token1.decimals();

    // Account with USDT and USDC balance
    let accountAddress = '0x47ac0Fb4F2D84898e4D9E7b4DaB3C24507a6D503'
    // Impersonate account with USDT and USDC
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [accountAddress]}
    )
    const signer = await ethers.getSigner(accountAddress)
      let ethSendTx = {
        to: accountAddress,
        value: bnDecimal(1)
    }
    await admin.sendTransaction(ethSendTx);
    await token0.connect(signer).transfer(admin.address, bnDecimals(1000000, token0Decimals))
    await token1.connect(signer).transfer(admin.address, bnDecimals(1000000, token1Decimals))
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
    let proxyAddress = '0x420CF01fdC7e3c42c3D89ae8799bACCBfFa9ceAA'
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

    // Set admin address as manager to xU3LP instance
    const xTokenManager = await getMainnetxTokenManager();
    await xU3LP.connect(adminSigner).setxTokenManager(xTokenManager.address);
    await xTokenManager.connect(adminSigner).addManager(admin.address, proxyAddress);
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

    let mintTx = await xU3LP.mintWithToken(0, bnDecimals(10, token0Decimals));
    await mineBlocks(5);
    let mintTx2 = await xU3LP.mintWithToken(1, bnDecimals(10, token1Decimals));
    await mineBlocks(5);

    await xU3LP.rebalance();
    console.log('rebalance successful');
    await printPositionAndBufferBalance(xU3LP);
    await getTokenPrices(xU3LP);

    let burnTx = await xU3LP.burn(0, bnDecimal(1));
    await mineBlocks(5);
    let burnTx2 = await xU3LP.burn(1, bnDecimal(1));

    console.log('burn successful');
    await printPositionAndBufferBalance(xU3LP);
    await getTokenPrices(xU3LP);

    // price lower: 0.998
    // price upper: 1.001
    const newLowTick = -20;
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