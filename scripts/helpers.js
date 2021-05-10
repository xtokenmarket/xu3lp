const { ethers, network } = require("hardhat");


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
    return {
        dai: getNumberDivDecimals(daiBalance, await token0.decimals()), 
        usdc: getNumberDivDecimals(usdcBalance, await token1.decimals())
    };
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
 * Print the buffer:pool token ratio
 * @param xU3LP xU3LP contract
 */
async function getRatio(xU3LP) {
    let bufferBalance = await xU3LP.getBufferBalance();
    let poolBalance = await xU3LP.getStakedBalance();
    console.log('buffer balance:', getNumberNoDecimals(bufferBalance));
    console.log('position balance:', getNumberNoDecimals(poolBalance));

    let contractPoolTokenRatio = (getNumberNoDecimals(bufferBalance) + getNumberNoDecimals(poolBalance)) / 
                                  getNumberNoDecimals(bufferBalance);
    
    console.log('xU3LP : pool token ratio:', (100 / contractPoolTokenRatio.toFixed(2)).toFixed(2) + '%');
}

/**
 * Get the buffer:staked token ratio
 * @param xU3LP xU3LP contract
 */
 async function getBufferPositionRatio(xU3LP) {
    let bufferBalance = await xU3LP.getBufferBalance();
    let poolBalance = await xU3LP.getStakedBalance();

    let contractPoolTokenRatio = (getNumberNoDecimals(bufferBalance) + getNumberNoDecimals(poolBalance)) / 
                                  getNumberNoDecimals(bufferBalance);
    
    return (100 / contractPoolTokenRatio).toFixed(1);
}

/**
 * Get calculated twaps of token0 and token1
 * @param xU3LP xU3LP contract
 */
async function getTokenPrices(xU3LP) {
    // Increase time by 1 hour = 3600 seconds to get previous price
    await network.provider.send("evm_increaseTime", [300]);
    await network.provider.send("evm_mine");
    // Get asset 0 price
    let asset0Price = await xU3LP.getAsset0Price();
    console.log('asset 0 price:', asset0Price.toString());
    let twap0 = getTWAP(asset0Price);
    console.log('twap token0:', twap0);
    // Get Asset 1 Price
    let asset1Price = await xU3LP.getAsset1Price();
    console.log('asset 1 price:', asset1Price.toString());
    let twap1 = getTWAP(asset1Price);
    console.log('twap token1:', twap1);
    return {
        asset0: twap0,
        asset1: twap1
    }
}

async function swapToken0ForToken1(router, token0, token1, swapperAddress, amount) {
    const lowPrice = getPriceInX96Format(0.997);
    const pendingBlock = await network.provider.send("eth_getBlockByNumber", ["pending", false])
    const timestamp = pendingBlock.timestamp + 10000;

    await router.exactInputSingle({
        tokenIn: token0.address,
        tokenOut: token1.address,
        fee: 500,
        recipient: swapperAddress,
        deadline: timestamp,
        amountIn: amount,
        amountOutMinimum: amount.sub(amount.div(100)),
        sqrtPriceLimitX96: lowPrice
      });
}

async function swapToken1ForToken0(router, token0, token1, swapperAddress, amount) {
    const highPrice = getPriceInX96Format(1.003);
    const pendingBlock = await network.provider.send("eth_getBlockByNumber", ["pending", false])
    const timestamp = pendingBlock.timestamp + 10000;

    await router.exactInputSingle({
        tokenIn: token1.address,
        tokenOut: token0.address,
        fee: 500,
        recipient: swapperAddress,
        deadline: timestamp,
        amountIn: amount,
        amountOutMinimum: amount.sub(amount.div(100)),
        sqrtPriceLimitX96: highPrice
    });
}

/**
 * Swap token 0 for token 1 using Uniswap Router, considering token decimals when swapping
 */
