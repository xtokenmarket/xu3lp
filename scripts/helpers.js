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
 * Get balance of two tokens
 * Used for testing Uniswap pool's tokens
 */
async function getBalance(token0, token1, address) {
    let daiBalance = await token0.balanceOf(address);
    let usdcBalance = await token1.balanceOf(address);
    let decimal = Math.pow(10, 18);
    let decimals = new ethers.BigNumber.from(decimal.toString());
    console.log('dai balance:', daiBalance.div(decimals).toString(), 'usdc balance:', usdcBalance.div(decimals).toString());
    return {dai: daiBalance.toString(), usdc: usdcBalance.toString()};
  }

  /**
   * Get token balance of an address
   */
async function getXU3LPBalance(token, address) {
    let balance = await token.balanceOf(address);
    return balance;
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
    deploy, deployArgs, getBalance, getTWAP, getPriceInX96Format, getXU3LPBalance, bn, bnDecimal, getNumberNoDecimals
}