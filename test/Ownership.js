const assert = require('assert');
const { expect } = require('chai');
const { deploymentFixture } = require('./fixture');

// Ownership functions tests for xU3LP
describe('Contract: xU3LP', async () => {
  let xU3LP, admin, user1, user2, user3;

  beforeEach(async () => {
      ({ xU3LP, xTokenManager } = await deploymentFixture());
      [admin, user1, user2, user3, ...addrs] = await ethers.getSigners();
  })

  describe('Ownership', async () => {
    it('should allow admin to set other managers', async () => {
        await xTokenManager.addManager(user1.address, xU3LP.address);
        await xTokenManager.addManager(user2.address, xU3LP.address);
        assert(true);
    }),
    it('should allow new managers to call management functions', async () => {
        await xTokenManager.addManager(user1.address, xU3LP.address);
        await xU3LP.connect(user1).withdrawFees();
        await xTokenManager.addManager(user2.address, xU3LP.address);
        await xU3LP.connect(user2).withdrawFees();
        assert(true);
    }),
    it('shouldn\'t allow non-managers to call management functions', async () => {
        await expect(xU3LP.connect(user1).rebalance()).to.be.reverted;
        await expect(xU3LP.connect(user1).withdrawFees()).to.be.reverted;
        await expect(xU3LP.connect(user1).pauseContract()).to.be.reverted;
    }),
    it('shouldn\'t allow managers to set other managers', async () => {
        await xTokenManager.addManager(user1.address, xU3LP.address);
        await expect(xTokenManager.connect(user1).addManager(user2.address, xU3LP.address)).to.be.reverted;
    })
  })
})
