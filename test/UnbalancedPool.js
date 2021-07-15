const { expect } = require('chai');
const { bnDecimal, swapToken1ForToken0Decimals, swapToken0ForToken1Decimals, increaseTime, 
      mineBlocks, getBufferPositionRatio, bnDecimals, printPositionAndBufferBalance } = require('../scripts/helpers');
const { deploymentFixture } = require('./fixture');

// Rebalancing in a unbalanced pool tests for xU3LP
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
      await xU3LP.rebalance();
  })

  describe('Rebalance in unbalanced pool', async () => {
    it('should be able to rebalance in a pool with 1:2 token ratio', async () => {
      // start: 95M token0 and token1
      let swapAmount = bnDecimal(30000000);
      await swapToken1ForToken0Decimals(router, token0, token1, admin.address, swapAmount);
      await increaseTime(3600);
      // after swap: 65M token0 and 125M token1 - ~1:2 ratio

      // burn 70% of buffer balance
      let burnAmount0 = bnDecimal(5000000);
      let burnAmount1 = bnDecimal(2000000);
      await xU3LP.burn(0, burnAmount0);
      await mineBlocks(5);
      await xU3LP.burn(1, burnAmount1);
      await mineBlocks(5);

      await xU3LP.rebalance();

      let bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');

      // burn 95% of buffer balance - token 0 and 1
      burnAmount0 = bnDecimal(4400000);
      burnAmount1 = bnDecimal(4800000);
      await xU3LP.burn(0, burnAmount0);
      await mineBlocks(5);
      await xU3LP.burn(1, burnAmount1);
      await mineBlocks(5);
      
      await xU3LP.rebalance();

      bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');

      // mint 5M one side
      let mintAmount = bnDecimals(5000000, token0Decimals);
      await xU3LP.mintWithToken(0, mintAmount);
      await mineBlocks(5);
      await xU3LP.rebalance();
      bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');

      // mint 1M one side
      mintAmount = bnDecimals(1000000, token1Decimals);
      await xU3LP.mintWithToken(1, mintAmount);
      await mineBlocks(5);
      await xU3LP.rebalance();
      bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');

      // mint both sides
      mintAmount = bnDecimals(5000000, token0Decimals);
      await xU3LP.mintWithToken(0, mintAmount);
      await mineBlocks(5);
      mintAmount = bnDecimals(3500000, token1Decimals);
      await xU3LP.mintWithToken(1, mintAmount);
      await xU3LP.rebalance();
      bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');
    }),

    it('should be able to rebalance in a pool with 1:3 token ratio', async () => {
      // start: 95M token0 and token1
      let swapAmount = bnDecimal(50000000);
      await swapToken1ForToken0Decimals(router, token0, token1, admin.address, swapAmount);
      await increaseTime(3600);
      // after swap: 45M token0 and 145M token1 - ~1:3 ratio

      // burn 70% of buffer balance
      let burnAmount0 = bnDecimal(5000000);
      let burnAmount1 = bnDecimal(2000000);
      await xU3LP.burn(0, burnAmount0);
      await mineBlocks(5);
      await xU3LP.burn(1, burnAmount1);
      await mineBlocks(5);

      await xU3LP.rebalance();

      let bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');

      // burn 95% of buffer balance - token 0 and 1
      burnAmount0 = bnDecimal(4400000);
      burnAmount1 = bnDecimal(4800000);
      await xU3LP.burn(0, burnAmount0);
      await mineBlocks(5);
      await xU3LP.burn(1, burnAmount1);
      await mineBlocks(5);
      
      await xU3LP.rebalance();

      bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');

      // mint 5M one side
      let mintAmount = bnDecimals(5000000, token0Decimals);
      await xU3LP.mintWithToken(0, mintAmount);
      await mineBlocks(5);
      await xU3LP.rebalance();
      bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');

      // mint 1M one side
      mintAmount = bnDecimals(1000000, token1Decimals);
      await xU3LP.mintWithToken(1, mintAmount);
      await mineBlocks(5);
      await xU3LP.rebalance();
      bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');

      // mint both sides
      mintAmount = bnDecimals(5000000, token0Decimals);
      await xU3LP.mintWithToken(0, mintAmount);
      await mineBlocks(5);
      mintAmount = bnDecimals(3500000, token1Decimals);
      await xU3LP.mintWithToken(1, mintAmount);
      await xU3LP.rebalance();
      bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');
    }),

    it('should be able to rebalance in a pool with 1:5 token ratio', async () => {
      // start: 95M token0 and token1
      let swapAmount = bnDecimal(65000000);
      await swapToken1ForToken0Decimals(router, token0, token1, admin.address, swapAmount);
      await increaseTime(3600);
      // after swap: 30M token0 and 160M token1 - ~1:5 ratio
      
      // burn 70% of buffer balance
      let burnAmount0 = bnDecimal(5000000);
      let burnAmount1 = bnDecimal(2000000);
      await xU3LP.burn(0, burnAmount0);
      await mineBlocks(5);
      await xU3LP.burn(1, burnAmount1);
      await mineBlocks(5);

      await xU3LP.rebalance();

      let bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');

      // burn 95% of buffer balance - token 0 and 1
      burnAmount0 = bnDecimal(4400000);
      burnAmount1 = bnDecimal(4800000);
      await xU3LP.burn(0, burnAmount0);
      await mineBlocks(5);
      await xU3LP.burn(1, burnAmount1);
      await mineBlocks(5);
      
      await xU3LP.rebalance();

      bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');

      // mint 5M one side
      let mintAmount = bnDecimals(5000000, token0Decimals);
      await xU3LP.mintWithToken(0, mintAmount);
      await mineBlocks(5);
      await xU3LP.rebalance();
      bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');

      // mint 2M one side
      mintAmount = bnDecimals(2000000, token1Decimals);
      await xU3LP.mintWithToken(1, mintAmount);
      await mineBlocks(5);
      await xU3LP.rebalance();
      bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');

      // mint both sides
      mintAmount = bnDecimals(5000000, token0Decimals);
      await xU3LP.mintWithToken(0, mintAmount);
      await mineBlocks(5);
      mintAmount = bnDecimals(3500000, token1Decimals);
      await xU3LP.mintWithToken(1, mintAmount);
      await xU3LP.rebalance();
      bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');
    }),

    it('should be able to rebalance in a pool with 1:10 token ratio', async () => {
      // start: 95M token0 and token1
      let swapAmount = bnDecimal(80000000);
      await swapToken1ForToken0Decimals(router, token0, token1, admin.address, swapAmount);
      await increaseTime(3600);
      // after swap: 15M token0 and 175M token1 - ~1:10 ratio
      
      // burn 70% of buffer balance
      let burnAmount0 = bnDecimal(5000000);
      let burnAmount1 = bnDecimal(2000000);
      await xU3LP.burn(0, burnAmount0);
      await mineBlocks(5);
      await xU3LP.burn(1, burnAmount1);
      await mineBlocks(5);

      await xU3LP.rebalance();

      let bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');

      // burn 95% of buffer balance - token 0 and 1
      burnAmount0 = bnDecimal(4400000);
      burnAmount1 = bnDecimal(4800000);
      await xU3LP.burn(0, burnAmount0);
      await mineBlocks(5);
      await xU3LP.burn(1, burnAmount1);
      await mineBlocks(5);
      
      await xU3LP.rebalance();

      bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');

      // mint 5M one side
      let mintAmount = bnDecimals(5000000, token0Decimals);
      await xU3LP.mintWithToken(0, mintAmount);
      await mineBlocks(5);
      await xU3LP.rebalance();
      bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');

      // mint 2M one side
      mintAmount = bnDecimals(2000000, token1Decimals);
      await xU3LP.mintWithToken(1, mintAmount);
      await mineBlocks(5);
      await xU3LP.rebalance();
      bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');

      // mint both sides
      mintAmount = bnDecimals(5000000, token0Decimals);
      await xU3LP.mintWithToken(0, mintAmount);
      await mineBlocks(5);
      mintAmount = bnDecimals(3500000, token1Decimals);
      await xU3LP.mintWithToken(1, mintAmount);
      await xU3LP.rebalance();
      bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');
    }),

    it('should be able to rebalance in a pool with 1:40 token ratio', async () => {
      // start: 95M token0 and token1
      let swapAmount = bnDecimal(88500000);
      await swapToken1ForToken0Decimals(router, token0, token1, admin.address, swapAmount);
      await increaseTime(3600);
      // after swap: 5M token0 and 185M token1 - ~1:40 ratio

      // burn 70% of buffer balance
      let burnAmount0 = bnDecimal(5000000);
      let burnAmount1 = bnDecimal(2000000);
      await xU3LP.burn(0, burnAmount0);
      await mineBlocks(5);
      await xU3LP.burn(1, burnAmount1);
      await mineBlocks(5);

      await xU3LP.rebalance();

      let bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');

      // mint 5M one side
      let mintAmount = bnDecimals(5000000, token0Decimals);
      await xU3LP.mintWithToken(0, mintAmount);
      await mineBlocks(5);
      await xU3LP.rebalance();
      bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');

      // mint 2M one side
      mintAmount = bnDecimals(2000000, token1Decimals);
      await xU3LP.mintWithToken(1, mintAmount);
      await mineBlocks(5);
      await xU3LP.rebalance();
      bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');

      // mint both sides
      mintAmount = bnDecimals(5000000, token0Decimals);
      await xU3LP.mintWithToken(0, mintAmount);
      await mineBlocks(5);
      mintAmount = bnDecimals(3500000, token1Decimals);
      await xU3LP.mintWithToken(1, mintAmount);
      await mineBlocks(5);
      await xU3LP.rebalance();
      bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');

      // burn 95% of buffer balance - token 0 and 1
      burnAmount0 = bnDecimal(4400000);
      burnAmount1 = bnDecimal(4800000);
      await xU3LP.burn(0, burnAmount0);
      await mineBlocks(5);
      await xU3LP.burn(1, burnAmount1);
      await mineBlocks(5);
      
      await xU3LP.rebalance();

      bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');
    }),

    it('should be able to rebalance in a pool with 2:1 token ratio', async () => {
      // start: 95M token0 and token1
      let swapAmount = bnDecimal(30000000);
      await swapToken0ForToken1Decimals(router, token0, token1, admin.address, swapAmount);
      await increaseTime(3600);
      // after swap: 125M token0 and 65M token1 - ~2:1 ratio

      // burn 70% of buffer balance
      let burnAmount0 = bnDecimal(4990000);
      let burnAmount1 = bnDecimal(2000000);
      await xU3LP.burn(0, burnAmount0);
      await mineBlocks(5);
      await xU3LP.burn(1, burnAmount1);
      await mineBlocks(5);

      await xU3LP.rebalance();

      let bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');

      // burn 95% of buffer balance - token 0 and 1
      burnAmount0 = bnDecimal(4400000);
      burnAmount1 = bnDecimal(4800000);
      await xU3LP.burn(0, burnAmount0);
      await mineBlocks(5);
      await xU3LP.burn(1, burnAmount1);
      await mineBlocks(5);
      
      await xU3LP.rebalance();

      bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');

      // mint 5M one side
      let mintAmount = bnDecimals(5000000, token1Decimals);
      await xU3LP.mintWithToken(1, mintAmount);
      await mineBlocks(5);
      await xU3LP.rebalance();
      bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');

      // mint 1M one side
      mintAmount = bnDecimals(1000000, token0Decimals);
      await xU3LP.mintWithToken(0, mintAmount);
      await mineBlocks(5);
      await xU3LP.rebalance();
      bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');

      // mint both sides
      mintAmount = bnDecimals(5000000, token0Decimals);
      await xU3LP.mintWithToken(0, mintAmount);
      await mineBlocks(5);
      mintAmount = bnDecimals(3500000, token1Decimals);
      await xU3LP.mintWithToken(1, mintAmount);
      await xU3LP.rebalance();
      bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');
    }),

    it('should be able to rebalance in a pool with 3:1 token ratio', async () => {
      // start: 95M token0 and token1
      let swapAmount = bnDecimal(50000000);
      await swapToken0ForToken1Decimals(router, token0, token1, admin.address, swapAmount);
      await increaseTime(3600);
      // after swap: 145M token0 and 45M token1 - ~3:1 ratio

      // burn 70% of buffer balance
      let burnAmount0 = bnDecimal(4990000);
      let burnAmount1 = bnDecimal(2000000);
      await xU3LP.burn(0, burnAmount0);
      await mineBlocks(5);
      await xU3LP.burn(1, burnAmount1);
      await mineBlocks(5);

      await xU3LP.rebalance();

      let bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');

      // burn 95% of buffer balance - token 0 and 1
      burnAmount0 = bnDecimal(5000000);
      burnAmount1 = bnDecimal(4200000);
      await xU3LP.burn(0, burnAmount0);
      await mineBlocks(5);
      await xU3LP.burn(1, burnAmount1);
      await mineBlocks(5);
      
      await xU3LP.rebalance();

      bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');

      // mint 5M one side
      let mintAmount = bnDecimals(5000000, token1Decimals);
      await xU3LP.mintWithToken(1, mintAmount);
      await mineBlocks(5);
      await xU3LP.rebalance();
      bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');

      // mint 1M one side
      mintAmount = bnDecimals(1000000, token0Decimals);
      await xU3LP.mintWithToken(0, mintAmount);
      await mineBlocks(5);
      await xU3LP.rebalance();
      bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');

      // mint both sides
      mintAmount = bnDecimals(5000000, token0Decimals);
      await xU3LP.mintWithToken(0, mintAmount);
      await mineBlocks(5);
      mintAmount = bnDecimals(3500000, token1Decimals);
      await xU3LP.mintWithToken(1, mintAmount);
      await xU3LP.rebalance();
      bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');
    }),

    it('should be able to rebalance in a pool with 5:1 token ratio', async () => {
      // start: 95M token0 and token1
      let swapAmount = bnDecimal(65000000);
      await swapToken0ForToken1Decimals(router, token0, token1, admin.address, swapAmount);
      await increaseTime(3600);
      // after swap: 160M token0 and 30M token1 - ~5:1 ratio

      // burn 70% of buffer balance
      let burnAmount0 = bnDecimal(4990000);
      let burnAmount1 = bnDecimal(2000000);
      await xU3LP.burn(0, burnAmount0);
      await mineBlocks(5);
      await xU3LP.burn(1, burnAmount1);
      await mineBlocks(5);

      await xU3LP.rebalance();

      let bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');

      // burn 95% of buffer balance - token 0 and 1
      burnAmount0 = bnDecimal(5000000);
      burnAmount1 = bnDecimal(3000000);
      await xU3LP.burn(0, burnAmount0);
      await mineBlocks(5);
      await xU3LP.burn(1, burnAmount1);
      await mineBlocks(5);
      
      await xU3LP.rebalance();

      bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');

      // mint 5M one side
      let mintAmount = bnDecimals(5000000, token1Decimals);
      await xU3LP.mintWithToken(1, mintAmount);
      await mineBlocks(5);
      await xU3LP.rebalance();
      bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');

      // mint 2M one side
      mintAmount = bnDecimals(2000000, token0Decimals);
      await xU3LP.mintWithToken(0, mintAmount);
      await mineBlocks(5);
      await xU3LP.rebalance();
      bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');

      // mint both sides
      mintAmount = bnDecimals(5000000, token0Decimals);
      await xU3LP.mintWithToken(0, mintAmount);
      await mineBlocks(5);
      mintAmount = bnDecimals(3500000, token1Decimals);
      await xU3LP.mintWithToken(1, mintAmount);
      await xU3LP.rebalance();
      bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');
    }),

    it('should be able to rebalance in a pool with 10:1 token ratio', async () => {
      // start: 95M token0 and token1
      let swapAmount = bnDecimal(80000000);
      await swapToken0ForToken1Decimals(router, token0, token1, admin.address, swapAmount);
      await increaseTime(3600);
      // after swap: 175M token0 and 15M token1 - ~10:1 ratio

      // burn 70% of buffer balance
      let burnAmount0 = bnDecimal(4990000);
      let burnAmount1 = bnDecimal(2000000);
      await xU3LP.burn(0, burnAmount0);
      await mineBlocks(5);
      await xU3LP.burn(1, burnAmount1);
      await mineBlocks(5);

      await xU3LP.rebalance();

      let bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');

      // burn 95% of buffer balance - token 0 and 1
      burnAmount0 = bnDecimal(5000000);
      burnAmount1 = bnDecimal(2000000);
      await xU3LP.burn(0, burnAmount0);
      await mineBlocks(5);
      await xU3LP.burn(1, burnAmount1);
      await mineBlocks(5);
      
      await xU3LP.rebalance();

      bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');

      // mint 5M one side
      let mintAmount = bnDecimals(5000000, token1Decimals);
      await xU3LP.mintWithToken(1, mintAmount);
      await mineBlocks(5);
      await xU3LP.rebalance();
      bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');

      // mint 2M one side
      mintAmount = bnDecimals(2000000, token0Decimals);
      await xU3LP.mintWithToken(0, mintAmount);
      await mineBlocks(5);
      await xU3LP.rebalance();
      bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');

      // mint both sides
      mintAmount = bnDecimals(5000000, token0Decimals);
      await xU3LP.mintWithToken(0, mintAmount);
      await mineBlocks(5);
      mintAmount = bnDecimals(3500000, token1Decimals);
      await xU3LP.mintWithToken(1, mintAmount);
      await xU3LP.rebalance();
      bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');
     }),

    it('should be able to rebalance in a pool with 40:1 token ratio', async () => {
      // start: 95M token0 and token1
      let swapAmount = bnDecimal(90000000);
      await swapToken0ForToken1Decimals(router, token0, token1, admin.address, swapAmount);
      await increaseTime(3600);
      // after swap: 185M token0 and 5M token1 - ~40:1 ratio

      // burn 70% of buffer balance
      let burnAmount0 = bnDecimal(4990000);
      let burnAmount1 = bnDecimal(2000000);
      await xU3LP.burn(0, burnAmount0);
      await mineBlocks(5);
      await xU3LP.burn(1, burnAmount1);
      await mineBlocks(5);

      await xU3LP.rebalance();

      let bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');

      // mint 5M one side
      let mintAmount = bnDecimals(5000000, token1Decimals);
      await xU3LP.mintWithToken(1, mintAmount);
      await mineBlocks(5);
      await xU3LP.rebalance();
      bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');

      // mint 2M one side
      mintAmount = bnDecimals(2000000, token0Decimals);
      await xU3LP.mintWithToken(0, mintAmount);
      await mineBlocks(5);
      await xU3LP.rebalance();
      bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');

      // mint both sides
      mintAmount = bnDecimals(5000000, token0Decimals);
      await xU3LP.mintWithToken(0, mintAmount);
      await mineBlocks(5);
      mintAmount = bnDecimals(3500000, token1Decimals);
      await xU3LP.mintWithToken(1, mintAmount);
      await mineBlocks(5);
      await xU3LP.rebalance();
      bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');

      // burn 95% of buffer balance - token 0 and 1
      burnAmount0 = bnDecimal(4400000);
      burnAmount1 = bnDecimal(4800000);
      await xU3LP.burn(0, burnAmount0);
      await mineBlocks(5);
      await xU3LP.burn(1, burnAmount1);
      await mineBlocks(5);
      
      await xU3LP.rebalance();

      bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');
    })
  })
})
