const assert = require('assert');
const { expect } = require('chai');
const { bnDecimal, getBalance } = require('../scripts/helpers');
const { deploymentFixture } = require('./fixture');

// Management functions tests for xU3LP
describe('Contract: xU3LP', async () => {
  let xU3LP, dai, usdc, admin, user1, user2, user3;

  beforeEach(async () => {
      ({ xU3LP, dai, usdc } = await deploymentFixture());
      [admin, user1, user2, user3, ...addrs] = await ethers.getSigners();
      // mint some tokens
      let mintAmount = bnDecimal(1000000)
      await xU3LP.mintWithToken(0, mintAmount);
      await xU3LP.mintWithToken(1, mintAmount);
      await xU3LP.rebalance();
      // set managers
      await xU3LP.setManager(user1.address);
      await xU3LP.setManager2(user2.address);
  })

  describe('Management', async () => {
    it('should be able to rebalance', async () => {
        let mintAmount = bnDecimal(1000000)
        await xU3LP.mintWithToken(0, mintAmount);
        await xU3LP.mintWithToken(1, mintAmount);
        await xU3LP.rebalance();
        assert(true);
    }),

    it('should be able to migrate position', async () => {
        await xU3LP.migratePosition(-100, 100);
        assert(true);
    }),

    it('should allow admin to collect fees', async () => {
        let adminToken0BalanceBefore = await dai.balanceOf(admin.address);
        let feesToken0 = await xU3LP.withdrawableToken0Fees();
        expect(feesToken0).not.equal(0);

        await xU3LP.withdrawFees();
        feesToken0 = await xU3LP.withdrawableToken0Fees();
        let adminToken0BalanceAfter = await dai.balanceOf(admin.address);

        expect(feesToken0).to.equal(0);
        expect(adminToken0BalanceBefore).lt(adminToken0BalanceAfter);
    }),

    it('should allow managers to collect fees', async () => {
        let managerToken0BalanceBefore = await dai.balanceOf(user1.address);
        let feesToken0 = await xU3LP.withdrawableToken0Fees();
        expect(feesToken0).not.equal(0);

        await xU3LP.connect(user1).withdrawFees();
        feesToken0 = await xU3LP.withdrawableToken0Fees();
        let managerToken0BalanceAfter = await dai.balanceOf(user1.address);

        expect(feesToken0).to.equal(0);
        expect(managerToken0BalanceBefore).lt(managerToken0BalanceAfter);
    }),

    it('should be able to set fee divisors', async () => {
        await xU3LP.setFeeDivisors(100, 200, 500);

        let feeDivisors = await xU3LP.feeDivisors();

        expect(feeDivisors.mintFee).to.equal(100);
        expect(feeDivisors.burnFee).to.equal(200);
        expect(feeDivisors.claimFee).to.equal(500);
    })
  })
})
