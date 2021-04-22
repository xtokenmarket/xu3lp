const assert = require('assert');
const { expect } = require('chai');
const { bnDecimal, getBalance } = require('../scripts/helpers');
const { deploymentFixture } = require('./fixture');

// Events tests for xU3LP
describe('Contract: xU3LP', async () => {
  let xU3LP, dai, usdc, admin;

  beforeEach(async () => {
      ({ xU3LP, dai, usdc } = await deploymentFixture());
      [admin, ...addrs] = await ethers.getSigners();
  })

  describe('Events', async () => {
    it('should emit event on fee withdrawal', async () => {
      await expect(xU3LP.withdrawFees())
        .to.emit(xU3LP, 'FeeWithdraw')
    })

    it('should emit event on setting fee divisors', async () => {
      await expect(xU3LP.setFeeDivisors(100, 100, 100))
            .to.emit(xU3LP, 'FeeDivisorsSet')
    }),

    it('should emit event on rebalance', async () => {
        await expect(xU3LP.rebalance())
              .to.emit(xU3LP, 'Rebalance')
    }),

    it('should emit event on position migration', async () => {
        await expect(xU3LP.migratePosition(-100, 100))
              .to.emit(xU3LP, 'PositionMigrated')
    })
  })
})
