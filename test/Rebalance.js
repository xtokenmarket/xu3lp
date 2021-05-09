const assert = require('assert');
const { expect } = require('chai');
const { deploymentFixture } = require('./fixture');
const { getBufferBalance, getBlockTimestamp, bnDecimals,
        bnDecimal, mineBlocks, getBufferPositionRatio } = require('../scripts/helpers');

// Rebalance tests for xU3LP
describe('Contract: xU3LP', async () => {
  let token0Decimals, token1Decimals, xU3LP, user;

  beforeEach(async () => {
      ({ token0Decimals, token1Decimals, xU3LP } = await deploymentFixture());
      const signers = await ethers.getSigners();
      user = signers[1];
      let mintAmount = bnDecimals(100000000, token0Decimals);
      let mintAmount2 = bnDecimals(100000000, token1Decimals);
      await xU3LP.mintInitial(mintAmount, mintAmount2);
  })

  describe('Rebalance', async () => {
    it('should rebalance toward pool if bufferBalance > 5 % total balance', async () => {
        let ratio = await getBufferPositionRatio(xU3LP);
        expect(ratio).not.to.be.equal('5.0');
        // rebalance -> leaving 95% in the pool and 5% in xu3lp
        await xU3LP.rebalance();
    
        ratio = await getBufferPositionRatio(xU3LP);
        expect(ratio).to.be.equal('5.0');
    })

    it('should rebalance toward xu3lp if bufferBalance < 5 % total balance', async () => {
        // rebalance -> leaving 95% in the pool and 5% in xu3lp
        await xU3LP.rebalance();

        // Burn some so there is < 5% in xu3lp
        await xU3LP.burn(0, bnDecimal(100000));
        await mineBlocks(5);
        await xU3LP.burn(1, bnDecimal(100000));

        let ratio = await getBufferPositionRatio(xU3LP);
        expect(ratio).not.to.be.equal('5.0');
        // rebalance -> less than 5% left in xu3lp, so some needs to be withdrawn from the pool
        await xU3LP.rebalance();

        ratio = await getBufferPositionRatio(xU3LP);
        expect(ratio).to.be.equal('5.0');
    }),

    it('should be able to rebalance even if we have 0 balance in asset 0', async () => {
        let amount = bnDecimals(100000, token1Decimals);
        await xU3LP.mintWithToken(1, amount);
        let balances = await getBufferBalance(xU3LP);
        // swap dai for usdc if we have > 0 balance
        if(balances.dai > 0) {
            let swapAmount = (balances.dai - balances.dai / 100).toFixed(0);
            await xU3LP.adminSwap(bnDecimal(swapAmount), true)
        }
        // we attempt to swap token 0 for token 1 in the rebalance process
        await xU3LP.rebalance();
    }),
  
    it('should be able to rebalance even if we have 0 balance in asset 1', async () => {
        let amount = bnDecimals(100000, token0Decimals);
        await xU3LP.mintWithToken(0, amount);
        let balances = await getBufferBalance(xU3LP);
        // swap usdc for dai if we have > 0 balance
        if(balances.usdc > 0) {
            let swapAmount = (balances.usdc - balances.usdc / 100).toFixed(0);
            await xU3LP.adminSwap(bnDecimal(swapAmount), false)
        }
        // we attempt to swap token 1 for token 0 in the rebalance process
        await xU3LP.rebalance();
    }),

    it('should collect fees after rebalancing to pool (token 0)', async () => {
        await xU3LP.rebalance();

        await xU3LP.mintWithToken(0, bnDecimals(100000, token0Decimals));
        await mineBlocks(5);
        await xU3LP.mintWithToken(1, bnDecimals(100000, token1Decimals));
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

        await xU3LP.mintWithToken(0, bnDecimals(100000, token0Decimals));
        await mineBlocks(5);
        await xU3LP.mintWithToken(1, bnDecimals(100000, token1Decimals));
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