async function swapToken0ForToken1Decimals(router, token0, token1, swapperAddress, amount) {
    let token0Decimals = await token0.decimals();
    let token1Decimals = await token1.decimals();
    // prices 6-18 decimals
    // let lowPrice;
    if(token0Decimals < token1Decimals) {
        lowPrice = '79093491225504072495000176441932441'
    } else if(token1Decimals < token0Decimals) {
        lowPrice = '79125342561396703567017'
    } else if(token0Decimals == token1Decimals && token0Decimals == 18) {
        lowPrice = getPriceInX96Format(0.997);
    }
    const pendingBlock = await network.provider.send("eth_getBlockByNumber", ["pending", false])
    const timestamp = pendingBlock.timestamp + 10000;
    // tokens should be in precise decimal representation before swapping
    let amountIn = amount;
    let amountOut = amount.sub(amount.div(100));
    if(token0Decimals > token1Decimals) {
        let divisor = bn(10).pow(bn(token0Decimals - token1Decimals));
        amountOut = amountOut.div(divisor);
    } else if(token0Decimals < token1Decimals) {
        let divisor = bn(10).pow(bn(token1Decimals - token0Decimals));
        amountIn = amountIn.div(divisor);
    } else if(token0Decimals < 18) {
        let divisor = bn(10).pow(bn(18 - token0Decimals));
        amountIn = amountIn.div(divisor);
        amountOut = amountOut.div(divisor);
    }

    await router.exactInputSingle({
        tokenIn: token0.address,
        tokenOut: token1.address,
        fee: 500,
        recipient: swapperAddress,
        deadline: timestamp,
        amountIn: amountIn,
        amountOutMinimum: amountOut,
        sqrtPriceLimitX96: lowPrice
      });
}

/**
 * Swap token 1 for token 0 using Uniswap Router, considering token decimals when swapping
 */
async function swapToken1ForToken0Decimals(router, token0, token1, swapperAddress, amount) {
    let token0Decimals = await token0.decimals();
    let token1Decimals = await token1.decimals();
    // prices 6-18 decimals
    let highPrice;
    if(token0Decimals < token1Decimals && token0Decimals < 18) {
        highPrice = '79331116077203858503401008515014641'
    } else if(token1Decimals < token0Decimals) {
        highPrice = '79363063105786882359298'
    } else if(token0Decimals == token1Decimals && token0Decimals == 18) {
        highPrice = getPriceInX96Format(1.003);
    }
    const pendingBlock = await network.provider.send("eth_getBlockByNumber", ["pending", false])
    const timestamp = pendingBlock.timestamp + 10000;

    // tokens should be in precise decimal representation before swapping
    let amountIn = amount;
    let amountOut = amount.sub(amount.div(100));
    if(token0Decimals > token1Decimals) {
        let divisor = bn(10).pow(bn(token0Decimals - token1Decimals));
        amountIn = amountIn.div(divisor);
    } else if(token0Decimals < token1Decimals) {
        let divisor = bn(10).pow(bn(token1Decimals - token0Decimals));
        amountOut = amountOut.div(divisor);
    } else if(token0Decimals < 18) {
        let divisor = bn(10).pow(bn(18 - token0Decimals));
        amountIn = amountIn.div(divisor);
        amountOut = amountOut.div(divisor);
    }

    await router.exactInputSingle({
        tokenIn: token1.address,
        tokenOut: token0.address,
        fee: 500,
        recipient: swapperAddress,
        deadline: timestamp,
        amountIn: amountIn,
        amountOutMinimum: amountOut,
        sqrtPriceLimitX96: highPrice
    });
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
 * Increase time in Hardhat Network
 */
async function increaseTime(time) {
    await network.provider.send("evm_increaseTime", [time]);
    await network.provider.send("evm_mine");
}

/**
 * Mine several blocks in network
 * @param {Number} blockCount how many blocks to mine
 */
async function mineBlocks(blockCount) {
    for(let i = 0 ; i < blockCount ; ++i) {
        await network.provider.send("evm_mine");
    }
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
 * Returns bignumber scaled to custom amount of decimals
 */
 function bnDecimals(amount, _decimals) {
    let decimal = Math.pow(10, _decimals);
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

/**
 * Returns number representing BigNumber without decimal precision (custom)
 */
 function getNumberDivDecimals(amount, _decimals) {
    let decimal = Math.pow(10, _decimals);
    let decimals = bn(decimal.toString());
    return amount.div(decimals).toNumber();
}

module.exports = {
    deploy, deployArgs, deployWithAbi, getBalance, getTWAP, getPriceInX96Format, getRatio, getTokenPrices,
    getXU3LPBalance, getPositionBalance, getBufferBalance, printPositionAndBufferBalance,
    bn, bnDecimal, bnDecimals, getNumberNoDecimals, getNumberDivDecimals, 
    getBlockTimestamp, swapToken0ForToken1, swapToken1ForToken0, 
    swapToken0ForToken1Decimals, swapToken1ForToken0Decimals,
    increaseTime, mineBlocks, getBufferPositionRatio
}