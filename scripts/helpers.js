const { ethers } = require("hardhat");


/**
 * Deploy a contract by name without constructor arguments
 */
async function deploy(contractName) {
    let Contract = await ethers.getContractFactory(contractName);
    return await Contract.deploy();
}

/**
 * Deploy a contract by name with constructor arguments
 */
async function deployArgs(contractName, ...args) {
    let Contract = await ethers.getContractFactory(contractName);
    return await Contract.deploy(...args);
}

/**
 * Deploy a contract with abi
 */
 async function deployWithAbi(contract, deployer, ...args) {
    let Factory = new ethers.ContractFactory(contract.abi, contract.bytecode, deployer);
    return await Factory.deploy(...args);
}

/**
 * Get balance of two tokens
 * Used for testing Uniswap pool's tokens
 */
async function getBalance(token0, token1, address) {
    let daiBalance = await token0.balanceOf(address);
    let usdcBalance = await token1.balanceOf(address);
    return {dai: getNumberNoDecimals(daiBalance), usdc: getNumberNoDecimals(usdcBalance)};
  }

/**
 * Get token balance of an address
 */
async function getXU3LPBalance(token, address) {
    let balance = await token.balanceOf(address);
    return balance;
}

/**
 * Get position balance
 * @param xU3LP xU3LP contract
 * @returns 
 */
async function getPositionBalance(xU3LP) {
    let tokenBalance = await xU3LP.getStakedTokenBalance();
    return {
        dai: getNumberNoDecimals(tokenBalance.amount0),
        usdc: getNumberNoDecimals(tokenBalance.amount1)
    }
}

/**
 * Get buffer balance
 * @param xU3LP xU3LP contract
 * @returns 
 */
 async function getBufferBalance(xU3LP) {
    let tokenBalance = await xU3LP.getBufferTokenBalance();
    return {
        dai: getNumberNoDecimals(tokenBalance.amount0),
        usdc: getNumberNoDecimals(tokenBalance.amount1)
    }
}

/**
 * Print the current pool position and xU3LP (buffer) token balances
 * @param xU3LP xU3LP contract
 */
async function printPositionAndBufferBalance(xU3LP) {
    let bufferBalance = await getBufferBalance(xU3LP);
    let positionBalance = await getPositionBalance(xU3LP);
    console.log('xU3LP balance:\n' + 'dai:', bufferBalance.dai, 'usdc:', bufferBalance.usdc);
    console.log('position balance:\n' + 'dai:', positionBalance.dai, 'usdc:', positionBalance.usdc);
}

/**
 * Get the buffer:pool token ratio
 * @param xU3LP xU3LP contract
 */
async function getRatio(xU3LP) {
    let bufferBalance = await xU3LP.getBufferBalance();
    let poolBalance = await xU3LP.getStakedBalance();

    let contractPoolTokenRatio = (getNumberNoDecimals(bufferBalance) + getNumberNoDecimals(poolBalance)) / 
                                  getNumberNoDecimals(bufferBalance);
    
    console.log('xU3LP : pool token ratio:', (100 / contractPoolTokenRatio.toFixed(2)).toFixed(2) + '%');
}

/**
 * Get calculated twaps of token0 and token1
 * @param xU3LP xU3LP contract
 */
async function getTokenPrices(xU3LP) {
    // Increase time by 1 hour = 3600 seconds to get previous price
    await network.provider.send("evm_increaseTime", [3600]);
    await network.provider.send("evm_mine");
    // Get asset 0 price
    let asset0Price = await xU3LP.getAsset0Price();
    let twap0 = getTWAP(asset0Price);
    console.log('twap token0:', twap0);
    // Get Asset 1 Price
    let asset1Price = await xU3LP.getAsset1Price();
    let twap1 = getTWAP(asset1Price);
    console.log('twap token1:', twap1);
    return {
        asset0: twap0,
        asset1: twap1
    }
}

/**
 * Get latest block timestamp
 * @returns current block timestamp
 */
async function getBlockTimestamp() {
    const latestBlock = await network.provider.send("eth_getBlockByNumber", ["latest", false]);
    return web3.utils.hexToNumber(latestBlock.timestamp);
}

/**
 * Return actual twap price from ABDK 64.64 representation
 * Used with getAsset0Price()
 */
function getTWAP(twap) {
    twap = twap.mul(10000).div(bn(2).pow(bn(64)));
    return twap.toNumber() / 10000;
}

/**
 * Get price in x64.96 format for use with Uniswap Pools
 */
function getPriceInX96Format(price) {
    price *= 1000;
    price = price.toFixed(0);
    let factor = bn(2).pow(bn(96));
    let newPrice = bn(price).mul(factor).div(1000);
    return newPrice;
}

/**
 * Return BigNumber
 */
function bn(amount) {
    return new ethers.BigNumber.from(amount);
}

/**
 * Returns bignumber scaled to 18 decimals
 */
function bnDecimal(amount) {
    let decimal = Math.pow(10, 18);
    let decimals = bn(decimal.toString());
    return bn(amount).mul(decimals);
}

/**
 * Returns number representing BigNumber without decimal precision
 */
function getNumberNoDecimals(amount) {
    let decimal = Math.pow(10, 18);
    let decimals = bn(decimal.toString());
    return amount.div(decimals).toNumber();
}

module.exports = {
    deploy, deployArgs, deployWithAbi, getBalance, getTWAP, getPriceInX96Format, getRatio, getTokenPrices,
    getXU3LPBalance, getPositionBalance, getBufferBalance, printPositionAndBufferBalance,
    bn, bnDecimal, getNumberNoDecimals, getBlockTimestamp
}