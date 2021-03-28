pragma solidity 0.7.3;

import "@openzeppelin/contracts-upgradeable/proxy/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./IUniswapV3Pool.sol";

contract xU3LPStable is Initializable, ERC20Upgradeable, OwnableUpgradeable, PausableUpgradeable {
    using SafeMath for uint256;

    int24 tickLower;
    int24 tickUpper;

    IERC20 stablecoin0;
    IERC20 stablecoin1;

    IUniswapV3Pool pool;

    function initialize(
        string _symbol,
        int24 _tickLower,
        int24 _tickUpper,
        IERC20 _stablecoin0,
        IERC20 _stablecoin1,
        IUniswapV3Pool _pool
    ) external initializer {
        __Context_init_unchained();
        __Ownable_init_unchained();
        __Pausable_init_unchained();
        __ERC20_init_unchained("xU3LP", _symbol);

        tickLower = _tickLower;
        tickUpper = _tickUpper;
        stablecoin0 = _stablecoin0;
        stablecoin1 = _stablecoin1;
        pool = _pool;
    }

    function mintWithToken(uint8 asset, uint256 amount) external {
        require(amount > 0, 'Must send token');

    }

    function getNav() public view returns(uint256) {
        
    }

    function getStablecoin1PriceInStablecoin0Terms() public view returns(uint256){
        // 
    }

    function rebalance() external {

    }
}