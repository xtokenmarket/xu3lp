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
        let amount = 10000;
        await xU3LP.mintWithToken(0, amount);
        let balance = await getXU3LPBalance(xU3LP, admin);
        let feeDivisors = await xU3LP.feeDivisors();
        let mintFee = feeDivisors.mintFee;

        let actualBalance = amount - (amount / mintFee);

        assert(balance == (actualBalance));
    })

    it('burn xu3lp tokens from user', async () => {
      let mintAmount = 10000;
      let burnAmount = 100;
      await xU3LP.mintWithToken(0, mintAmount);

      await xU3LP.burn(0, burnAmount);
      
      let feeDivisors = await xU3LP.feeDivisors();
      let mintFee = feeDivisors.mintFee;
      let burnFee = feeDivisors.burnFee;

      let actualBalance = new Number(
                          (mintAmount - (mintAmount / mintFee) - 
                          burnAmount - (burnAmount / burnFee))).toFixed(0);

      let balance = await getXU3LPBalance(xU3LP, admin);
      assert(balance == actualBalance)
    })
  })
})
