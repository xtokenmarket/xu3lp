# xU3LP: Convenient Liquidity Provision for Uniswap V3

# Description
This repository contains the core smart contracts for xU3LP.  
xU3LP is a set-and-forget solution for liquidity provision on select Uniswap V3 pairs.   
Investors can deposit either asset in a pair and passively earn income while benefitting from a fungible, yield-generating token (xU3LP) that can be used anywhere in the DeFi ecosystem.


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
