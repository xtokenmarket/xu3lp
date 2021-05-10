const { expect } = require('chai');
const { bnDecimals } = require('../scripts/helpers');
const { deploymentFixture } = require('./fixture');

// Events tests for xU3LP
describe('Contract: xU3LP', async () => {
  let xU3LP, token0Decimals, token1Decimals, admin;

  beforeEach(async () => {
      ({ xU3LP, token0Decimals, token1Decimals } = await deploymentFixture());
      [admin, ...addrs] = await ethers.getSigners();
  })

  describe('Events', async () => {
    it('should emit event on fee withdrawal', async () => {
      await expect(xU3LP.withdrawFees())
        .to.emit(xU3LP, 'FeeWithdraw')
    })

    it('should emit event on setting fee divisors', async () => {
      await expect(xU3LP.setFeeDivisors({mintFee: 100, burnFee: 100, claimFee: 100}))
            .to.emit(xU3LP, 'FeeDivisorsSet')
    }),

    it('should emit event on rebalance', async () => {
        let mintAmount = bnDecimals(100000000, token0Decimals);
        let mintAmount2 = bnDecimals(100000000, token1Decimals);
        await xU3LP.mintInitial(mintAmount, mintAmount2);
        await expect(xU3LP.rebalance())
              .to.emit(xU3LP, 'Rebalance')
    }),

    it('should emit event on position initialization', async () => {
      let mintAmount = bnDecimals(100000000, token0Decimals);
      let mintAmount2 = bnDecimals(100000000, token1Decimals);
        await expect(xU3LP.mintInitial(mintAmount, mintAmount2))
              .to.emit(xU3LP, 'PositionInitialized')
    }),

    it('should emit event on position migration', async () => {
      let mintAmount = bnDecimals(100000000, token0Decimals);
      let mintAmount2 = bnDecimals(100000000, token1Decimals);
      await xU3LP.mintInitial(mintAmount, mintAmount2);
      let ticks = await xU3LP.getTicks();
        await expect(xU3LP.migratePosition(ticks.tick0 - 20, ticks.tick1 + 20))
              .to.emit(xU3LP, 'PositionMigrated')
    })
  })
})
