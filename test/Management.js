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
        let prevTokenId = await xU3LP.tokenId();
        let prevTicks = await xU3LP.getTicks();
        expect(prevTicks.tick0).not.to.equal(-100);
        expect(prevTicks.tick1).not.to.equal(100);

        await xU3LP.migratePosition(-100, 100);
        let newTicks = await xU3LP.getTicks();
        let newTokenId = await xU3LP.tokenId();

        expect(newTicks.tick0).to.equal(-100);
        expect(newTicks.tick1).to.equal(100);
        expect(prevTokenId).not.to.equal(newTokenId);
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
    }),

    it('should be able to pause and unpause the contract', async () => {
        await xU3LP.pauseContract();
        let isPaused = await xU3LP.paused();
        assert(isPaused == true);

        await xU3LP.unpauseContract();
        isPaused = await xU3LP.paused();
        assert(isPaused == false);
    }),

    it('should be able to transfer out arbitrary token from the contract', async () => {
      await xU3LP.transfer(xU3LP.address, bnDecimal(1000));
      let balanceBefore = await xU3LP.balanceOf(admin.address);
      await xU3LP.withdrawToken(xU3LP.address, admin.address);
      let balanceAfter = await xU3LP.balanceOf(admin.address);

      expect(balanceAfter).to.be.gt(balanceBefore);
    }),

    it('should be able to stake without rebalancing', async () => {
      let bufferBalanceBefore = await xU3LP.getBufferTokenBalance();
      let stakedBalanceBefore = await xU3LP.getStakedTokenBalance();

      await xU3LP.adminStake(bnDecimal(1000), bnDecimal(1000));

      let bufferBalanceAfter = await xU3LP.getBufferTokenBalance();
      let stakedBalanceAfter = await xU3LP.getStakedTokenBalance();

      expect(bufferBalanceBefore.amount0).to.be.gt(bufferBalanceAfter.amount0);
      expect(bufferBalanceBefore.amount1).to.be.gt(bufferBalanceAfter.amount1);

      expect(stakedBalanceBefore.amount0).to.be.lt(stakedBalanceAfter.amount0);
      expect(stakedBalanceBefore.amount1).to.be.lt(stakedBalanceAfter.amount1);
    }),

    it('should be able to unstake without rebalancing', async () => {
      let bufferBalanceBefore = await xU3LP.getBufferTokenBalance();
      let stakedBalanceBefore = await xU3LP.getStakedTokenBalance();

      await xU3LP.adminUnstake(bnDecimal(1000), bnDecimal(1000));

      let bufferBalanceAfter = await xU3LP.getBufferTokenBalance();
      let stakedBalanceAfter = await xU3LP.getStakedTokenBalance();

      expect(bufferBalanceBefore.amount0).to.be.lt(bufferBalanceAfter.amount0);
      expect(bufferBalanceBefore.amount1).to.be.lt(bufferBalanceAfter.amount1);

      expect(stakedBalanceBefore.amount0).to.be.gt(stakedBalanceAfter.amount0);
      expect(stakedBalanceBefore.amount1).to.be.gt(stakedBalanceAfter.amount1);
    }),

    it('should be able to swap tokens in xU3LP', async () => {
      let balanceBefore = await xU3LP.getBufferTokenBalance();

      // true - swap token 0 for token 1
      let swapAmount = bnDecimal(10000);
      await xU3LP.adminSwap(swapAmount, true);

      let balanceAfter = await xU3LP.getBufferTokenBalance();

      expect(balanceAfter.amount0).to.be.lt(balanceBefore.amount0);
      expect(balanceAfter.amount1).to.be.gt(balanceBefore.amount1);
    })
  })
})
