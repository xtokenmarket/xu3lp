pragma solidity 0.7.6;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract USDC is ERC20 {
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {
        _setupDecimals(6);
        _mint(msg.sender, 1000000000000000 * 10**uint256(decimals()));
    }
}
