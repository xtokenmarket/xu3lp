const assert = require('assert');
const { expect } = require('chai');
const { deploymentFixture } = require('./fixture');

// Ownership functions tests for xU3LP
describe('Contract: xU3LP', async () => {
  let xU3LP, admin, user1, user2, user3;

  beforeEach(async () => {
      ({ xU3LP } = await deploymentFixture());
      [admin, user1, user2, user3, ...addrs] = await ethers.getSigners();
  })

  describe('Ownership', async () => {
    it('should allow admin to set other managers', async () => {
        await xU3LP.setManager(user1.address);
        await xU3LP.setManager2(user2.address);
        assert(true);
    }),
    it('should allow new managers to call management functions', async () => {
        await xU3LP.setManager(user1.address);
        await xU3LP.connect(user1).withdrawFees();
        await xU3LP.setManager2(user2.address);
        await xU3LP.connect(user2).withdrawFees();
        assert(true);
    }),
    it('shouldn\'t allow non-managers to call management functions', async () => {
        await expect(xU3LP.connect(user1).rebalance()).to.be.reverted;
        await expect(xU3LP.connect(user1).withdrawFees()).to.be.reverted;
        await expect(xU3LP.connect(user1).pauseContract()).to.be.reverted;
    }),
    it('shouldn\'t allow managers to set other managers', async () => {
        await xU3LP.setManager(user1.address);
        await expect(xU3LP.connect(user1).setManager2(user2)).to.be.reverted;
    })
  })
})
