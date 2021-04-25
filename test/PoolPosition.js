const { expect } = require('chai');
const { bnDecimal } = require('../scripts/helpers');
const { deploymentFixture } = require('./fixture');

// Pool Position initializing, migrating and checking
describe('Contract: xU3LP', async () => {
  let xU3LP, router, dai, usdc, admin, user1, user2, user3;

  before(async () => {
      ({ xU3LP, dai, usdc, router } = await deploymentFixture());
      [admin, user1, user2, user3, ...addrs] = await ethers.getSigners();
      // approve some tokens for swapping
      let approveAmount = bnDecimal(100000000);
      await dai.approve(router.address, approveAmount);
      await usdc.approve(router.address, approveAmount);
  })

  describe('Pool position', async () => {
    it('should revert on attempting to initialize position without sending tokens', async () => {
        await expect(xU3LP.mintInitial(0, 0)).
            to.be.revertedWith('Cannot mint without sending tokens');
    }),

    it('should be able to initialize position', async () => {
        let mintAmount = bnDecimal(100000000);
        await xU3LP.mintInitial(mintAmount, mintAmount);
        let nftId = await xU3LP.tokenId();

        expect(nftId).not.to.be.equal(0);
    }),

    it('should revert on attempting to initialize position again', async () => {
        let mintAmount = bnDecimal(100000000);
        await expect(xU3LP.mintInitial(mintAmount, mintAmount)).
            to.be.revertedWith('Position already initialized');
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

    it('should revert attempting to migrate position with same ticks', async () => {
        let ticks = await xU3LP.getTicks();

        await expect(xU3LP.migratePosition(ticks.tick0, ticks.tick1)).
            to.be.revertedWith('Position may only be migrated with different ticks');
    }),

    it('should retrieve staked balance in the pool position', async () => {
        let balance = await xU3LP.getStakedBalance();
        expect(balance).not.to.equal(0);
    }),

    it('should retrieve staked token balance in the pool position', async () => {
        let balance = await xU3LP.getStakedTokenBalance();

        expect(balance.amount0).not.to.equal(0);
        expect(balance.amount1).not.to.equal(0);
    }),

    it('should retrieve pool position lower and upper ticks', async () => {
        let ticks = await xU3LP.getTicks();

        expect(ticks.tick0).to.equal(-100);
        expect(ticks.tick1).to.equal(100);
    }),

    it('should retrieve pool position nft id', async () => {
        let tokenId = await xU3LP.tokenId();

        expect(tokenId).not.to.equal(0);
    })
  })
})
