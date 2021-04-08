const assert = require('assert');
const { deploymentFixture } = require('./fixture');
const { getBalance, getXU3LPBalance } = require('../scripts/helpers');

// Rebalance tests for xU3LP
describe('Contract: xU3LP', async () => {
  let dai, usdc, pool, xU3LP, admin;
  let bufferPercentage = 5;

  beforeEach(async () => {
		({ dai, usdc, pool, xU3LP } = await deploymentFixture());
    const signers = await ethers.getSigners();
    admin = signers[0].address;
  })

  describe('Mint and burn', async () => {
    it('mint xu3lp tokens to user', async () => {
        await xU3LP.mintWithToken(0, '10000');
        await xU3LP.mintWithToken(1, '10000');    
        let balance = await getXU3LPBalance(xU3LP, admin);

        assert(balance == 20000);
    })

    it('burn xu3lp tokens from user', async () => {
      await xU3LP.mintWithToken(0, '10000');
      await xU3LP.mintWithToken(1, '10000');

      await xU3LP.burn(0, '100');
      await xU3LP.burn(1, '100');

      let balance = await getXU3LPBalance(xU3LP, admin);
      assert(balance == (20000 - 200))
    })
  })
})
