const assert = require('assert');
const { deploymentFixture } = require('./fixture');
const { getBalance } = require('../scripts/helpers');

// Rebalance tests for xU3LP
describe('Contract: xU3LP', async () => {
  let dai, usdc, pool, xU3LP;
  let bufferPercentage = 5;

  beforeEach(async () => {
		({ dai, usdc, pool, xU3LP } = await deploymentFixture());
  })

  describe('Rebalance', async () => {
    it('should rebalance toward pool if bufferBalance > 5 % total balance', async () => {
        let amount = 10000;
        await xU3LP.mintWithToken(0, amount);
        await xU3LP.mintWithToken(1, amount);
        let originalBalances = await getBalance(dai, usdc, xU3LP.address);
    
        // rebalance -> leaving 95% in the pool and 5% in xu3lp
        await xU3LP.rebalance();
    
        let balances = await getBalance(dai, usdc, xU3LP.address);
        let feeDivisors = await xU3LP.feeDivisors();
        let mintFee = feeDivisors.mintFee;
        // fee + mint() loss
        balances.dai = balances.dai + 1 - amount / mintFee;
        balances.usdc = balances.usdc + 1 - amount / mintFee;

        assert(balances.dai == originalBalances.dai * (bufferPercentage / 100));
        assert(balances.usdc == originalBalances.usdc * (bufferPercentage / 100));
    })

    it('should rebalance toward xu3lp if bufferBalance < 5 % total balance', async () => {
        await xU3LP.mintWithToken(0, '10000');
        await xU3LP.mintWithToken(1, '10000');
    
        // rebalance -> leaving 95% in the pool and 5% in xu3lp
        await xU3LP.rebalance();

        // Burn some so there is < 5% in xu3lp
        await xU3LP.burn(0, '100');
        await xU3LP.burn(1, '100');
        let balancesBefore = await getBalance(dai, usdc, xU3LP.address);

        // rebalance -> less than 5% left in xu3lp, so some needs to be brought back from the pool
        await xU3LP.rebalance();

        let balancesAfter = await getBalance(dai, usdc, xU3LP.address);
        assert(balancesAfter.dai > balancesBefore.dai);
        assert(balancesAfter.usdc > balancesBefore.usdc);
    })
  })
})
