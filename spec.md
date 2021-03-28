# xU3LPStable Spec
This contract is designed to work for any stable Uniswap V3 pair. Our current intention is to launch with:

- xU3LPa: USDC<=>DAI 0.997-1.003
- xU3LPb: USDC<=>USDT 0.997-1.003
- xU3LPc: USDC<=>sUSD 0.995-1.005
- xU3LPd: WETH<=>sETH 0.995-1.005
- xU3LPe: WBTC<=>sBTC 0.995-1.005

> We can do a historical analysis of these markets to determine the most capital-efficient ranges

## Users
- `mintWithToken(uint8 depositAsset, uint256 amount)`

    - user deposits `asset0` or `asset1`. We don't require them to deposit both assets
    - `calculateMintAmount` determines how many xU3LP tokens to mint to user, depending on their contribution to NAV

- `burn(uint8 withdrawAsset, uint256 amount)`
    - users redeems xU3LP for `withdrawAsset` of their choice

## Fund Management

When users deposit an asset to the pool, we mint them xU3LP but in order to minimize gas requirements and simplify UX, we don't automatically deposit to the liquidity pool. This would require gas for an exchange into the pair asset and then more gas for the liquidity provision. 

Instead, we (xToken) submit a `rebalance` tx regularly (maybe daily or 5x per week) to offload management costs from users. We target 5% of NAV liquid in the contract and deposit the remaining 95% into the liquidity pools. We maintain that 5% buffer to provide exit liquidity. There is also a public `rebalance` function that anyone can call to restore the 5% buffer (if a large redemption comes in and wipes out the buffer, there needs to be a path for others to obtain exit liquidity without admin intervention).

There is also a public `collect` function that claims fees from the pool. 


## NAV
What's the best way to calculate NAV? We need a NAV calculation in order to determine how much xU3LP to mint to a new investor or to determine how much of `asset0` or `asset1` to pay out on redemption.

Since we're only working with stable, highly liquid assets, we may be able to just assume that the assets are equivalent. There will be slight deviations but the 0.1% mint/burn fees should preclude any arbitrage in the vast majority of cases.

That said, there is potential for temporary dislocations and therefore arbitrage (value leakage out of xU3LP), so we may have to find a way to read the Uniswap oracle accumulator (and/or liquidity accumulator) and calculate NAV based off common terms. 

In this case, the NAV calculation would be:


```
  Qty of `asset0` deployed to pool
+ Qty of `asset1` deployed to pool * asset1PriceInAsset0Terms
+ Buffer balance qty of `asset0`
+ Buffer balance qty of `asset1` * asset1PriceInAsset0Terms
= xU3LP NAV
```

In this design, we would also need to figure out how to read the Uniswap Pool contract for the current composition of the contract's position. If our position is 990 USDC and 1010 DAI because the stable pair is slightly off target, we need to know that for our NAV calculation. 
