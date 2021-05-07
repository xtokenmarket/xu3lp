const { deploymentFixture } = require('./fixture');
const { bnDecimal, getBufferBalance, getPositionBalance } = require('../scripts/helpers');

// Experimenting with rebalance bugs
describe('Contract: xU3LP', async () => {
  let xU3LP, dai, usdc, user, user2;

  beforeEach(async () => {
		({ xU3LP, usdc, dai } = await deploymentFixture());
    const signers = await ethers.getSigners();
    [admin, user, user2, ...addrs] = await ethers.getSigners();
    let mintAmount = bnDecimal(100000000);
    await xU3LP.mintInitial(mintAmount, mintAmount);
  })

  describe('Rebalance bug and failing swap scenarios', async () => {
    // it('should reproduce the bug where we try to swap with 0 balance', async () => {
    //   let amount = bnDecimal(1000000);
    //   await xU3LP.mintWithToken(0, amount);
    //   let balances = await getBufferBalance(xU3LP);
    //   console.log(balances);
    //   await xU3LP.rebalance();
    // }),

    // it('should reproduce the bug where we try to mint 0 of one asset', async () => {
    //   await xU3LP.rebalance();
    //   let amount = bnDecimal(1000000);
    //   await xU3LP.mintWithToken(0, amount);
    //   let balances = await getBufferBalance(xU3LP);
    //   console.log('xu3lp balance', balances);
    //   let poolBalances = await getPositionBalance(xU3LP);
    //   console.log('pool balance', poolBalances);
    //   await xU3LP.rebalance();
    // }),

    it('should attempt to fix bug number 1', async () => {
      let amount = bnDecimal(1000000);
      await xU3LP.mintWithToken(0, amount);
      let balances = await getBufferBalance(xU3LP);
      console.log('old balances:', balances);
      // fix attempt 1 - swap tokens to get 50:50 ratio
      // dai is 1M balance, usdc is 0
      let amount0 = balances.dai;
      let amount1 = balances.usdc;
      await xU3LP.adminSwap(bnDecimal(amount0 / 2), true);
      balances = await getBufferBalance(xU3LP);
      console.log('new balances', balances);
      await xU3LP.rebalance();
    })

    it('should reproduce the bug where we try to swap with 0 balance', async () => {
      let amount = bnDecimal(100000);
      await xU3LP.mintWithToken(0, amount);
      let balances = await getBufferBalance(xU3LP);
      console.log(balances);
      await xU3LP.rebalance();
    }),

    it('should be able to rebalance after mint and burn in a pool with 1:10 token ratio', async () => {
      // start: 95M DAI and USDC
      let swapAmount = bnDecimal(80000000);
      await swapToken1ForToken0(router, dai, usdc, admin.address, swapAmount);
      await increaseTime(3600);
      // after swap: 15M DAI and 175M USDC

      // burn 90% of buffer balance
      let burnAmount = bnDecimal(9000000);
      await xU3LP.burn(0, burnAmount);
      await mineBlocks(5);

      await xU3LP.mintWithToken(1, burnAmount);
      await xU3LP.rebalance();
      await xU3LP.rebalance();

      let bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');
    }),

    it('should be able to rebalance after mint and burn in a pool with 1:20 token ratio', async () => {
      // start: 95M DAI and USDC
      let swapAmount = bnDecimal(88000000);
      await swapToken1ForToken0(router, dai, usdc, admin.address, swapAmount);
      await increaseTime(3600);
      // after swap: 7M DAI and 183M USDC

      // mint 10x to one token
      let mintAmount = bnDecimal(50000000);

      // Vastly overtipped case:
      // pool is 1:20 ratio
      // xU3LP is 1:10 ratio
      // result is 4% buffer balance after first rebalance

      await xU3LP.mintWithToken(1, mintAmount);
      await xU3LP.rebalance();
      await xU3LP.rebalance();

      let bufferPoolRatio = await getBufferPositionRatio(xU3LP);
      expect(bufferPoolRatio).to.be.equal('5.0');
    })
  })
})
