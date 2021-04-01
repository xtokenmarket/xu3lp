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
        IUniswapV3Pool _pool,
        uint256 _mintFeeDivisor,
        uint256 _burnFeeDivisor,
        uint256 _claimFeeDivisor
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

        _setFeeDivisors(_mintFeeDivisor, _burnFeeDivisor, _claimFeeDivisor);
    }

    /* ========================================================================================= */
    /*                                            User-facing                                    */
    /* ========================================================================================= */

    function mintWithToken(uint8 inputAsset, uint256 amount) external {
        require(amount > 0, 'Must send token');
        // calculate current NAV in price terms of asset0 (getNav())
        if(inputAsset == 0){
            // transfer asset0 into wallet
            // charge fee
            // mint xU3LP with asset0 proportionally to calculated NAV
        } else {
            // transfer asset1 into wallet
            // charge fee
            // calculate asset1 contribution in terms of asset0
            // mint xU3LP proportionally to contribution to calculated NAV
        }
    }

    function burn(uint8 outputAsset, uint256 xu3lpAmount) external {
        require(amount > 0, 'Must redeem token');
        // calculate proRata amount in outputAsset terms based on current NAV
        // confirm that bufferBalance is sufficient to meet redemption obligation
        // if not sufficient, tx fails
        // charge fee
        // _burn(xu3lpAmount)
        // exchange buffer bal into desired outputAsset if contract doesn't hold (for ex, if user requests usdc, but remaining buffer bal only holds dai, convert dai=>usdc)

    }



    // priced in terms of asset0
    function getNav() public view returns(uint256) {
        //   asset0BufferBalance
        // + asset1BufferBalance in price terms of asset0
        // + asset0DepositedLiquidity
        // + asset1DepositedLiquidity in price terms of asset0
    }

    function getStablecoin1PriceInStablecoin0Terms() public view returns(uint256){
        // something like this to rationalize prices
    }

    /* ========================================================================================= */
    /*                                            Management                                     */
    /* ========================================================================================= */

    function rebalance() external onlyOwnerOrManager {
        _collect();
        _rebalance();
        _certifyAdmin();
    }

    function _rebalance() private {
        _provideOrRemoveLiquidity();
    }

    function _provideOrRemoveLiquidity() private {
        // calculate current composition of NAV of fund 
        // we target 5% of capital unlocked/liquid (asset0BufferBalance+asset1BufferBalance)
        // if we're above target, provide the excess amount as liquidity on the pair (you may need to exchange asset0 for asset1 or vice versa to obtain the correct ratio of assets for LPing)
        // if we're below target, remove liquidity to restore the 5% ratio
    }

    function _collect() private {
        // collect fees
        // charge fees at claimFeeDivisor rate
    }
}