const { expect } = require('chai');
const { bnDecimal, mineBlocks } = require('../scripts/helpers');
const { deploymentFixture } = require('./fixture');

// Block locking tests for xU3LP
describe('Contract: xU3LP', async () => {
  let xU3LP, dai, usdc, admin, user1, user2;

  beforeEach(async () => {
      ({ xU3LP, dai, usdc } = await deploymentFixture());
      [admin, user1, user2] = await ethers.getSigners();
      let mintAmount = bnDecimal(100000000);
      await xU3LP.mintInitial(mintAmount, mintAmount);
      await xU3LP.rebalance();
      const approveAmount = bnDecimal(1000000);
      await dai.transfer(user2.address, approveAmount);
      await usdc.transfer(user2.address, approveAmount);
      await dai.connect(user2).approve(xU3LP.address, approveAmount);
      await usdc.connect(user2).approve(xU3LP.address, approveAmount);
      await xU3LP.connect(user1).mintWithToken(0, bnDecimal(100000));
      await xU3LP.connect(user2).mintWithToken(0, bnDecimal(100000));
      await mineBlocks(5);
  })

  describe('Mint, burn and transfer lock', async () => {
    it('account shouldn\'t be able to call mint, burn and transfer before 6 blocks have been mined', async () => {
        await xU3LP.mintWithToken(0, bnDecimal(100000));
        await expect(xU3LP.burn(0, bnDecimal(100000))).
            to.be.revertedWith('Function is locked for this address');
        await expect(xU3LP.transfer(user1.address, bnDecimal(10000))).
            to.be.revertedWith('Function is locked for this address');
    }),

    it('account shouldn\'t be able to call burn, mint and transfer before 6 blocks have been mined', async () => {
        await xU3LP.burn(0, bnDecimal(100000));
        await expect(xU3LP.mintWithToken(0, bnDecimal(100000))).
            to.be.revertedWith('Function is locked for this address');
        await expect(xU3LP.transfer(user1.address, bnDecimal(10000))).
            to.be.revertedWith('Function is locked for this address');
    }),

    it('account shouldn\'t be able to call transfer, mint and burn before 6 blocks have been mined', async () => {
        await xU3LP.transfer(user1.address, bnDecimal(10000));
        await expect(xU3LP.mintWithToken(0, bnDecimal(100000))).
            to.be.revertedWith('Function is locked for this address');
        await expect(xU3LP.burn(0, bnDecimal(100000))).
            to.be.revertedWith('Function is locked for this address');
    }),

    it('account should be able to call mint, burn or transfer if >= 6 blocks have been mined', async () => {
        await xU3LP.mintWithToken(0, bnDecimal(100000));
        await mineBlocks(5);
        await xU3LP.burn(0, bnDecimal(100000));
        await mineBlocks(5);
        await xU3LP.transfer(user1.address, bnDecimal(10000));
    }),

    it('other accounts should be able to call mint even if one is locked', async () => {
        await xU3LP.mintWithToken(0, bnDecimal(100000));
        await expect(xU3LP.mintWithToken(0, bnDecimal(100000))).
            to.be.revertedWith('Function is locked for this address');
        await xU3LP.connect(user1).mintWithToken(0, bnDecimal(100000));
        await xU3LP.connect(user2).mintWithToken(0, bnDecimal(100000));
    }),

    it('other accounts should be able to call burn even if one is locked', async () => {
        await xU3LP.mintWithToken(0, bnDecimal(100000));
        await expect(xU3LP.mintWithToken(0, bnDecimal(100000))).
            to.be.revertedWith('Function is locked for this address');
        await xU3LP.connect(user1).burn(0, bnDecimal(10000));
        await xU3LP.connect(user2).burn(0, bnDecimal(10000));
    }),

    it('other accounts should be able to call transfer even if one is locked', async () => {
        await xU3LP.mintWithToken(0, bnDecimal(100000));
        await expect(xU3LP.mintWithToken(0, bnDecimal(100000))).
            to.be.revertedWith('Function is locked for this address');
        await xU3LP.connect(user1).transfer(user2.address, bnDecimal(10000));
        await xU3LP.connect(user2).transfer(user1.address, bnDecimal(10000));
    })
  })
})
