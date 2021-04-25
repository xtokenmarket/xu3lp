const assert = require('assert');
const { expect } = require('chai');
const { deploymentFixture } = require('./fixture');
const { getBalance, getBufferBalance, getBlockTimestamp, 
        bn, bnDecimal, getNumberNoDecimals, mineBlocks } = require('../scripts/helpers');

// Rebalance tests for xU3LP
describe('Contract: xU3LP', async () => {
  let dai, usdc, xU3LP, user;
  let bufferPercentage = 5;

  beforeEach(async () => {
      ({ dai, usdc, xU3LP } = await deploymentFixture());
      const signers = await ethers.getSigners();
      user = signers[1];
      let mintAmount = bnDecimal(100000000);
      await xU3LP.mintInitial(mintAmount, mintAmount);
  })

  describe('Rebalance', async () => {
    it('should rebalance toward pool if bufferBalance > 5 % total balance', async () => {
        let startBufferBalance = await getBalance(dai, usdc, xU3LP.address);
        let startPoolBalance = await xU3LP.getStakedTokenBalance();

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
        await mineBlocks(5);
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
    }),

    it('should be able to rebalance even if we have 0 balance in asset 0', async () => {
        let amount = bnDecimal(100000);
        await xU3LP.mintWithToken(1, amount);
        let balances = await getBufferBalance(xU3LP);
        expect(balances.dai).to.be.eq(0);
        // we attempt to swap token 0 for token 1 in the rebalance process
        await xU3LP.rebalance();
    }),
  
    it('should be able to rebalance even if we have 0 balance in asset 1', async () => {
        let amount = bnDecimal(100000);
        await xU3LP.mintWithToken(0, amount);
        let balances = await getBufferBalance(xU3LP);
        expect(balances.usdc).to.be.eq(0);
        // we attempt to swap token 1 for token 0 in the rebalance process
        await xU3LP.rebalance();
    }),

    it('should collect fees after rebalancing to pool (token 0)', async () => {
        await xU3LP.rebalance();

        await xU3LP.mintWithToken(0, bnDecimal(100000));
        await mineBlocks(5);
        await xU3LP.mintWithToken(1, bnDecimal(100000));
        let feesBefore = await xU3LP.withdrawableToken0Fees();

        // swap tokens so as to generate fees
        // only token 0 fees are generated, swap is token0 for token1
        await xU3LP.adminSwap(bnDecimal(10000), true);

        await xU3LP.rebalance();
        let feesAfter = await xU3LP.withdrawableToken0Fees();

        expect(feesAfter).to.be.gt(feesBefore);
    }),

    it('should collect fees after rebalancing to pool (token 1)', async () => {
        await xU3LP.rebalance();

        await xU3LP.mintWithToken(0, bnDecimal(100000));
        await mineBlocks(5);
        await xU3LP.mintWithToken(1, bnDecimal(100000));
        let feesBefore = await xU3LP.withdrawableToken1Fees();

        // swap tokens so as to generate fees
        // only token 1 fees are generated, swap is token1 for token0
        await xU3LP.adminSwap(bnDecimal(10000), false);

        await xU3LP.rebalance();
        let feesAfter = await xU3LP.withdrawableToken1Fees();

        expect(feesAfter).to.be.gt(feesBefore);
    }),

    it('should collect fees after rebalancing to xu3lp (token 0)', async () => {
        await xU3LP.rebalance();

        await xU3LP.burn(0, bnDecimal(10000));
        await mineBlocks(5);
        await xU3LP.burn(1, bnDecimal(10000));
        let feesBefore = await xU3LP.withdrawableToken0Fees();

        // swap tokens so as to generate fees
        // only token 0 fees are generated, swap is token0 for token1
        await xU3LP.adminSwap(bnDecimal(1000), true);

        await xU3LP.rebalance();
        let feesAfter = await xU3LP.withdrawableToken0Fees();

        expect(feesAfter).to.be.gt(feesBefore);
    }),

    it('should collect fees after rebalancing to xu3lp (token 1)', async () => {
        await xU3LP.rebalance();
        
        await xU3LP.burn(0, bnDecimal(10000));
        await mineBlocks(5);
        await xU3LP.burn(1, bnDecimal(10000));
        let feesBefore = await xU3LP.withdrawableToken1Fees();

        // swap tokens so as to generate fees
        // only token 1 fees are generated, swap is token1 for token0
        await xU3LP.adminSwap(bnDecimal(10000), false);

        await xU3LP.rebalance();
        let feesAfter = await xU3LP.withdrawableToken1Fees();

        expect(feesAfter).to.be.gt(feesBefore);
    })

    it('should certify admin is active on rebalance', async () => {
        await xU3LP.rebalance();
        let lastActive = await xU3LP.adminActiveTimestamp();
        let blockTimestamp = await getBlockTimestamp();
        lastActive = lastActive.toNumber();
        assert(lastActive == blockTimestamp);
    })
  })
})