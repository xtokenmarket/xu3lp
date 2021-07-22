const assert = require('assert');
const { expect } = require('chai');
const { bnDecimal, mineBlocks, bnDecimals } = require('../scripts/helpers');
const { deploymentFixture } = require('./fixture');

// Management functions tests for xU3LP
describe('Contract: xU3LP', async () => {
  let xU3LP, token0, token1, token0Decimals, token1Decimals, admin, user1, user2, user3;

  beforeEach(async () => {
      ({ xU3LP, token0, token1, xTokenManager, token0Decimals, token1Decimals } = await deploymentFixture());
      [admin, user1, user2, user3, ...addrs] = await ethers.getSigners();
      let mintAmount = bnDecimals(100000000, token0Decimals);
      let mintAmount2 = bnDecimals(100000000, token1Decimals);
      await xU3LP.mintInitial(mintAmount, mintAmount2);
      // mint some tokens
      mintAmount = bnDecimals(1000000, token0Decimals)
      mintAmount2 = bnDecimals(1000000, token1Decimals)
      await xU3LP.mintWithToken(0, mintAmount);
      await mineBlocks(5);
      await xU3LP.mintWithToken(1, mintAmount2);
      await mineBlocks(5);
      await xU3LP.rebalance();
      // set managers
      await xTokenManager.addManager(user1.address, xU3LP.address);
      await xTokenManager.addManager(user2.address, xU3LP.address);
  })

  describe('Management', async () => {
    it('should be able to rebalance', async () => {
        let mintAmount = bnDecimals(1000000, token0Decimals)
        let mintAmount2 = bnDecimals(1000000, token1Decimals)
        await xU3LP.mintWithToken(0, mintAmount);
        await mineBlocks(5);
        await xU3LP.mintWithToken(1, mintAmount2);
        await xU3LP.rebalance();
        assert(true);
    }),

    it('should be able to migrate position', async () => {
        let prevTokenId = await xU3LP.tokenId();
        let prevTicks = await xU3LP.getTicks();
        let newTick0 = prevTicks.tick0 - 20;
        let newTick1 = prevTicks.tick1 + 20;

        await xU3LP.migratePosition(newTick0, newTick1);
        let newTicks = await xU3LP.getTicks();
        let newTokenId = await xU3LP.tokenId();

        expect(newTicks.tick0).to.equal(newTick0);
        expect(newTicks.tick1).to.equal(newTick1);
        expect(prevTokenId).not.to.equal(newTokenId);
    }),

    it('should allow revenue controller to collect fees', async () => {
        let adminToken0BalanceBefore = await token0.balanceOf(admin.address);
        let feesToken0 = await xU3LP.withdrawableToken0Fees();
        expect(feesToken0).not.equal(0);

        await xU3LP.withdrawFees();
        feesToken0 = await xU3LP.withdrawableToken0Fees();
        let adminToken0BalanceAfter = await token0.balanceOf(admin.address);

        expect(feesToken0).to.equal(0);
        expect(adminToken0BalanceBefore).lt(adminToken0BalanceAfter);
    }),

    it('shouldn\'t allow managers to collect fees', async () => {
        let feesToken0 = await xU3LP.withdrawableToken0Fees();
        expect(feesToken0).not.equal(0);

        await expect(xU3LP.connect(user1).withdrawFees()).to.be.reverted;
        await expect(xU3LP.connect(user2).withdrawFees()).to.be.reverted;
    }),

    it('should be able to set fee divisors', async () => {
        await xU3LP.setFeeDivisors({mintFee: 100, burnFee: 200, claimFee: 500});

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

    it('shouldn\'t be able to transfer out LP tokens from the contract', async () => {
      await expect(xU3LP.withdrawToken(token0.address, admin.address)).
        to.be.reverted;
      await expect(xU3LP.withdrawToken(token1.address, admin.address)).
        to.be.reverted;
    }),

    it('should be able to stake without rebalancing', async () => {
      let bufferBalanceBefore = await xU3LP.getBufferTokenBalance();
      let stakedBalanceBefore = await xU3LP.getStakedTokenBalance();

      await xU3LP.adminStake(bnDecimals(1000, token0Decimals), bnDecimals(1000, token1Decimals));

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

      await xU3LP.adminUnstake(bnDecimals(1000, token0Decimals), bnDecimals(1000, token1Decimals));

      let bufferBalanceAfter = await xU3LP.getBufferTokenBalance();
      let stakedBalanceAfter = await xU3LP.getStakedTokenBalance();

      expect(bufferBalanceBefore.amount0).to.be.lt(bufferBalanceAfter.amount0);
      expect(bufferBalanceBefore.amount1).to.be.lt(bufferBalanceAfter.amount1);

      expect(stakedBalanceBefore.amount0).to.be.gt(stakedBalanceAfter.amount0);
      expect(stakedBalanceBefore.amount1).to.be.gt(stakedBalanceAfter.amount1);
    }),

    it('should be able to swap token 0 for token 1 in xU3LP', async () => {
      let balanceBefore = await xU3LP.getBufferTokenBalance();

      // true - swap token 0 for token 1
      let swapAmount = bnDecimal(10000);
      await xU3LP.adminSwap(swapAmount, true);

      let balanceAfter = await xU3LP.getBufferTokenBalance();

      expect(balanceAfter.amount0).to.be.lt(balanceBefore.amount0);
      expect(balanceAfter.amount1).to.be.gt(balanceBefore.amount1);
    }),

    it('should be able to swap token 1 for token 0 in xU3LP', async () => {
      let balanceBefore = await xU3LP.getBufferTokenBalance();

      // true - swap token 1 for token 0
      let swapAmount = bnDecimal(10000);
      await xU3LP.adminSwap(swapAmount, false);

      let balanceAfter = await xU3LP.getBufferTokenBalance();

      expect(balanceAfter.amount0).to.be.gt(balanceBefore.amount0);
      expect(balanceAfter.amount1).to.be.lt(balanceBefore.amount1);
    })
  })
})
