const assert = require('assert');
const { deploymentFixture } = require('./fixtureNew');
const { getXU3LPBalance, bn } = require('../scripts/helpers');

// Mint and burn tests for xU3LP
describe('Contract: xU3LP', async () => {
  let xU3LP, user;

  beforeEach(async () => {
		({ xU3LP } = await deploymentFixture());
    const signers = await ethers.getSigners();
    user = signers[1];
  })

  describe('Mint and burn', async () => {
    it('mint xu3lp tokens to user', async () => {
        let amount = 1000000;
        await xU3LP.connect(user).mintWithToken(0, amount);
        let balance = await getXU3LPBalance(xU3LP, user.address);
        let feeDivisors = await xU3LP.feeDivisors();
        let mintFee = feeDivisors.mintFee;

        let amountWithoutFees = amount - (amount / mintFee);

        const nav = await xU3LP.getNav();
        const totalSupply = await xU3LP.totalSupply();
        let calculatedBalance = bn(amountWithoutFees).mul(totalSupply).div(nav).toNumber();

        // math operations in solidity (rounded down) vs ethersjs bignumber difference (rounded up)
        calculatedBalance -= 1;

        assert(balance.toNumber() == calculatedBalance);
    })

    it('burn xu3lp tokens from user', async () => {
      let mintAmount = 1000000;
      let burnAmount = 100000;
      await xU3LP.connect(user).mintWithToken(0, mintAmount);

      await xU3LP.connect(user).burn(0, burnAmount);
      
      let feeDivisors = await xU3LP.feeDivisors();
      let mintFee = feeDivisors.mintFee;

      let balance = await getXU3LPBalance(xU3LP, user.address);
      let amountWithoutFees = new Number(
                          ((mintAmount - (mintAmount / mintFee)) -
                          (burnAmount))).toFixed(0);
      const nav = await xU3LP.getNav();
      const totalSupply = await xU3LP.totalSupply();
      let calculatedBalance = bn(amountWithoutFees).mul(nav).div(totalSupply).toNumber();

      // math operations in solidity (rounded down) vs ethersjs bignumber difference (rounded up)
      calculatedBalance -= 1;

      assert(balance.toNumber() == calculatedBalance)
    })
  })
})
