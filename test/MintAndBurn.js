const { deploymentFixture } = require('./fixture');
const { getXU3LPBalance, bn, bnDecimal, bnDecimals, mineBlocks } = require('../scripts/helpers');
const { expect } = require('chai');

// Mint and burn tests for xU3LP
describe('Contract: xU3LP', async () => {
  let xU3LP, token0, token1, user, user2;

  beforeEach(async () => {
		({ xU3LP, token0, token1, token0Decimals, token1Decimals } = await deploymentFixture());
    [admin, user, user2, ...addrs] = await ethers.getSigners();
    let mintAmount = bnDecimals(100000000, token0Decimals);
    let mintAmount2 = bnDecimals(100000000, token1Decimals);
    await xU3LP.mintInitial(mintAmount, mintAmount2);
  })

  describe('Mint and burn', async () => {
    it('should mint xu3lp tokens to user', async () => {
        let amount = bnDecimals(1000000, token0Decimals);
        await xU3LP.connect(user).mintWithToken(0, amount);
        let balance = await getXU3LPBalance(xU3LP, user.address);
        let feeDivisors = await xU3LP.feeDivisors();
        let mintFee = feeDivisors.mintFee;

        let amountInAsset1Terms = await xU3LP.getAmountInAsset1Terms(amount);
        let amountWithoutFees = (amountInAsset1Terms.sub(amount.div(mintFee)));
        if(token0Decimals < 18) {
          amountWithoutFees = amountWithoutFees.mul(bn(10).pow(18 - token0Decimals));
        }

        const nav = await xU3LP.getNav();
        const totalSupply = await xU3LP.totalSupply();
        let calculatedBalance = bn(amountWithoutFees).mul(totalSupply).div(nav);

        expect(balance).to.eq(calculatedBalance);
    }),

    it('should transfer asset balance from user when minting', async () => {
        let balancetoken0Before = await token0.balanceOf(xU3LP.address);
        let balancetoken1Before = await token1.balanceOf(xU3LP.address)
        let amount = bnDecimals(1000000, token0Decimals);
        let amount2 = bnDecimals(1000000, token1Decimals);
        await xU3LP.connect(user).mintWithToken(0, amount);
        await mineBlocks(5);
        await xU3LP.connect(user).mintWithToken(1, amount2);
        let balancetoken0After = await token0.balanceOf(xU3LP.address);
        let balancetoken1After = await token1.balanceOf(xU3LP.address)

        expect(balancetoken0Before.add(amount)).to.be.eq(balancetoken0After);
        expect(balancetoken1Before.add(amount2)).to.be.eq(balancetoken1After);
    }),

    it('shouldn\'t allow user to mint if he has no token balance', async () => {
      let mintAmount = bnDecimals(10000, token0Decimals);
      expect(await token0.balanceOf(user2.address)).to.equal(0);
      await expect(xU3LP.connect(user2).mintWithToken(0, mintAmount)).to.be.reverted;
    }),

    it('shouldn\'t allow minting if contract is paused', async () => {
      await xU3LP.pauseContract();
      let mintAmount = bnDecimals(10000, token0Decimals);
      await expect(xU3LP.connect(user).mintWithToken(0, mintAmount)).
            to.be.revertedWith('Pausable: paused');
    }),

    it('should increase fee amount when minting', async () => {
        let fees0Before = await xU3LP.withdrawableToken0Fees();
        let fees1Before = await xU3LP.withdrawableToken1Fees();

        let amount0 = bnDecimals(1000000, token0Decimals);
        let amount1 = bnDecimals(1000000, token1Decimals);
        let amountInWei = bnDecimal(1000000);

        await xU3LP.connect(user).mintWithToken(0, amount0);
        await mineBlocks(5);
        await xU3LP.connect(user).mintWithToken(1, amount1);

        let fees0After = await xU3LP.withdrawableToken0Fees();
        let fees1After = await xU3LP.withdrawableToken1Fees();

        let feeDivisors = await xU3LP.feeDivisors();
        let mintFee = feeDivisors.mintFee;
        let calculatedFeeAmount = amountInWei.div(mintFee);

        expect(fees0Before).to.be.lt(fees0After);
        expect(fees1Before).to.be.lt(fees1After);

        expect(fees0Before.add(calculatedFeeAmount)).to.be.eq(fees0After);
        expect(fees1Before.add(calculatedFeeAmount)).to.be.eq(fees1After);
    }),

    it('should burn xu3lp tokens from user when burning', async () => {
      let mintAmount = bnDecimals(1000000, token0Decimals);
      let burnAmount = bnDecimal(100000);
      await xU3LP.connect(user).mintWithToken(0, mintAmount);
      await mineBlocks(5);

      let balanceBefore = await getXU3LPBalance(xU3LP, user.address);
      await xU3LP.connect(user).burn(0, burnAmount);
      let balanceAfter = await getXU3LPBalance(xU3LP, user.address);

      expect(balanceBefore.sub(burnAmount)).to.eq(balanceAfter);
    }),

    it('should transfer asset balance back to user when burning', async () => {
      // mint so as to be able to burn
      let mintAmount = bnDecimals(1000000, token0Decimals);
      let burnAmount = bnDecimal(900000);
      await xU3LP.connect(user).mintWithToken(0, mintAmount);
      await mineBlocks(5);

      // calculate expected returned asset mount
      const nav = await xU3LP.getNav();
      const totalSupply = await xU3LP.totalSupply();
      let proRataBalance = (nav
        .mul(await xU3LP.getAmountInAsset0Terms(burnAmount))).div(totalSupply);
      let feeDivisors = await xU3LP.feeDivisors();
      let burnFee = feeDivisors.burnFee;
      let calculatedFee = proRataBalance.div(burnFee);
      let expectedReturnedAssetAmount = (proRataBalance.sub(calculatedFee));
      // divide by decimal difference (since burn amount is in xU3LP tokens)
      let xu3lpDecimals = await xU3LP.decimals();
      if(token0Decimals < xu3lpDecimals) {
        let diffDivisor = bn(10).pow(bn(xu3lpDecimals - token0Decimals));
        expectedReturnedAssetAmount = expectedReturnedAssetAmount.div(diffDivisor);
      }

      // burn
      let token0BalanceBefore = await token0.balanceOf(user.address);
      await xU3LP.connect(user).burn(0, burnAmount);
      let token0BalanceAfter = await token0.balanceOf(user.address);
      expect(token0BalanceBefore.add(expectedReturnedAssetAmount)).to.be.eq(token0BalanceAfter);
    }),

    it('should allow user to burn token even if there\'s not enough token balance', async () => {
      await xU3LP.rebalance();
      let balance0 = await token0.balanceOf(xU3LP.address);
      let burnAmount = bnDecimal(9000000);
      expect(balance0).to.be.lt(burnAmount);
      await xU3LP.burn(0, burnAmount);
    }),

    it('shouldn\'t allow user to burn if he hasn\'t minted', async () => {
      let burnAmount = bnDecimals(10000, token0Decimals);
      expect(await xU3LP.balanceOf(user2.address)).to.equal(0);
      await expect(xU3LP.connect(user).burn(0, burnAmount)).to.be.reverted;
    }),

    it('should revert if burn amount exceeds available liquidity', async () => {
      let burnAmount = bnDecimal(1000000000);
      await expect(xU3LP.burn(0, burnAmount)).to.be.revertedWith('Insufficient exit liquidity');
    }),

    it('should increase fee amount when burning', async () => {
      let amount = bnDecimals(1000000, token0Decimals);
      let amount2 = bnDecimals(1000000, token1Decimals);
      let burnAmount = bnDecimal(900000);
      await xU3LP.connect(user).mintWithToken(0, amount);
      await mineBlocks(5);
      await xU3LP.connect(user).mintWithToken(1, amount2);
      await mineBlocks(5);

      // calculate how much token0 will user get for burning
      let nav = await xU3LP.getNav();
      let totalSupply = await xU3LP.totalSupply();
      let calculatedTokenAmount = bn(burnAmount).mul(nav).div(totalSupply);
      // token amount needs to be multiplied by token price to get fees
      let tokenAmount0 = await xU3LP.getAmountInAsset0Terms(calculatedTokenAmount);

      let feeDivisors = await xU3LP.feeDivisors();
      let burnFee = feeDivisors.burnFee;
      let calculatedFeeAmount0 = tokenAmount0.div(burnFee);
      
      let fees0Before = await xU3LP.withdrawableToken0Fees();
      let fees1Before = await xU3LP.withdrawableToken1Fees();

      // burn asset0
      await xU3LP.connect(user).burn(0, burnAmount);
      await mineBlocks(5);

      // calculate how much token1 will user get for burning
      nav = await xU3LP.getNav();
      totalSupply = await xU3LP.totalSupply();
      calculatedTokenAmount = bn(burnAmount).mul(nav).div(totalSupply);
      let tokenAmount1 = await xU3LP.getAmountInAsset1Terms(calculatedTokenAmount);
      let calculatedFeeAmount1 = tokenAmount1.div(burnFee);

      await xU3LP.connect(user).burn(1, burnAmount);

      let fees0After = await xU3LP.withdrawableToken0Fees();
      let fees1After = await xU3LP.withdrawableToken1Fees();

      expect(fees0Before).to.be.lt(fees0After);
      expect(fees1Before).to.be.lt(fees1After);

      expect(fees0Before.add(calculatedFeeAmount0)).to.be.eq(fees0After);
      expect(fees1Before.add(calculatedFeeAmount1)).to.be.eq(fees1After);
    })
  })
})
