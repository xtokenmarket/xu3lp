const { ethers } = require('hardhat');
const { deploy, bnDecimal, bnDecimals, deployAndLink } = require('../scripts/helpers');
const tokenAddresses = require('../scripts/tokenAddresses.json');
const uniswapAddresses = require('../scripts/uniswapAddresses.json').mainnet;

const swapRouter = require('@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json')

const deploymentFixture = deployments.createFixture(async () => {
    const signers = await ethers.getSigners();
    const admin = signers[0];
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
    //await proxy.connect(proxyOwner).upgradeTo(xU3LPImpl.address);
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
    let approveAmount = bnDecimal(100000000000000);
    await token0.approve(xU3LP.address, approveAmount);
    await token1.approve(xU3LP.address, approveAmount);

    let user = signers[1];

    await token0.transfer(user.address, bnDecimals(1000000, token0Decimals));
    await token1.transfer(user.address, bnDecimals(1000000, token1Decimals))
    await token0.connect(user).approve(xU3LP.address, approveAmount);
    await token1.connect(user).approve(xU3LP.address, approveAmount);

    const router = await ethers.getContractAt(swapRouter.abi, uniswapAddresses.swapRouter);

    return {
      token0, token1, token0Decimals, token1Decimals, router, xU3LP
    }
});
  
module.exports = { deploymentFixture }