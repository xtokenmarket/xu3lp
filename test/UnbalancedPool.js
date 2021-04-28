const { expect } = require('chai');
const { bnDecimal, swapToken0ForToken1, swapToken1ForToken0, 
        increaseTime, mineBlocks, getBufferPositionRatio } = require('../scripts/helpers');
const { deploymentFixture } = require('./fixture');

// Rebalancing in a unbalanced pool tests for xU3LP
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
      await xU3LP.rebalance();
  })

  describe('Rebalance in unbalanced pool', async () => {
    it('should be able to rebalance in a pool with 1:2 token ratio', async () => {
      // start: 95M DAI and USDC
      let swapAmount = bnDecimal(30000000);
      await swapToken1ForToken0(router, dai, usdc, admin.address, swapAmount);
      await increaseTime(3600);
      // after swap: 65M DAI and 125M USDC - ~1:2 ratio

      // burn 70% of buffer balance
      let burnAmount = bnDecimal(7000000);
      await xU3LP.burn(0, burnAmount);
      await mineBlocks(5);

      await xU3LP.rebalance();

      let bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');

      // burn 95% of buffer balance - token 1
      burnAmount = bnDecimal(9200000);
      await xU3LP.burn(1, burnAmount);
      await mineBlocks(5);
      await xU3LP.rebalance();

      bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');

      // burn 95% of buffer balance - token 0
      burnAmount = bnDecimal(9000000);
      await xU3LP.burn(0, burnAmount);
      await mineBlocks(5);
      await xU3LP.rebalance();

      bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');

      // mint 5M one side
      let mintAmount = bnDecimal(5000000);
      await xU3LP.mintWithToken(0, mintAmount);
      await mineBlocks(5);
      await xU3LP.rebalance();
      bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');

      // mint 2M one side
      mintAmount = bnDecimal(2000000);
      await xU3LP.mintWithToken(1, mintAmount);
      await mineBlocks(5);
      await xU3LP.rebalance();
      bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');

      // mint both sides
      mintAmount = bnDecimal(5000000);
      await xU3LP.mintWithToken(0, mintAmount);
      await mineBlocks(5);
      mintAmount = bnDecimal(3500000);
      await xU3LP.mintWithToken(1, mintAmount);
      await xU3LP.rebalance();
      bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');
    }),

    it('should be able to rebalance in a pool with 1:3 token ratio', async () => {
      // start: 95M DAI and USDC
      let swapAmount = bnDecimal(50000000);
      await swapToken1ForToken0(router, dai, usdc, admin.address, swapAmount);
      await increaseTime(3600);
      // after swap: 45M DAI and 145M USDC - ~1:3 ratio

      // burn 70% of buffer balance
      let burnAmount = bnDecimal(7000000);
      await xU3LP.burn(0, burnAmount);
      await mineBlocks(5);

      await xU3LP.rebalance();

      let bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');

      // burn 95% of buffer balance - token 1
      burnAmount = bnDecimal(9200000);
      await xU3LP.burn(1, burnAmount); 
      await mineBlocks(5);
      await xU3LP.rebalance();

      bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');

      // burn 95% of buffer balance - token 0
      burnAmount = bnDecimal(9000000);
      await xU3LP.burn(0, burnAmount);
      await mineBlocks(5);
      await xU3LP.rebalance();

      bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');

      // mint 5M one side
      let mintAmount = bnDecimal(5000000);
      await xU3LP.mintWithToken(0, mintAmount);
      await mineBlocks(5);
      await xU3LP.rebalance();
      bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');

      // mint 2M one side
      mintAmount = bnDecimal(2000000);
      await xU3LP.mintWithToken(1, mintAmount);
      await mineBlocks(5);
      await xU3LP.rebalance();
      bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');

      // mint both sides
      mintAmount = bnDecimal(5000000);
      await xU3LP.mintWithToken(0, mintAmount);
      await mineBlocks(5);
      mintAmount = bnDecimal(3500000);
      await xU3LP.mintWithToken(1, mintAmount);
      await xU3LP.rebalance();
      bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');
    }),

    it('should be able to rebalance in a pool with 1:5 token ratio', async () => {
      // start: 95M DAI and USDC
      let swapAmount = bnDecimal(65000000);
      await swapToken1ForToken0(router, dai, usdc, admin.address, swapAmount);
      await increaseTime(3600);
      // after swap: 30M DAI and 160M USDC - ~1:5 ratio
      
      // burn 70% of buffer balance
      let burnAmount = bnDecimal(7000000);
      await xU3LP.burn(0, burnAmount);
      await mineBlocks(5);
      await xU3LP.rebalance();

      let bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');

      // burn 95% of buffer balance - token 1
      burnAmount = bnDecimal(9200000);
      await xU3LP.burn(1, burnAmount);
      await mineBlocks(5);
      await xU3LP.rebalance();

      bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');

      // burn 95% of buffer balance - token 0
      burnAmount = bnDecimal(9000000);
      await xU3LP.burn(0, burnAmount);
      await mineBlocks(5);
      await xU3LP.rebalance();

      bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');

      // mint 5M one side
      let mintAmount = bnDecimal(5000000);
      await xU3LP.mintWithToken(0, mintAmount);
      await mineBlocks(5);
      await xU3LP.rebalance();
      bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');

      // mint 2M one side
      mintAmount = bnDecimal(2000000);
      await xU3LP.mintWithToken(1, mintAmount);
      await mineBlocks(5);
      await xU3LP.rebalance();
      bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');

      // mint both sides
      mintAmount = bnDecimal(5000000);
      await xU3LP.mintWithToken(0, mintAmount);
      await mineBlocks(5);
      mintAmount = bnDecimal(3500000);
      await xU3LP.mintWithToken(1, mintAmount);
      await xU3LP.rebalance();
      bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');
    }),

    it('should be able to rebalance in a pool with 1:10 token ratio', async () => {
      // start: 95M DAI and USDC
      let swapAmount = bnDecimal(80000000);
      await swapToken1ForToken0(router, dai, usdc, admin.address, swapAmount);
      await increaseTime(3600);
      // after swap: 15M DAI and 175M USDC - ~1:10 ratio
      
      // burn 70% of buffer balance
      let burnAmount = bnDecimal(7000000);
      await xU3LP.burn(0, burnAmount);
      await mineBlocks(5);
      await xU3LP.rebalance();

      let bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');

      // burn 95% of buffer balance - token 1
      burnAmount = bnDecimal(9200000);
      await xU3LP.burn(1, burnAmount);
      await mineBlocks(5);
      await xU3LP.rebalance();

      bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');

      // burn 95% of buffer balance - token 0
      burnAmount = bnDecimal(9000000);
      await xU3LP.burn(0, burnAmount);
      await mineBlocks(5);
      await xU3LP.rebalance();

      bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');

      // mint 5M one side
      let mintAmount = bnDecimal(5000000);
      await xU3LP.mintWithToken(0, mintAmount);
      await mineBlocks(5);
      await xU3LP.rebalance();
      bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');

      // mint 2M one side
      mintAmount = bnDecimal(2000000);
      await xU3LP.mintWithToken(1, mintAmount);
      await mineBlocks(5);
      await xU3LP.rebalance();
      bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');

      // mint both sides
      mintAmount = bnDecimal(5000000);
      await xU3LP.mintWithToken(0, mintAmount);
      await mineBlocks(5);
      mintAmount = bnDecimal(3500000);
      await xU3LP.mintWithToken(1, mintAmount);
      await xU3LP.rebalance();
      bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');
    }),

    it('should be able to rebalance in a pool with 1:40 token ratio', async () => {
      // start: 95M DAI and USDC
      let swapAmount = bnDecimal(90000000);
      await swapToken1ForToken0(router, dai, usdc, admin.address, swapAmount);
      await increaseTime(3600);
      // after swap: 5M DAI and 185M USDC - ~1:40 ratio

      // burn 70% of buffer balance
      let burnAmount = bnDecimal(7000000);
      await xU3LP.burn(0, burnAmount);
      await mineBlocks(5);
      await xU3LP.rebalance();

      let bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');

      // mint 5M one side
      let mintAmount = bnDecimal(5000000);
      await xU3LP.mintWithToken(0, mintAmount);
      await mineBlocks(5);
      await xU3LP.rebalance();
      bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');

      // mint 2M one side
      mintAmount = bnDecimal(2000000);
      await xU3LP.mintWithToken(1, mintAmount);
      await mineBlocks(5);
      await xU3LP.rebalance();
      bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');

      // mint both sides
      mintAmount = bnDecimal(5000000);
      await xU3LP.mintWithToken(0, mintAmount);
      await mineBlocks(5);
      mintAmount = bnDecimal(3500000);
      await xU3LP.mintWithToken(1, mintAmount);
      await mineBlocks(5);
      await xU3LP.rebalance();
      bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');

      // burn 95% of buffer balance - token 1
      burnAmount = bnDecimal(9200000);
      await xU3LP.burn(1, burnAmount);
      await mineBlocks(5);
      await xU3LP.rebalance();

      bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');

      //burn 90% of buffer balance - token 0
      burnAmount = bnDecimal(8000000);
      await xU3LP.burn(0, burnAmount);
      await mineBlocks(5);
      await xU3LP.rebalance();

      bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');
    }),

    it('should be able to rebalance in a pool with 2:1 token ratio', async () => {
      // start: 95M DAI and USDC
      let swapAmount = bnDecimal(30000000);
      await swapToken0ForToken1(router, dai, usdc, admin.address, swapAmount);
      await increaseTime(3600);
      // after swap: 125M DAI and 65M USDC - ~2:1 ratio

      // burn 70% of buffer balance
      let burnAmount = bnDecimal(7000000);
      await xU3LP.burn(0, burnAmount);
      await mineBlocks(5);

      await xU3LP.rebalance();

      let bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');

      // burn 95% of buffer balance - token 1
      burnAmount = bnDecimal(9200000);
      await xU3LP.burn(1, burnAmount);
      await mineBlocks(5);
      await xU3LP.rebalance();

      bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');

      // burn 95% of buffer balance - token 0
      burnAmount = bnDecimal(9000000);
      await xU3LP.burn(0, burnAmount);
      await mineBlocks(5);
      await xU3LP.rebalance();

      bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');

      // mint 5M one side
      let mintAmount = bnDecimal(5000000);
      await xU3LP.mintWithToken(1, mintAmount);
      await mineBlocks(5);
      await xU3LP.rebalance();
      bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');

      // mint 2M one side
      mintAmount = bnDecimal(2000000);
      await xU3LP.mintWithToken(0, mintAmount);
      await mineBlocks(5);
      await xU3LP.rebalance();
      bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');

      // mint both sides
      mintAmount = bnDecimal(5000000);
      await xU3LP.mintWithToken(0, mintAmount);
      await mineBlocks(5);
      mintAmount = bnDecimal(3500000);
      await xU3LP.mintWithToken(1, mintAmount);
      await xU3LP.rebalance();
      bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');
    })

    it('should be able to rebalance in a pool with 3:1 token ratio', async () => {
      // start: 95M DAI and USDC
      let swapAmount = bnDecimal(50000000);
      await swapToken0ForToken1(router, dai, usdc, admin.address, swapAmount);
      await increaseTime(3600);
      // after swap: 145M DAI and 45M USDC - ~3:1 ratio

      // burn 70% of buffer balance
      let burnAmount = bnDecimal(7000000);
      await xU3LP.burn(0, burnAmount);
      await mineBlocks(5);

      await xU3LP.rebalance();

      let bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');

      // burn 95% of buffer balance - token 1
      burnAmount = bnDecimal(9200000);
      await xU3LP.burn(1, burnAmount);
      await mineBlocks(5);
      await xU3LP.rebalance();

      bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');

      // burn 95% of buffer balance - token 0
      burnAmount = bnDecimal(9000000);
      await xU3LP.burn(0, burnAmount);
      await mineBlocks(5);
      await xU3LP.rebalance();

      bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');

      // mint 5M one side
      let mintAmount = bnDecimal(5000000);
      await xU3LP.mintWithToken(1, mintAmount);
      await mineBlocks(5);
      await xU3LP.rebalance();
      bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');

      // mint 2M one side
      mintAmount = bnDecimal(2000000);
      await xU3LP.mintWithToken(0, mintAmount);
      await mineBlocks(5);
      await xU3LP.rebalance();
      bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');

      // mint both sides
      mintAmount = bnDecimal(5000000);
      await xU3LP.mintWithToken(0, mintAmount);
      await mineBlocks(5);
      mintAmount = bnDecimal(3500000);
      await xU3LP.mintWithToken(1, mintAmount);
      await xU3LP.rebalance();
      bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');
    }),

    it('should be able to rebalance in a pool with 5:1 token ratio', async () => {
      // start: 95M DAI and USDC
      let swapAmount = bnDecimal(65000000);
      await swapToken0ForToken1(router, dai, usdc, admin.address, swapAmount);
      await increaseTime(3600);
      // after swap: 160M DAI and 30M USDC - ~5:1 ratio

      // burn 70% of buffer balance
      let burnAmount = bnDecimal(7000000);
      await xU3LP.burn(0, burnAmount);
      await mineBlocks(5);

      await xU3LP.rebalance();

      let bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');

      // burn 95% of buffer balance - token 1
      burnAmount = bnDecimal(9200000);
      await xU3LP.burn(1, burnAmount);
      await mineBlocks(5);
      await xU3LP.rebalance();

      bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');

      // burn 95% of buffer balance - token 0
      burnAmount = bnDecimal(9000000);
      await xU3LP.burn(0, burnAmount);
      await mineBlocks(5);
      await xU3LP.rebalance();

      bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');

      // mint 5M one side
      let mintAmount = bnDecimal(5000000);
      await xU3LP.mintWithToken(1, mintAmount);
      await mineBlocks(5);
      await xU3LP.rebalance();
      bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');

      // mint 2M one side
      mintAmount = bnDecimal(2000000);
      await xU3LP.mintWithToken(0, mintAmount);
      await mineBlocks(5);
      await xU3LP.rebalance();
      bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');

      // mint both sides
      mintAmount = bnDecimal(5000000);
      await xU3LP.mintWithToken(0, mintAmount);
      await mineBlocks(5);
      mintAmount = bnDecimal(3500000);
      await xU3LP.mintWithToken(1, mintAmount);
      await xU3LP.rebalance();
      bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');
    }),

    it('should be able to rebalance in a pool with 10:1 token ratio', async () => {
      // start: 95M DAI and USDC
      let swapAmount = bnDecimal(80000000);
      await swapToken0ForToken1(router, dai, usdc, admin.address, swapAmount);
      await increaseTime(3600);
      // after swap: 175M DAI and 15M USDC - ~10:1 ratio

      // burn 70% of buffer balance
      let burnAmount = bnDecimal(7000000);
      await xU3LP.burn(0, burnAmount);
      await mineBlocks(5);

      await xU3LP.rebalance();

      let bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');

      // burn 95% of buffer balance - token 1
      burnAmount = bnDecimal(9200000);
      await xU3LP.burn(1, burnAmount);
      await mineBlocks(5);
      await xU3LP.rebalance();

      bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');

      // burn 95% of buffer balance - token 0
      burnAmount = bnDecimal(9000000);
      await xU3LP.burn(0, burnAmount);
      await mineBlocks(5);
      await xU3LP.rebalance();

      bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');

      // mint 5M one side
      let mintAmount = bnDecimal(5000000);
      await xU3LP.mintWithToken(1, mintAmount);
      await mineBlocks(5);
      await xU3LP.rebalance();
      bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');

      // mint 2M one side
      mintAmount = bnDecimal(2000000);
      await xU3LP.mintWithToken(0, mintAmount);
      await mineBlocks(5);
      await xU3LP.rebalance();
      bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');

      // mint both sides
      mintAmount = bnDecimal(5000000);
      await xU3LP.mintWithToken(0, mintAmount);
      await mineBlocks(5);
      mintAmount = bnDecimal(3500000);
      await xU3LP.mintWithToken(1, mintAmount);
      await xU3LP.rebalance();
      bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');
    }),

    it('should be able to rebalance in a pool with 40:1 token ratio', async () => {
      // start: 95M DAI and USDC
      let swapAmount = bnDecimal(90000000);
      await swapToken0ForToken1(router, dai, usdc, admin.address, swapAmount);
      await increaseTime(3600);
      // after swap: 185M DAI and 5M USDC - ~40:1 ratio

      // burn 70% of buffer balance
      let burnAmount = bnDecimal(7000000);
      await xU3LP.burn(0, burnAmount);
      await mineBlocks(5);
      await xU3LP.rebalance();

      let bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');

      // mint 5M one side
      let mintAmount = bnDecimal(5000000);
      await xU3LP.mintWithToken(1, mintAmount);
      await mineBlocks(5);
      await xU3LP.rebalance();
      bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');

      // mint 2M one side
      mintAmount = bnDecimal(2000000);
      await xU3LP.mintWithToken(0, mintAmount);
      await mineBlocks(5);
      await xU3LP.rebalance();
      bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');

      // mint both sides
      mintAmount = bnDecimal(5000000);
      await xU3LP.mintWithToken(0, mintAmount);
      await mineBlocks(5);
      mintAmount = bnDecimal(3500000);
      await xU3LP.mintWithToken(1, mintAmount);
      await mineBlocks(5);
      await xU3LP.rebalance();
      bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');

      // burn 95% of buffer balance - token 1
      burnAmount = bnDecimal(9200000);
      await xU3LP.burn(1, burnAmount);
      await mineBlocks(5);
      await xU3LP.rebalance();

      bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');

      //burn 90% of buffer balance - token 0
      burnAmount = bnDecimal(8000000);
      await xU3LP.burn(0, burnAmount);
      await mineBlocks(5);
      await xU3LP.rebalance();

      bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');
    })
  })
})
