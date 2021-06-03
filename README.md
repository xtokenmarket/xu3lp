# xU3LP: Convenient Liquidity Provision for Uniswap V3

# Description
This repository contains the core smart contracts for xU3LP.  
xU3LP is a set-and-forget solution for liquidity provision on select Uniswap V3 pairs.   
Investors can deposit either asset in a pair and passively earn income while benefitting from a fungible, yield-generating token (xU3LP) that can be used anywhere in the DeFi ecosystem.

# Tokens on mainnet  
xU3LPa (DAI - USDC, 0.9994 - 1.0014):  
0xda4d2152b2230e33c80b0a88b7c28b1c464ee3c2

xU3LPb (USDC - USDT, 0.999 - 1.001):  
0x420CF01fdC7e3c42c3D89ae8799bACCBfFa9ceAA

xU3LPc (sUSD - USDC, 0.9974 - 1.0054):  
0x74e87fba6c4bcd17fe5f14d73f590ed3c13e821b

# Instructions
--- Run **npm i** beforehand ---  
--- Set .env as in env.example ---  

To compile:  
**npx hardhat compile**  
To run tests:  
**npx hardhat test**  
To deploy implementation to mainnet:  
**npx hardhat run scripts/mainnet/deployImplementation --network mainnet**  

# Licensing
The primary license for xU3LP is the Business Source License 1.1 (BUSL-1.1), see LICENSE.