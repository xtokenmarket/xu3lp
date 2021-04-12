pragma solidity ^0.7.6;
pragma abicoder v2;

import "@openzeppelin/contracts-upgradeable/proxy/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import "@uniswap/v3-core/contracts/interfaces/callback/IUniswapV3MintCallback.sol";
import "@uniswap/v3-core/contracts/libraries/TickMath.sol";

import '@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol';
import '@uniswap/v3-periphery/contracts/libraries/LiquidityAmounts.sol';

contract xU3LPStable is Initializable, ERC20Upgradeable, OwnableUpgradeable, PausableUpgradeable, IUniswapV3MintCallback {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    uint256 private constant LIQUIDATION_TIME_PERIOD = 4 weeks;
    uint256 private constant INITIAL_SUPPLY_MULTIPLIER = 1;
    uint256 private constant BUFFER_TARGET = 20; // 5% target
    uint256 private constant SWAP_TIMEOUT = 100;
    uint256 private constant SWAP_SLIPPAGE = 100; // 1%
    uint24 private constant POOL_FEE = 500;

    int24 tickLower;
    int24 tickUpper;

    // Prices calculated using above ticks from TickMath.getSqrtRatioAtTick()
    uint160 priceLower;
    uint160 priceUpper;

    IERC20 token0;
    IERC20 token1;

    IUniswapV3Pool pool;
    ISwapRouter router;

    uint256 public adminActiveTimestamp;
    uint256 public withdrawableToken0Fees;
    uint256 public withdrawableToken1Fees;

    struct FeeDivisors {
        uint256 mintFee;
        uint256 burnFee;
        uint256 claimFee;
    }

    FeeDivisors public feeDivisors;

    event Rebalance();
    event FeeDivisorsSet(uint256 mintFee, uint256 burnFee, uint256 claimFee);

    function initialize(
        string memory _symbol,
        int24 _tickLower,
        int24 _tickUpper,
        uint160 _priceLower,
        uint160 _priceUpper,
        IERC20 _stablecoin0,
        IERC20 _stablecoin1,
        IUniswapV3Pool _pool,
        ISwapRouter _router,
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
        priceLower = _priceLower;
        priceUpper = _priceUpper;
        token0 = _stablecoin0;
        token1 = _stablecoin1;
        pool = _pool;
        router = _router;

        token0.safeIncreaseAllowance(address(router), type(uint256).max);
        token1.safeIncreaseAllowance(address(router), type(uint256).max);

        _setFeeDivisors(_mintFeeDivisor, _burnFeeDivisor, _claimFeeDivisor);
    }

    /* ========================================================================================= */
    /*                                            User-facing                                    */
    /* ========================================================================================= */

    function mintWithToken(uint8 inputAsset, uint256 amount) external {
        require(amount > 0, 'Must send token');
        uint256 fee;
        if(inputAsset == 0) {
            token0.safeTransferFrom(msg.sender, address(this), amount);
            fee = _calculateFee(amount, feeDivisors.mintFee);
            _mintInternal(amount.sub(fee));
            _incrementWithdrawableToken0Fees(fee);
        } else {
            token1.safeTransferFrom(msg.sender, address(this), amount);
            fee = _calculateFee(amount, feeDivisors.mintFee);
            _mintInternal(amount.mul(getToken1Price()).sub(fee));
            _incrementWithdrawableToken1Fees(fee);
        }
    }

    function burn(uint8 outputAsset, uint256 amount) external {
        require(amount > 0, 'Must redeem token');
        uint256 stakedBalance = getStakedBalance();
        uint256 bufferBalance = getBufferBalance();
        uint256 totalBalance = stakedBalance.add(bufferBalance);

        uint256 proRataBalance;
        if(outputAsset == 0) {
            proRataBalance = (totalBalance.mul(amount)).div(totalSupply());
        } else {
            proRataBalance = (totalBalance
                            .mul(amount
                            .div(getToken1Price())))
                            .div(totalSupply());
        }

        require(proRataBalance <= bufferBalance, "Insufficient exit liquidity");
        super._burn(msg.sender, amount);

        uint256 fee = _calculateFee(proRataBalance, feeDivisors.burnFee);
        if(outputAsset == 0) {
            _incrementWithdrawableToken0Fees(fee);
        } else {
            _incrementWithdrawableToken1Fees(fee);
        }
        uint256 transferAmount = proRataBalance.sub(fee);
        if(outputAsset == 0) {
            uint256 balance0 = token0.balanceOf(address(this))
                                        .sub(withdrawableToken0Fees);
            
            if(balance0 < transferAmount) {
                // amounts could be changed to balance the tokens
                uint256 amountIn = transferAmount.add(transferAmount.div(SWAP_SLIPPAGE)).sub(balance0);
                uint256 amountOut = transferAmount.add(1).sub(balance0);
                swapToken1ForToken0(amountIn, amountOut);
            }
            token0.safeTransfer(msg.sender, transferAmount);
        } else {
            uint256 balance1 = token1.balanceOf(address(this))
                                        .sub(withdrawableToken1Fees);

            if(balance1 < transferAmount) {
                uint256 amountIn = transferAmount.add(transferAmount.div(SWAP_SLIPPAGE)).sub(balance1);
                uint256 amountOut = transferAmount.add(1).sub(balance1);
                swapToken0ForToken1(amountIn, amountOut);
            }
            token1.safeTransfer(msg.sender, transferAmount);
        }
    }


    // priced in terms of asset0
    function getNav() public view returns(uint256) {
        return getStakedBalance().add(getBufferBalance());
    }

    function getToken1Price() public pure returns(uint256){
        return 1;
    }

    // Get balance in the pool
    function getStakedBalance() public view returns (uint256) {
        uint256 balance0 = token0.balanceOf(address(pool));
        uint256 balance1 = token1.balanceOf(address(pool));
        return balance0.add(balance1.mul(getToken1Price()));
    }

    // Get balance in xU3LP contract
    function getBufferBalance() public view returns (uint256) {
        uint256 balance0 = (token0.balanceOf(address(this))).sub(withdrawableToken0Fees);
        uint256 balance1 = (token1.balanceOf(address(this))).sub(withdrawableToken1Fees);
        return balance0.add(balance1.mul(getToken1Price()));
    }

    // Check how much xU3LP tokens will be minted
    function calculateMintAmount(
        uint256 _amount,
        uint256 totalSupply
    ) public view returns (uint256 mintAmount) {
        if (totalSupply == 0)
            return _amount.mul(INITIAL_SUPPLY_MULTIPLIER);
        uint256 previousNav = getNav().sub(_amount);
        mintAmount = (_amount).mul(totalSupply).div(previousNav);
        return mintAmount;
    }

    /* ========================================================================================= */
    /*                                            Management                                     */
    /* ========================================================================================= */

    function rebalance() external onlyOwner {
        _collect();
        _rebalance();
        _certifyAdmin();
    }

    function _rebalance() private {
        _provideOrRemoveLiquidity();
    }

    function _provideOrRemoveLiquidity() private {
        uint256 bufferBalance = getBufferBalance();
        uint256 stakedBalance = getStakedBalance();
        uint256 targetBalance = bufferBalance.add(stakedBalance).div(BUFFER_TARGET);

        if (bufferBalance > targetBalance) {
            uint256 amount = bufferBalance.sub(targetBalance);
            uint256 amount0 = amount.div(1 + getToken1Price());
            uint256 amount1 = amount0.mul(getToken1Price());
            _stake(amount0, amount1);
        } else {
            uint256 amount = targetBalance.sub(bufferBalance);
            uint256 amount0 = amount.div(1 + getToken1Price());
            uint256 amount1 = amount0.mul(getToken1Price());
            _unstake(amount0, amount1);
        }
    }

    // TODO: Handle cases when balances minted are different from requested
    function _stake(uint256 _amount0, uint256 _amount1) private {
        uint160 price = getPoolPrice();
        uint128 liquidityAmount = LiquidityAmounts.getLiquidityForAmounts(
            price,
            priceLower,
            priceUpper,
            _amount0,
            _amount1
        );

        pool.mint(
            address(this),
            tickLower,
            tickUpper,
            liquidityAmount,
            abi.encode(msg.sender)
        );
    }

    // TODO: Handle cases when balances burnt are different from requested
    function _unstake(uint256 _amount0, uint256 _amount1) private {
        uint160 price = getPoolPrice();
        uint128 liquidityAmount = LiquidityAmounts.getLiquidityForAmounts(
            price,
            priceLower,
            priceUpper,
            _amount0,
            _amount1
        );

        (uint256 amount0, uint256 amount1) = pool.burn(
            tickLower,
            tickUpper,
            liquidityAmount
        );

        pool.collect(
            address(this),
            tickLower,
            tickUpper,
            uint128(amount0),
            uint128(amount1)
        );
    }

    // Collect fees
    function _collect() private {
        uint128 requestAmount0 = type(uint128).max;
        uint128 requestAmount1 = type(uint128).max;

        (uint256 collected0, uint256 collected1) = pool.collect(
            address(this),
            tickLower,
            tickUpper,
            requestAmount0,
            requestAmount1
        );

        uint256 fee0 = _calculateFee(collected0, feeDivisors.claimFee);
        uint256 fee1 = _calculateFee(collected1, feeDivisors.claimFee);
        _incrementWithdrawableToken0Fees(fee0);
        _incrementWithdrawableToken1Fees(fee1);
    }

    /*
     * @notice Registers that admin is present and active
     * @notice If admin isn't certified within liquidation time period,
     * emergencyUnstake function becomes callable
     */
    function _certifyAdmin() private {
        adminActiveTimestamp = block.timestamp;
    }

    /*
     * @dev Public callable function for unstaking in event of admin failure/incapacitation
     */
    function emergencyUnstake(uint256 _amount0, uint256 _amount1) external {
        require(
            adminActiveTimestamp.add(LIQUIDATION_TIME_PERIOD) < block.timestamp,
            "Liquidation time not elapsed"
        );
        _unstake(_amount0, _amount1);
    }

    function _mintInternal(uint256 _amount) private {
        uint256 mintAmount =
            calculateMintAmount(_amount, totalSupply());

        return super._mint(msg.sender, mintAmount);
    }

    function _calculateFee(uint256 _value, uint256 _feeDivisor)
        internal
        pure
        returns (uint256 fee)
    {
        if (_feeDivisor > 0) {
            fee = _value.div(_feeDivisor);
        }
    }

    function _incrementWithdrawableToken0Fees(uint256 _feeAmount) private {
        withdrawableToken0Fees = withdrawableToken0Fees.add(_feeAmount);
    }

    function _incrementWithdrawableToken1Fees(uint256 _feeAmount) private {
        withdrawableToken1Fees = withdrawableToken1Fees.add(_feeAmount);
    }

    /*
     * @notice Inverse of fee i.e., a fee divisor of 100 == 1%
     * @notice Three fee types
     * @dev Mint fee 0 or <= 2%
     * @dev Burn fee 0 or <= 1%
     * @dev Claim fee 0 <= 4%
     */
    function setFeeDivisors(
        uint256 mintFeeDivisor,
        uint256 burnFeeDivisor,
        uint256 claimFeeDivisor
    ) public onlyOwner {
        _setFeeDivisors(mintFeeDivisor, burnFeeDivisor, claimFeeDivisor);
    }

    function _setFeeDivisors(
        uint256 _mintFeeDivisor,
        uint256 _burnFeeDivisor,
        uint256 _claimFeeDivisor
    ) private {
        require(_mintFeeDivisor == 0 || _mintFeeDivisor >= 50, "Invalid fee");
        require(_burnFeeDivisor == 0 || _burnFeeDivisor >= 100, "Invalid fee");
        require(_claimFeeDivisor >= 25, "Invalid fee");
        feeDivisors.mintFee = _mintFeeDivisor;
        feeDivisors.burnFee = _burnFeeDivisor;
        feeDivisors.claimFee = _claimFeeDivisor;

        emit FeeDivisorsSet(_mintFeeDivisor, _burnFeeDivisor, _claimFeeDivisor);
    }


    /* ========================================================================================= */
    /*                                       Uniswap helpers                                     */
    /* ========================================================================================= */

    function swapToken0ForToken1(uint256 amountIn, uint256 amountOut) private {
        router.exactOutputSingle(ISwapRouter.ExactOutputSingleParams({
            tokenIn: address(token0),
            tokenOut: address(token1),
            fee: POOL_FEE,
            recipient: address(this),
            deadline: block.timestamp.add(SWAP_TIMEOUT),
            amountOut: amountOut,
            amountInMaximum: amountIn,
            sqrtPriceLimitX96: priceLower
        }));
    }

    function swapToken1ForToken0(uint256 amountIn, uint256 amountOut) private {
        router.exactOutputSingle(ISwapRouter.ExactOutputSingleParams({
            tokenIn: address(token1),
            tokenOut: address(token0),
            fee: POOL_FEE,
            recipient: address(this),
            deadline: block.timestamp.add(SWAP_TIMEOUT),
            amountOut: amountOut,
            amountInMaximum: amountIn,
            sqrtPriceLimitX96: priceUpper
        }));
    }

    function getPoolPrice() private view returns (uint160) {
        (uint160 sqrtRatioX96,,,,,,) = pool.slot0();
        return sqrtRatioX96;
    }

    function uniswapV3MintCallback(
        uint256 amount0Owed,
        uint256 amount1Owed,
        bytes calldata /*data*/
    ) external override {
        require(msg.sender == address(pool));

        if (amount0Owed > 0) {
            token0.safeTransfer(msg.sender, amount0Owed);
        }
        if (amount1Owed > 0) {
            token1.safeTransfer(msg.sender, amount1Owed);
        }
    }
}