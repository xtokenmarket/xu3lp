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
import '@uniswap/v3-periphery/contracts/interfaces/INonfungiblePositionManager.sol';
import '@uniswap/v3-periphery/contracts/libraries/LiquidityAmounts.sol';

import 'hardhat/console.sol';


contract xU3LPStable is Initializable, ERC20Upgradeable, OwnableUpgradeable, PausableUpgradeable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    uint256 private constant LIQUIDATION_TIME_PERIOD = 4 weeks;
    uint256 private constant INITIAL_SUPPLY_MULTIPLIER = 1;
    uint256 private constant BUFFER_TARGET = 20; // 5% target
    uint256 private constant SWAP_TIMEOUT = 100;
    uint256 private constant SWAP_SLIPPAGE = 100; // 1%
    uint256 private constant MINT_BURN_TIMEOUT = 1000;
    uint256 private constant MINT_BURN_SLIPPAGE = 1000;
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
    INonfungiblePositionManager positionManager;

    uint256 public adminActiveTimestamp;
    uint256 public withdrawableToken0Fees;
    uint256 public withdrawableToken1Fees;
    uint256 public tokenId; // token id representing this uniswap position

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
        IERC20 _stablecoin0,
        IERC20 _stablecoin1,
        IUniswapV3Pool _pool,
        ISwapRouter _router,
        INonfungiblePositionManager _positionManager,
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
        priceLower = TickMath.getSqrtRatioAtTick(_tickLower);
        priceUpper = TickMath.getSqrtRatioAtTick(_tickUpper);
        token0 = _stablecoin0;
        token1 = _stablecoin1;
        pool = _pool;
        router = _router;
        positionManager = _positionManager;

        token0.safeIncreaseAllowance(address(router), type(uint256).max);
        token1.safeIncreaseAllowance(address(router), type(uint256).max);
        token0.safeIncreaseAllowance(address(positionManager), type(uint256).max);
        token1.safeIncreaseAllowance(address(positionManager), type(uint256).max);

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
        uint256 bufferBalance = getBufferBalance();
        uint256 stakedBalance = getStakedBalance();
        uint256 totalBalance = bufferBalance.add(stakedBalance);

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
        transferOnBurn(outputAsset, transferAmount);
    }


    // Get net asset value priced in terms of asset0
    function getNav() public view returns(uint256) {
        return getStakedBalance().add(getBufferBalance());
    }

    function getToken1Price() public pure returns(uint256){
        return 1;
    }

    // Get total balance in the pool
    function getStakedBalance() public view returns (uint256) {
        (,,,,,,, uint128 liquidity ,,,,) = positionManager.positions(tokenId);
        uint160 price = getPoolPrice();
        (uint256 amount0, uint256 amount1) = 
            LiquidityAmounts.getAmountsForLiquidity(price, priceLower, priceUpper, liquidity);
        return amount0.add(amount1.mul(getToken1Price()));
    }

    // Get balance in xU3LP contract
    function getBufferBalance() public view returns (uint256) {
        int256 balance0 = int256(token0.balanceOf(address(this))) - int256(withdrawableToken0Fees);
        int256 balance1 = int256(token1.balanceOf(address(this))) - int256(withdrawableToken1Fees);
        if(balance0 < 0) balance0 = 0;
        if(balance1 < 0) balance1 = 0;
        return uint256(balance0).add(uint256(balance1).mul(getToken1Price()));
    }

    function getTargetBufferBalance() public view returns (uint256) {
        return getNav().div(BUFFER_TARGET);
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
        uint256 targetBalance = getTargetBufferBalance();

        if (bufferBalance > targetBalance) {
            uint256 amount = bufferBalance.sub(targetBalance);
            uint256 amount0 = amount.div(1 + getToken1Price());
            uint256 amount1 = amount0.mul(getToken1Price());
            _stake(amount0, amount1);
        } else if (bufferBalance < targetBalance) {
            uint256 amount = targetBalance.sub(bufferBalance);
            uint256 amount0 = amount.div(1 + getToken1Price());
            uint256 amount1 = amount0.mul(getToken1Price());
            _unstake(amount0, amount1);
        }
    }

    // TODO: Handle cases when balances minted are different from requested
    function _stake(uint256 amount0, uint256 amount1) private {
        require(amount0 > 0 || amount1 > 0, "Cannot stake without sending tokens");
        positionManager.increaseLiquidity(
            tokenId,
            amount0,
            amount1,
            amount0.sub(amount0.div(MINT_BURN_SLIPPAGE)),
            amount1.sub(amount1.div(MINT_BURN_SLIPPAGE)),
            block.timestamp.add(MINT_BURN_TIMEOUT)
        );
    }

    // TODO: Handle cases when balances burnt are different from requested
    function _unstake(uint256 amount0, uint256 amount1) private {
        uint160 price = getPoolPrice();
        uint128 liquidityAmount = LiquidityAmounts.getLiquidityForAmounts(
            price,
            priceLower,
            priceUpper,
            amount0.add(amount0.div(MINT_BURN_SLIPPAGE)),
            amount1.add(amount1.div(MINT_BURN_SLIPPAGE))
        );
        (uint256 _amount0, uint256 _amount1) = positionManager.decreaseLiquidity(
            tokenId,
            liquidityAmount,
            amount0,
            amount1,
            block.timestamp.add(MINT_BURN_TIMEOUT)
        );
        positionManager.collect(tokenId, address(this), uint128(_amount0), uint128(_amount1));
    }

    // Collect fees
    function _collect() private {
        uint128 requestAmount0 = type(uint128).max;
        uint128 requestAmount1 = type(uint128).max;

        (uint256 collected0, uint256 collected1) = positionManager.collect(
            tokenId,
            address(this),
            requestAmount0,
            requestAmount1
        );

        uint256 fee0 = _calculateFee(collected0, feeDivisors.claimFee);
        uint256 fee1 = _calculateFee(collected1, feeDivisors.claimFee);
        _incrementWithdrawableToken0Fees(fee0);
        _incrementWithdrawableToken1Fees(fee1);
    }

    /**
     * Mint function which initializes the pool position
     * Must be called before any liquidity can be deposited
     */
    function mintInitial(uint256 amount0, uint256 amount1) external onlyOwner {
        require(amount0 > 0 || amount1 > 0, "Cannot mint without sending tokens");
        if (amount0 > 0) {
            token0.transferFrom(msg.sender, address(this), amount0);
        }
        if (amount1 > 0) {
            token1.transferFrom(msg.sender, address(this), amount1);
        }
        (uint256 _tokenId,,,) = 
        positionManager.mint(INonfungiblePositionManager.MintParams({
            token0: address(token0),
            token1: address(token1),
            fee: POOL_FEE,
            tickLower: tickLower,
            tickUpper: tickUpper,
            amount0Desired: amount0,
            amount1Desired: amount1,
            amount0Min: amount0.sub(amount0.div(100)),
            amount1Min: amount1.sub(amount1.div(100)),
            recipient: address(this),
            deadline: block.timestamp.add(MINT_BURN_TIMEOUT)
        }));
        tokenId = _tokenId;
        _mintInternal(amount0.add(amount1.mul(getToken1Price())));
    }

    /**
     * Transfers asset amount when user calls burn() 
     * If there's not enough balance of that asset, 
     * triggers a Uniswap router swap to increase the balance
     */
    function transferOnBurn(uint8 outputAsset, uint256 transferAmount) private {
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

    // Returns the current pool price
    function getPoolPrice() private view returns (uint160) {
        (uint160 sqrtRatioX96,,,,,,) = pool.slot0();
        return sqrtRatioX96;
    }
}