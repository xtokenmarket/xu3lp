const { ethers } = require("hardhat");
const { utils } = require('ethers');

async function deploy(contractName) {
    let Contract = await ethers.getContractFactory(contractName);
    return await Contract.deploy();
}

async function deployArgs(contractName, ...args) {
    let Contract = await ethers.getContractFactory(contractName);
    return await Contract.deploy(...args);
}

async function getBalance(token0, token1, address) {
    let daiBalance = await token0.balanceOf(address);
    let usdcBalance = await token1.balanceOf(address);
    let decimal = Math.pow(10, 18);
    let decimals = new ethers.BigNumber.from(decimal.toString());
    console.log('dai balance:', daiBalance.div(decimals).toString(), 'usdc balance:', usdcBalance.div(decimals).toString());
    return {dai: daiBalance.toString(), usdc: usdcBalance.toString()};
  }

async function getXU3LPBalance(token, address) {
    let balance = await token.balanceOf(address);
    return balance;
}

function getPositionKey(address, lowerTick, upperTick) {
    return utils.keccak256(utils.solidityPack(['address', 'int24', 'int24'], [address, lowerTick, upperTick]))
}

function bn(amount) {
    return new ethers.BigNumber.from(amount);
}

module.exports = {
    deploy, deployArgs, getPositionKey, getBalance, getXU3LPBalance, bn
}