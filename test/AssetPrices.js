const { expect } = require('chai');
const { bnDecimal, swapToken0ForToken1Decimals, swapToken1ForToken0Decimals, 
  increaseTime, mineBlocks, bn, bnDecimals } = require('../scripts/helpers');
const { deploymentFixture } = require('./fixture');

// Asset price retrieval function tests for xU3LP
describe('Contract: xU3LP', async () => {
  let xU3LP, router, token0, token1, token0Decimals, token1Decimals, admin, user1, user2, user3;

  beforeEach(async () => {
      ({ xU3LP, token0, token1, token0Decimals, token1Decimals, router } = await deploymentFixture());
      [admin, user1, user2, user3, ...addrs] = await ethers.getSigners();
      let mintAmount = bnDecimals(100000000, token0Decimals);
      let mintAmount2 = bnDecimals(100000000, token1Decimals);
      await xU3LP.mintInitial(mintAmount, mintAmount2);
      // approve some tokens for swapping
      let approveAmount = bnDecimal(100000000);
      await token0.approve(router.address, approveAmount);
      await token1.approve(router.address, approveAmount);
  })

  describe('Asset prices', async () => {
    it('should read decreased asset 0 price after swap token0 for token1', async () => {
        let priceBefore = await xU3LP.getAsset0Price();

        let swapAmount = bnDecimal(10000000);
        await swapToken0ForToken1Decimals(router, token0, token1, admin.address, swapAmount);
        // time needs to be increased to be able to read price properly using getAsset0Price()
        await increaseTime(3600);

        let priceAfter = await xU3LP.getAsset0Price();

        expect(priceAfter).to.be.lt(priceBefore);
    }),

    it('should read increased asset 0 price after swap token1 for token0', async () => {
      let priceBefore = await xU3LP.getAsset0Price();

      let swapAmount = bnDecimal(10000000);
      await swapToken1ForToken0Decimals(router, token0, token1, admin.address, swapAmount);

      await increaseTime(3600);

      let priceAfter = await xU3LP.getAsset0Price();

      expect(priceAfter).to.be.gt(priceBefore);
    }),

    it('should read decreased asset 1 price after swap token1 for token0', async () => {
      let priceBefore = await xU3LP.getAsset1Price();

      let swapAmount = bnDecimal(10000000);
      await swapToken1ForToken0Decimals(router, token0, token1, admin.address, swapAmount);

      await increaseTime(3600);

      let priceAfter = await xU3LP.getAsset1Price();

      expect(priceAfter).to.be.lt(priceBefore);
    }),

    it('should read increased asset 1 price after swap token0 for token1', async () => {
      let priceBefore = await xU3LP.getAsset1Price();

      let swapAmount = bnDecimal(10000000);
      await swapToken0ForToken1Decimals(router, token0, token1, admin.address, swapAmount);

      await increaseTime(3600);

      let priceAfter = await xU3LP.getAsset1Price();

      expect(priceAfter).to.be.gt(priceBefore);
    }),

    it('should mint more xU3LP for asset1 if asset1 price is higher than asset 0', async () => {
      // increase asset 1 price
      let swapAmount = bnDecimal(15000000);
      await swapToken0ForToken1Decimals(router, token0, token1, admin.address, swapAmount);
      await increaseTime(3600);

      let asset0Price = await xU3LP.getAsset0Price();
      let asset1Price = await xU3LP.getAsset1Price();

      expect(asset1Price).to.be.gt(asset0Price);

      // calculate how much xu3lp tokens are minted for asset 0
      let balanceBefore0Mint = await xU3LP.balanceOf(admin.address);
      let mintAmount = bnDecimals(100000, token0Decimals);
      await xU3LP.mintWithToken(0, mintAmount);
      await mineBlocks(5);
      let balanceAfter0Mint = await xU3LP.balanceOf(admin.address);
      let balance0Received = balanceAfter0Mint.sub(balanceBefore0Mint);

      // calculate how much xu3lp tokens are minted for asset 1
      let balanceBefore1Mint = await xU3LP.balanceOf(admin.address);
      mintAmount = bnDecimals(100000, token1Decimals);
      await xU3LP.mintWithToken(1, mintAmount);
      let balanceAfter1Mint = await xU3LP.balanceOf(admin.address);
      let balance1Received = balanceAfter1Mint.sub(balanceBefore1Mint);

      expect(balance1Received).to.be.gt(balance0Received);
    }),

    it('should mint less xU3LP for asset1 if asset1 price is lower than asset 0', async () => {
      // decrease asset 1 price
      let swapAmount = bnDecimal(15000000);
      await swapToken1ForToken0Decimals(router, token0, token1, admin.address, swapAmount);
      await increaseTime(3600);

      let asset0Price = await xU3LP.getAsset0Price();
      let asset1Price = await xU3LP.getAsset1Price();

      expect(asset1Price).to.be.lt(asset0Price);

      // calculate how much xu3lp tokens are minted for asset 0
      let balanceBefore0Mint = await xU3LP.balanceOf(admin.address);
      let mintAmount = bnDecimals(10000000, token0Decimals);
      await xU3LP.mintWithToken(0, mintAmount);
      await mineBlocks(5);
      let balanceAfter0Mint = await xU3LP.balanceOf(admin.address);
      let balance0Received = balanceAfter0Mint.sub(balanceBefore0Mint);

      // calculate how much xu3lp tokens are minted for asset 1
      let balanceBefore1Mint = await xU3LP.balanceOf(admin.address);
      mintAmount = bnDecimals(100000, token1Decimals);
      await xU3LP.mintWithToken(1, mintAmount);
      let balanceAfter1Mint = await xU3LP.balanceOf(admin.address);
      let balance1Received = balanceAfter1Mint.sub(balanceBefore1Mint);

      expect(balance1Received).to.be.lt(balance0Received);
    }),

    it('should receive more asset1 on burning for the same xu3lp if asset1 price is lower than asset 0', async () => {
      // decrease asset 1 price
      let swapAmount = bnDecimal(15000000);
      await swapToken1ForToken0Decimals(router, token0, token1, admin.address, swapAmount);
      await increaseTime(3600);

      let asset0Price = await xU3LP.getAsset0Price();
      let asset1Price = await xU3LP.getAsset1Price();

      expect(asset1Price).to.be.lt(asset0Price);

      // mint some tokens to be able to burn
      await xU3LP.mintWithToken(0, bnDecimals(10000000, token0Decimals));
      await mineBlocks(5);
      await xU3LP.mintWithToken(1, bnDecimals(10000000, token1Decimals));
      await mineBlocks(5);

      // calculate how much token0 tokens are received on asset 0 burn
      let balanceBefore0Burn = await token0.balanceOf(admin.address);
      let burnAmount = bnDecimal(100000);
      await xU3LP.burn(0, burnAmount);
      await mineBlocks(5);
      let balanceAfter0Burn = await token0.balanceOf(admin.address);
      let balance0Received = balanceAfter0Burn.sub(balanceBefore0Burn);

      // calculate how much token1 tokens are received on asset 1 burn
      let balanceBefore1Burn = await token1.balanceOf(admin.address);
      burnAmount = bnDecimal(100000);
      await xU3LP.burn(1, burnAmount);
      let balanceAfter1Burn = await token1.balanceOf(admin.address);
      let balance1Received = balanceAfter1Burn.sub(balanceBefore1Burn);
      // normalize balances
      balance1Received = balance1Received.mul(bn(10).pow(bn(12)));

      expect(balance1Received).to.be.gt(balance0Received);
    }),

    it('should receive less asset1 on burning for the same xu3lp if asset1 price is higher than asset 0', async () => {
      // decrease asset 1 price
      let swapAmount = bnDecimal(15000000);
      await swapToken0ForToken1Decimals(router, token0, token1, admin.address, swapAmount);
      await increaseTime(3600);

      let asset0Price = await xU3LP.getAsset0Price();
      let asset1Price = await xU3LP.getAsset1Price();

      expect(asset1Price).to.be.gt(asset0Price);

      // mint some tokens to be able to burn
      await xU3LP.mintWithToken(0, bnDecimals(10000000, token0Decimals));
      await mineBlocks(5);
      await xU3LP.mintWithToken(1, bnDecimals(10000000, token1Decimals));
      await mineBlocks(5);

      // calculate how much token0 tokens are received on asset 0 burn
      let balanceBefore0Burn = await token0.balanceOf(admin.address);
      let burnAmount = bnDecimal(100000);
      await xU3LP.burn(0, burnAmount);
      await mineBlocks(5);
      let balanceAfter0Burn = await token0.balanceOf(admin.address);
      let balance0Received = balanceAfter0Burn.sub(balanceBefore0Burn);

      // calculate how much token1 tokens are received on asset 1 burn
      let balanceBefore1Burn = await token1.balanceOf(admin.address);
      burnAmount = bnDecimal(100000);
      await xU3LP.burn(1, burnAmount);
      let balanceAfter1Burn = await token1.balanceOf(admin.address);
      let balance1Received = balanceAfter1Burn.sub(balanceBefore1Burn);

      // Normalize token amounts
      if(token0Decimals > token1Decimals) {
        balance1Received = balance1Received.mul(bn(10).pow((token0Decimals - token1Decimals)));
      } else if(token1Decimals > token0Decimals) {
        balance0Received = balance0Received.mul(bn(10).pow((token1Decimals - token0Decimals)));
      }

      expect(balance1Received).to.be.lt(balance0Received);
    })
  })
})
