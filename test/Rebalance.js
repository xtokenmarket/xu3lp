const assert = require('assert');
const { deploymentFixture } = require('./fixture');
const { getBalance, bn, bnDecimal, getNumberNoDecimals } = require('../scripts/helpers');

// Rebalance tests for xU3LP
describe('Contract: xU3LP', async () => {
  let dai, usdc, xU3LP, user;
  let bufferPercentage = 5;

  beforeEach(async () => {
		({ dai, usdc, xU3LP } = await deploymentFixture());
    const signers = await ethers.getSigners();
    user = signers[1];
  })

  describe('Rebalance', async () => {
    it('should rebalance toward pool if bufferBalance > 5 % total balance', async () => {
        let startBufferBalance = await getBalance(dai, usdc, xU3LP.address);
        let startPoolBalance = await xU3LP.getPoolTokenBalance();

        assert(startBufferBalance.dai == 0);
        assert(startBufferBalance.usdc == 0);
    
        // rebalance -> leaving 95% in the pool and 5% in xu3lp
        await xU3LP.rebalance();
    
        let actualBalance = await getBalance(dai, usdc, xU3LP.address);

        let daiExpectedBufferBalance = getNumberNoDecimals(startPoolBalance.amount0.
                                                            mul(bn(bufferPercentage)).div(100));
        let usdcExpectedBufferBalance = getNumberNoDecimals(startPoolBalance.amount1.
                                                            mul(bn(bufferPercentage)).div(100));

        assert(actualBalance.dai == daiExpectedBufferBalance);
        assert(actualBalance.usdc == usdcExpectedBufferBalance);
    })

    it('should rebalance toward xu3lp if bufferBalance < 5 % total balance', async () => {
        // rebalance -> leaving 95% in the pool and 5% in xu3lp
        await xU3LP.rebalance();

        // Burn some so there is < 5% in xu3lp
        await xU3LP.burn(0, bnDecimal(100000));
        await xU3LP.burn(1, bnDecimal(100000));

        // rebalance -> less than 5% left in xu3lp, so some needs to be withdrawn from the pool
        await xU3LP.rebalance();

        let targetBalance = await xU3LP.getTargetBufferTokenBalance();
        let actualBalance = await xU3LP.getBufferTokenBalance();
        
        let targetBalances = {};
        targetBalances.dai = getNumberNoDecimals(targetBalance.amount0);
        targetBalances.usdc = getNumberNoDecimals(targetBalance.amount1);

        let actualBalances = {};
        actualBalances.dai = getNumberNoDecimals(actualBalance.amount0);
        actualBalances.usdc = getNumberNoDecimals(actualBalance.amount1);

        assert(targetBalances.dai == actualBalances.dai);
        assert(targetBalances.usdc == actualBalances.usdc);
    })
  })
})
