const { expect } = require('chai');
const { bnDecimal, bnDecimals, mineBlocks } = require('../scripts/helpers');
const { deploymentFixture } = require('./fixture');

// Block locking tests for xU3LP
describe('Contract: xU3LP', async () => {
  let xU3LP, token0, token1, token0Decimals, token1Decimals, admin, user1, user2;

  beforeEach(async () => {
      ({ xU3LP, token0, token1, token0Decimals, token1Decimals } = await deploymentFixture());
      [admin, user1, user2] = await ethers.getSigners();
      let mintAmount = bnDecimals(100000000, token0Decimals);
      let mintAmount2 = bnDecimals(100000000, token1Decimals);
      await xU3LP.mintInitial(mintAmount, mintAmount2);
      await xU3LP.rebalance();
      const approveAmount = bnDecimals(1000000, token0Decimals);
      const approveAmount2 = bnDecimals(1000000, token1Decimals);
      await token0.transfer(user2.address, approveAmount);
      await token1.transfer(user2.address, approveAmount2);
      await token0.connect(user2).approve(xU3LP.address, approveAmount);
      await token1.connect(user2).approve(xU3LP.address, approveAmount2);
      await xU3LP.connect(user1).mintWithToken(0, bnDecimals(100000, token0Decimals));
      await xU3LP.connect(user2).mintWithToken(0, bnDecimals(100000, token0Decimals));
      await mineBlocks(5);
  })

  describe('Mint, burn and transfer lock', async () => {
    it('account shouldn\'t be able to call mint, burn and transfer before 6 blocks have been mined', async () => {
        await xU3LP.mintWithToken(0, bnDecimals(100000, token0Decimals));
        await expect(xU3LP.burn(0, bnDecimal(100000))).
            to.be.reverted;
        await expect(xU3LP.transfer(user1.address, bnDecimal(10000))).
            to.be.reverted;
    }),

    it('account shouldn\'t be able to call burn, mint and transfer before 6 blocks have been mined', async () => {
        await xU3LP.burn(0, bnDecimal(100000));
        await expect(xU3LP.mintWithToken(0, bnDecimals(100000, token0Decimals))).
            to.be.reverted;
        await expect(xU3LP.transfer(user1.address, bnDecimal(10000))).
            to.be.reverted;
    }),

    it('account shouldn\'t be able to call transfer, mint and burn before 6 blocks have been mined', async () => {
        await xU3LP.transfer(user1.address, bnDecimal(10000));
        await expect(xU3LP.mintWithToken(0, bnDecimals(100000, token0Decimals))).
            to.be.reverted;
        await expect(xU3LP.burn(0, bnDecimal(100000))).
            to.be.reverted;
    }),

    it('account should be able to call mint, burn or transfer if >= 6 blocks have been mined', async () => {
        await xU3LP.mintWithToken(0, bnDecimals(100000, token0Decimals));
        await mineBlocks(5);
        await xU3LP.burn(0, bnDecimal(100000));
        await mineBlocks(5);
        await xU3LP.transfer(user1.address, bnDecimal(10000));
    }),

    it('other accounts should be able to call mint even if one is locked', async () => {
        await xU3LP.mintWithToken(0, bnDecimals(100000, token0Decimals));
        await expect(xU3LP.mintWithToken(0, bnDecimals(100000, token0Decimals))).
            to.be.reverted;
        await xU3LP.connect(user1).mintWithToken(0, bnDecimals(100000, token0Decimals));
        await xU3LP.connect(user2).mintWithToken(0, bnDecimals(100000, token0Decimals));
    }),

    it('other accounts should be able to call burn even if one is locked', async () => {
        await xU3LP.mintWithToken(0, bnDecimals(100000, token0Decimals));
        await expect(xU3LP.mintWithToken(0, bnDecimals(100000, token0Decimals))).
            to.be.reverted;
        await xU3LP.connect(user1).burn(0, bnDecimal(10000));
        await xU3LP.connect(user2).burn(0, bnDecimal(10000));
    }),

    it('other accounts should be able to call transfer even if one is locked', async () => {
        await xU3LP.mintWithToken(0, bnDecimals(100000, token0Decimals));
        await expect(xU3LP.mintWithToken(0, bnDecimals(100000, token0Decimals))).
            to.be.reverted;
        await xU3LP.connect(user1).transfer(user2.address, bnDecimal(10000));
        await xU3LP.connect(user2).transfer(user1.address, bnDecimal(10000));
    })
  })
})
