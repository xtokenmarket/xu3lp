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
    console.log('dai balance:', daiBalance.toString(), 'usdc balance:', usdcBalance.toString());
    return {dai: daiBalance.toNumber(), usdc: usdcBalance.toNumber()};
  }

async function getXU3LPBalance(token, address) {
    let balance = await token.balanceOf(address);
    return balance;
}

function getPositionKey(address, lowerTick, upperTick) {
    return utils.keccak256(utils.solidityPack(['address', 'int24', 'int24'], [address, lowerTick, upperTick]))
}

module.exports = {
    deploy, deployArgs, getPositionKey, getBalance, getXU3LPBalance
}