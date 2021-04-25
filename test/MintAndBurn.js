const assert = require('assert');
const { deploymentFixture } = require('./fixture');
const { getXU3LPBalance, bn, bnDecimal, getNumberNoDecimals,
  getBalance, mineBlocks } = require('../scripts/helpers');
const { expect } = require('chai');

// Mint and burn tests for xU3LP
describe('Contract: xU3LP', async () => {
  let xU3LP, dai, usdc, user, user2;

  beforeEach(async () => {
		({ xU3LP, usdc, dai } = await deploymentFixture());
    const signers = await ethers.getSigners();
    [admin, user, user2, ...addrs] = await ethers.getSigners();
    let mintAmount = bnDecimal(100000000);
    await xU3LP.mintInitial(mintAmount, mintAmount);
  })

  describe('Mint and burn', async () => {
    it('should mint xu3lp tokens to user', async () => {
        let amount = 1000000;
        await xU3LP.connect(user).mintWithToken(0, amount);
        let balance = await getXU3LPBalance(xU3LP, user.address);
        let feeDivisors = await xU3LP.feeDivisors();
        let mintFee = feeDivisors.mintFee;

        let amountWithoutFees = amount - (amount / mintFee);

        const nav = await xU3LP.getNav();
        const totalSupply = await xU3LP.totalSupply();
        let calculatedBalance = bn(amountWithoutFees).mul(totalSupply).div(nav).toNumber();

        // math operations in solidity (rounded down) vs ethersjs bignumber difference (rounded up)
        calculatedBalance -= 1;

        assert(balance.toNumber() == calculatedBalance);
    }),

    it('should transfer asset balance from user when minting', async () => {
        let balanceBefore = await getBalance(dai, usdc, xU3LP.address);
        let amount = bnDecimal(1000000);
        await xU3LP.connect(user).mintWithToken(0, amount);
        await mineBlocks(5);
        await xU3LP.connect(user).mintWithToken(1, amount);
        let balanceAfter = await getBalance(dai, usdc, xU3LP.address);
        assert(balanceBefore.dai + getNumberNoDecimals(amount) == balanceAfter.dai);
        assert(balanceBefore.usdc + getNumberNoDecimals(amount) == balanceAfter.usdc);
    }),

    it('shouldn\'t allow user to mint if he has no token balance', async () => {
      let mintAmount = bnDecimal(10000);
      expect(await dai.balanceOf(user2.address)).to.equal(0);
      await expect(xU3LP.connect(user2).mintWithToken(0, mintAmount)).to.be.reverted;
    }),

    it('shouldn\'t allow minting if contract is paused', async () => {
      await xU3LP.pauseContract();
      let mintAmount = bnDecimal(10000);
      await expect(xU3LP.connect(user).mintWithToken(0, mintAmount)).
            to.be.revertedWith('Pausable: paused');
    }),

    it('should increase fee amount when minting', async () => {
        let fees0Before = await xU3LP.withdrawableToken0Fees();
        let fees1Before = await xU3LP.withdrawableToken1Fees();

        let amount = bnDecimal(1000000);
        await xU3LP.connect(user).mintWithToken(0, amount);
        await mineBlocks(5);
        await xU3LP.connect(user).mintWithToken(1, amount);

        let fees0After = await xU3LP.withdrawableToken0Fees();
        let fees1After = await xU3LP.withdrawableToken1Fees();

        let feeDivisors = await xU3LP.feeDivisors();
        let mintFee = feeDivisors.mintFee;
        let calculatedFeeAmount = amount.div(mintFee);

        expect(fees0Before).to.be.lt(fees0After);
        expect(fees1Before).to.be.lt(fees1After);

        expect(fees0Before.add(calculatedFeeAmount)).to.be.eq(fees0After);
        expect(fees1Before.add(calculatedFeeAmount)).to.be.eq(fees1After);
    }),

    it('should burn xu3lp tokens from user when burning', async () => {
      let mintAmount = 1000000;
      let burnAmount = 100000;
      await xU3LP.connect(user).mintWithToken(0, mintAmount);
      await mineBlocks(5);

      await xU3LP.connect(user).burn(0, burnAmount);
      
      let feeDivisors = await xU3LP.feeDivisors();
      let mintFee = feeDivisors.mintFee;

      let balance = await getXU3LPBalance(xU3LP, user.address);
      let amountWithoutFees = new Number(
                          ((mintAmount - (mintAmount / mintFee)) -
                          (burnAmount))).toFixed(0);
      const nav = await xU3LP.getNav();
      const totalSupply = await xU3LP.totalSupply();
      let calculatedBalance = bn(amountWithoutFees).mul(nav).div(totalSupply).toNumber();

      // math operations in solidity (rounded down) vs ethersjs bignumber difference (rounded up)
      calculatedBalance -= 1;

      assert(balance.toNumber() == calculatedBalance)
    }),

    it('should transfer asset balance back to user when burning', async () => {
      // mint so as to be able to burn
      let mintAmount = bnDecimal(1000000);
      let burnAmount = bnDecimal(900000);
      await xU3LP.connect(user).mintWithToken(0, mintAmount);
      await mineBlocks(5);

      // burn
      let balanceBefore = await getBalance(dai, usdc, user.address);
      await xU3LP.connect(user).burn(0, burnAmount);
      let balanceAfter = await getBalance(dai, usdc, user.address);

      // calculate burn fee
      let feeDivisors = await xU3LP.feeDivisors();
      let burnFee = feeDivisors.burnFee;
      let calculatedFeeAmount = burnAmount.div(burnFee);

      let expectedBalanceAfter = balanceBefore.dai + getNumberNoDecimals(burnAmount) - 
                                                      getNumberNoDecimals(calculatedFeeAmount);

      assert(expectedBalanceAfter == balanceAfter.dai);
    }),

    it('should allow user to burn token even if there\'s not enough token balance', async () => {
      await xU3LP.rebalance();
      let balance0 = await dai.balanceOf(xU3LP.address);
      let burnAmount = bnDecimal(9000000);
      expect(balance0).to.be.lt(burnAmount);
      await xU3LP.burn(0, burnAmount);
    }),

    it('shouldn\'t allow user to burn if he hasn\'t minted', async () => {
      let burnAmount = bnDecimal(10000);
      expect(await xU3LP.balanceOf(user2.address)).to.equal(0);
      await expect(xU3LP.connect(user).burn(0, burnAmount)).to.be.reverted;
    }),

    it('should revert if burn amount exceeds available liquidity', async () => {
      let burnAmount = bnDecimal(1000000000);
      await expect(xU3LP.burn(0, burnAmount)).to.be.revertedWith('Insufficient exit liquidity');
    }),

    it('should increase fee amount when burning', async () => {
      let amount = bnDecimal(1000000);
      let burnAmount = bnDecimal(900000);
      await xU3LP.connect(user).mintWithToken(0, amount);
      await mineBlocks(5);
      await xU3LP.connect(user).mintWithToken(1, amount);
      await mineBlocks(5);
      
      let fees0Before = await xU3LP.withdrawableToken0Fees();
      let fees1Before = await xU3LP.withdrawableToken1Fees();

      await xU3LP.connect(user).burn(0, burnAmount);
      await mineBlocks(5);
      await xU3LP.connect(user).burn(1, burnAmount);

      let fees0After = await xU3LP.withdrawableToken0Fees();
      let fees1After = await xU3LP.withdrawableToken1Fees();

      // calculate how much tokens will user get for burning
      const nav = await xU3LP.getNav();
      const totalSupply = await xU3LP.totalSupply();
      let calculatedTokenAmount = bn(burnAmount).mul(nav).div(totalSupply);

      let feeDivisors = await xU3LP.feeDivisors();
      let burnFee = feeDivisors.burnFee;
      let calculatedFeeAmount = calculatedTokenAmount.div(burnFee);

      expect(fees0Before).to.be.lt(fees0After);
      expect(fees1Before).to.be.lt(fees1After);

      expect(fees0Before.add(calculatedFeeAmount)).to.be.eq(fees0After);
      expect(fees1Before.add(calculatedFeeAmount)).to.be.eq(fees1After);
    })
  })
})
