const { expect } = require('chai');
const { bnDecimal, swapToken0ForToken1, swapToken1ForToken0, increaseTime, mineBlocks } = require('../scripts/helpers');
const { deploymentFixture } = require('./fixture');

// Asset price retrieval function tests for xU3LP
describe('Contract: xU3LP', async () => {
  let xU3LP, router, dai, usdc, admin, user1, user2, user3;

  beforeEach(async () => {
      ({ xU3LP, dai, usdc, router } = await deploymentFixture());
      [admin, user1, user2, user3, ...addrs] = await ethers.getSigners();
      let mintAmount = bnDecimal(100000000);
      await xU3LP.mintInitial(mintAmount, mintAmount);
      // approve some tokens for swapping
      let approveAmount = bnDecimal(100000000);
      await dai.approve(router.address, approveAmount);
      await usdc.approve(router.address, approveAmount);
  })

  describe('Asset prices', async () => {
    it('should read decreased asset 0 price after swap token0 for token1', async () => {
        let priceBefore = await xU3LP.getAsset0Price();

        let swapAmount = bnDecimal(10000000);
        await swapToken0ForToken1(router, dai, usdc, admin.address, swapAmount);
        // time needs to be increased to be able to read price properly using getAsset0Price()
        await increaseTime(3600);

        let priceAfter = await xU3LP.getAsset0Price();

        expect(priceAfter).to.be.lt(priceBefore);
    }),

    it('should read increased asset 0 price after swap token1 for token0', async () => {
      let priceBefore = await xU3LP.getAsset0Price();

      let swapAmount = bnDecimal(10000000);
      await swapToken1ForToken0(router, dai, usdc, admin.address, swapAmount);

      await increaseTime(3600);

      let priceAfter = await xU3LP.getAsset0Price();

      expect(priceAfter).to.be.gt(priceBefore);
    }),

    it('should read decreased asset 1 price after swap token1 for token0', async () => {
      let priceBefore = await xU3LP.getAsset1Price();

      let swapAmount = bnDecimal(10000000);
      await swapToken1ForToken0(router, dai, usdc, admin.address, swapAmount);

      await increaseTime(3600);

      let priceAfter = await xU3LP.getAsset1Price();

      expect(priceAfter).to.be.lt(priceBefore);
    }),

    it('should read increased asset 1 price after swap token0 for token1', async () => {
      let priceBefore = await xU3LP.getAsset1Price();

      let swapAmount = bnDecimal(10000000);
      await swapToken0ForToken1(router, dai, usdc, admin.address, swapAmount);

      await increaseTime(3600);

      let priceAfter = await xU3LP.getAsset1Price();

      expect(priceAfter).to.be.gt(priceBefore);
    }),

    it('should mint more xU3LP for asset1 if asset1 price is higher than asset 0', async () => {
      // increase asset 1 price
      let swapAmount = bnDecimal(10000000);
      await swapToken0ForToken1(router, dai, usdc, admin.address, swapAmount);
      await increaseTime(3600);

      let asset0Price = await xU3LP.getAsset0Price();
      let asset1Price = await xU3LP.getAsset1Price();

      expect(asset1Price).to.be.gt(asset0Price);

      // calculate how much xu3lp tokens are minted for asset 0
      let balanceBefore0Mint = await xU3LP.balanceOf(admin.address);
      let mintAmount = bnDecimal(100000);
      await xU3LP.mintWithToken(0, mintAmount);
      await mineBlocks(5);
      let balanceAfter0Mint = await xU3LP.balanceOf(admin.address);
      let balance0Received = balanceAfter0Mint.sub(balanceBefore0Mint);

      // calculate how much xu3lp tokens are minted for asset 1
      let balanceBefore1Mint = await xU3LP.balanceOf(admin.address);
      mintAmount = bnDecimal(100000);
      await xU3LP.mintWithToken(1, mintAmount);
      let balanceAfter1Mint = await xU3LP.balanceOf(admin.address);
      let balance1Received = balanceAfter1Mint.sub(balanceBefore1Mint);

      expect(balance1Received).to.be.gt(balance0Received);
    }),

    it('should mint less xU3LP for asset1 if asset1 price is lower than asset 0', async () => {
      // decrease asset 1 price
      let swapAmount = bnDecimal(10000000);
      await swapToken1ForToken0(router, dai, usdc, admin.address, swapAmount);
      await increaseTime(3600);

      let asset0Price = await xU3LP.getAsset0Price();
      let asset1Price = await xU3LP.getAsset1Price();

      expect(asset1Price).to.be.lt(asset0Price);

      // calculate how much xu3lp tokens are minted for asset 0
      let balanceBefore0Mint = await xU3LP.balanceOf(admin.address);
      let mintAmount = bnDecimal(100000);
      await xU3LP.mintWithToken(0, mintAmount);
      await mineBlocks(5);
      let balanceAfter0Mint = await xU3LP.balanceOf(admin.address);
      let balance0Received = balanceAfter0Mint.sub(balanceBefore0Mint);

      // calculate how much xu3lp tokens are minted for asset 1
      let balanceBefore1Mint = await xU3LP.balanceOf(admin.address);
      mintAmount = bnDecimal(100000);
      await xU3LP.mintWithToken(1, mintAmount);
      let balanceAfter1Mint = await xU3LP.balanceOf(admin.address);
      let balance1Received = balanceAfter1Mint.sub(balanceBefore1Mint);

      expect(balance1Received).to.be.lt(balance0Received);
    }),

    it('should receive more asset1 on burning for the same xu3lp if asset1 price is lower than asset 0', async () => {
      // decrease asset 1 price
      let swapAmount = bnDecimal(10000000);
      await swapToken1ForToken0(router, dai, usdc, admin.address, swapAmount);
      await increaseTime(3600);

      let asset0Price = await xU3LP.getAsset0Price();
      let asset1Price = await xU3LP.getAsset1Price();

      expect(asset1Price).to.be.lt(asset0Price);

      // mint some tokens to be able to burn
      await xU3LP.mintWithToken(0, bnDecimal(10000000));
      await mineBlocks(5);
      await xU3LP.mintWithToken(1, bnDecimal(10000000));
      await mineBlocks(5);

      // calculate how much token0 tokens are received on asset 0 burn
      let balanceBefore0Burn = await dai.balanceOf(admin.address);
      let burnAmount = bnDecimal(100000);
      await xU3LP.burn(0, burnAmount);
      await mineBlocks(5);
      let balanceAfter0Burn = await dai.balanceOf(admin.address);
      let balance0Received = balanceAfter0Burn.sub(balanceBefore0Burn);

      // calculate how much token1 tokens are received on asset 1 burn
      let balanceBefore1Burn = await usdc.balanceOf(admin.address);
      burnAmount = bnDecimal(100000);
      await xU3LP.burn(1, burnAmount);
      let balanceAfter1Burn = await usdc.balanceOf(admin.address);
      let balance1Received = balanceAfter1Burn.sub(balanceBefore1Burn);

      expect(balance1Received).to.be.gt(balance0Received);
    }),

    it('should receive less asset1 on burning for the same xu3lp if asset1 price is higher than asset 0', async () => {
      // decrease asset 1 price
      let swapAmount = bnDecimal(10000000);
      await swapToken0ForToken1(router, dai, usdc, admin.address, swapAmount);
      await increaseTime(3600);

      let asset0Price = await xU3LP.getAsset0Price();
      let asset1Price = await xU3LP.getAsset1Price();

      expect(asset1Price).to.be.gt(asset0Price);

      // mint some tokens to be able to burn
      await xU3LP.mintWithToken(0, bnDecimal(10000000));
      await mineBlocks(5);
      await xU3LP.mintWithToken(1, bnDecimal(10000000));
      await mineBlocks(5);

      // calculate how much token0 tokens are received on asset 0 burn
      let balanceBefore0Burn = await dai.balanceOf(admin.address);
      let burnAmount = bnDecimal(100000);
      await xU3LP.burn(0, burnAmount);
      await mineBlocks(5);
      let balanceAfter0Burn = await dai.balanceOf(admin.address);
      let balance0Received = balanceAfter0Burn.sub(balanceBefore0Burn);

      // calculate how much token1 tokens are received on asset 1 burn
      let balanceBefore1Burn = await usdc.balanceOf(admin.address);
      burnAmount = bnDecimal(100000);
      await xU3LP.burn(1, burnAmount);
      let balanceAfter1Burn = await usdc.balanceOf(admin.address);
      let balance1Received = balanceAfter1Burn.sub(balanceBefore1Burn);

      expect(balance1Received).to.be.lt(balance0Received);
    })
  })
})
