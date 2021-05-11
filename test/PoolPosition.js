const { expect } = require('chai');
const { bnDecimals } = require('../scripts/helpers');
const { deploymentFixture } = require('./fixture');

// Pool Position initializing, migrating and checking
describe('Contract: xU3LP', async () => {
  let xU3LP, router, token0, token1, token0Decimals, token1Decimals, admin, user1, user2, user3;
  let newTick0, newTick1;

  before(async () => {
      ({ xU3LP, token0, token1, token0Decimals, token1Decimals, router } = await deploymentFixture());
      [admin, user1, user2, user3, ...addrs] = await ethers.getSigners();
      // approve some tokens for swapping
      let approveAmount = bnDecimals(100000000, token0Decimals);
      let approveAmount2 = bnDecimals(100000000, token1Decimals);
      await token0.approve(router.address, approveAmount);
      await token1.approve(router.address, approveAmount2);
  })

  describe('Pool position', async () => {
    it('should revert on attempting to initialize position without sending tokens', async () => {
        await expect(xU3LP.mintInitial(0, 0)).
            to.be.reverted;
    }),

    it('should be able to initialize position', async () => {
        let mintAmount = bnDecimals(100000000, token0Decimals);
        let mintAmount2 = bnDecimals(100000000, token1Decimals);
        await xU3LP.mintInitial(mintAmount, mintAmount2);
        let nftId = await xU3LP.tokenId();

        expect(nftId).not.to.be.equal(0);
    }),

    it('should revert on attempting to initialize position again', async () => {
        let mintAmount = bnDecimals(100000000, token0Decimals);
        let mintAmount2 = bnDecimals(100000000, token1Decimals);
        await expect(xU3LP.mintInitial(mintAmount, mintAmount2)).
            to.be.reverted;
    }),

    it('should be able to migrate position', async () => {
        let prevTokenId = await xU3LP.tokenId();
        let prevTicks = await xU3LP.getTicks();
        newTick0 = prevTicks.tick0 - 20;
        newTick1 = prevTicks.tick1 + 20;

        await xU3LP.migratePosition(newTick0, newTick1);
        let newTicks = await xU3LP.getTicks();
        let newTokenId = await xU3LP.tokenId();

        expect(newTicks.tick0).to.equal(newTick0);
        expect(newTicks.tick1).to.equal(newTick1);
        expect(prevTokenId).not.to.equal(newTokenId);
    }),

    it('should retrieve pool position lower and upper ticks', async () => {
        let ticks = await xU3LP.getTicks();

        expect(ticks.tick0).to.equal(newTick0);
        expect(ticks.tick1).to.equal(newTick1);
    }),

    it('should revert attempting to migrate position with same ticks', async () => {
        let ticks = await xU3LP.getTicks();

        await expect(xU3LP.migratePosition(ticks.tick0, ticks.tick1)).
            to.be.reverted;
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

    it('should retrieve pool position nft id', async () => {
        let tokenId = await xU3LP.tokenId();

        expect(tokenId).not.to.equal(0);
    })
  })
})
