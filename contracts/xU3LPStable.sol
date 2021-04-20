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

import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "@uniswap/v3-periphery/contracts/interfaces/INonfungiblePositionManager.sol";
import "@uniswap/v3-periphery/contracts/libraries/LiquidityAmounts.sol";

import "./ABDKMath64x64.sol";
import "./TimeLock.sol";

contract xU3LPStable is
    Initializable,
    ERC20Upgradeable,
    OwnableUpgradeable,
    PausableUpgradeable,
    TimeLock
{
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    uint256 private constant LIQUIDATION_TIME_PERIOD = 4 weeks;
    uint256 private constant INITIAL_SUPPLY_MULTIPLIER = 1;
    uint256 private constant BUFFER_TARGET = 20; // 5% target
    uint256 private constant SWAP_TIMEOUT = 100;
    uint256 private constant SWAP_SLIPPAGE = 100; // 1%
    uint256 private constant MINT_BURN_TIMEOUT = 1000;
    uint256 private constant MINT_BURN_SLIPPAGE = 100; // 1%
    uint256 private constant TOKEN_0_DECIMALS = 10**18;
    uint256 private constant TOKEN_1_DECIMALS = 10**18;
    uint32 private constant TWAP_SECONDS = 3600; // How many seconds ago to check twap
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
        IERC20 _token0,
        IERC20 _token1,
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
        token0 = _token0;
        token1 = _token1;
        pool = _pool;
        router = _router;
        positionManager = _positionManager;

        token0.safeIncreaseAllowance(address(router), type(uint256).max);
        token1.safeIncreaseAllowance(address(router), type(uint256).max);
        token0.safeIncreaseAllowance(
            address(positionManager),
            type(uint256).max
        );
        token1.safeIncreaseAllowance(
            address(positionManager),
            type(uint256).max
        );

        _setFeeDivisors(_mintFeeDivisor, _burnFeeDivisor, _claimFeeDivisor);
    }

    /* ========================================================================================= */
    /*                                            User-facing                                    */
    /* ========================================================================================= */

    function mintWithToken(uint8 inputAsset, uint256 amount)
        external
        notLocked()
    {
        require(amount > 0, "Must send token");
        uint256 fee;
        if (inputAsset == 0) {
            token0.safeTransferFrom(msg.sender, address(this), amount);
            fee = _calculateFee(amount, feeDivisors.mintFee);
            _mintInternal(amount.sub(fee));
            _incrementWithdrawableToken0Fees(fee);
        } else {
            token1.safeTransferFrom(msg.sender, address(this), amount);
            fee = _calculateFee(amount, feeDivisors.mintFee);
            _mintInternal(getAmountInAsset0Terms(amount).sub(fee));
            _incrementWithdrawableToken1Fees(fee);
        }
    }

    function burn(uint8 outputAsset, uint256 amount) external notLocked() {
        require(amount > 0, "Must redeem token");
        uint256 bufferBalance = getBufferBalance();
        uint256 stakedBalance = getStakedBalance();
        uint256 totalBalance = bufferBalance.add(stakedBalance);

        uint256 proRataBalance;
        if (outputAsset == 0) {
            proRataBalance = (totalBalance.mul(amount)).div(totalSupply());
        } else {
            proRataBalance = (
                totalBalance.mul(getAmountInAsset1Terms(amount)).div(
                    totalSupply()
                )
            );
        }

        // Add swap slippage to the calculations
        uint256 proRataBalanceWithSlippage =
            proRataBalance.add(proRataBalance.div(SWAP_SLIPPAGE));

        require(
            proRataBalanceWithSlippage <= bufferBalance,
            "Insufficient exit liquidity"
        );
        super._burn(msg.sender, amount);

        uint256 fee = _calculateFee(proRataBalance, feeDivisors.burnFee);
        if (outputAsset == 0) {
            _incrementWithdrawableToken0Fees(fee);
        } else {
            _incrementWithdrawableToken1Fees(fee);
        }
        uint256 transferAmount = proRataBalance.sub(fee);
        transferOnBurn(outputAsset, transferAmount);
    }

    function transfer(address recipient, uint256 amount)
        public
        override
        notLocked()
        returns (bool)
    {
        return super.transfer(recipient, amount);
    }

    // Get net asset value priced in terms of asset0
    function getNav() public view returns (uint256) {
        return getStakedBalance().add(getBufferBalance());
    }

    // Get asset 1 twap price for the period of [now - TWAP_SECONDS, now]
    function getAsset1Price() public view returns (int128) {
        return ABDKMath64x64.inv(getAsset0Price());
    }

    // Returns amount in terms of asset0
    function getAmountInAsset0Terms(uint256 amount)
        public
        view
        returns (uint256)
    {
        return ABDKMath64x64.mulu(getAsset1Price(), amount);
    }

    // Returns amount in terms of asset1
    function getAmountInAsset1Terms(uint256 amount)
        public
        view
        returns (uint256)
    {
        return ABDKMath64x64.mulu(getAsset0Price(), amount);
    }

    // Get total balance in the pool
    function getStakedBalance() public view returns (uint256) {
        (, , , , , , , uint128 liquidity, , , , ) =
            positionManager.positions(tokenId);
        uint160 price = getPoolPrice();
        (uint256 amount0, uint256 amount1) =
            LiquidityAmounts.getAmountsForLiquidity(
                price,
                priceLower,
                priceUpper,
                liquidity
            );
        return amount0.add(getAmountInAsset0Terms(amount1));
    }

    // Get balance in xU3LP contract
    function getBufferBalance() public view returns (uint256) {
        int256 balance0 =
            int256(token0.balanceOf(address(this))) -
                int256(withdrawableToken0Fees);
        int256 balance1 =
            int256(token1.balanceOf(address(this))) -
                int256(withdrawableToken1Fees);
        if (balance0 < 0) balance0 = 0;
        if (balance1 < 0) balance1 = 0;
        return uint256(balance0).add(getAmountInAsset0Terms(uint256(balance1)));
    }

    // Get wanted xU3LP contract balance - 5% of NAV
    function getTargetBufferBalance() public view returns (uint256) {
        return getNav().div(BUFFER_TARGET);
    }

    // Get token balances in xU3LP contract
    function getBufferTokenBalance()
        public
        view
        returns (uint256 amount0, uint256 amount1)
    {
        int256 balance0 =
            int256(token0.balanceOf(address(this))) -
                int256(withdrawableToken0Fees);
        int256 balance1 =
            int256(token1.balanceOf(address(this))) -
                int256(withdrawableToken1Fees);
        if (balance0 < 0) balance0 = 0;
        if (balance1 < 0) balance1 = 0;
        amount0 = uint256(balance0);
        amount1 = uint256(balance1);
    }

    // Get token balances in the pool
    function getPoolTokenBalance()
        public
        view
        returns (uint256 amount0, uint256 amount1)
    {
        (, , , , , , , uint128 liquidity, , , , ) =
            positionManager.positions(tokenId);
        uint160 price = getPoolPrice();
        (amount0, amount1) = LiquidityAmounts.getAmountsForLiquidity(
            price,
            priceLower,
            priceUpper,
            liquidity
        );
    }

    // Get wanted xU3LP contract token balance - 5% of NAV
    function getTargetBufferTokenBalance()
        public
        view
        returns (uint256 amount0, uint256 amount1)
    {
        (uint256 bufferAmount0, uint256 bufferAmount1) =
            getBufferTokenBalance();
        (uint256 poolAmount0, uint256 poolAmount1) = getPoolTokenBalance();
        amount0 = bufferAmount0.add(poolAmount0).div(BUFFER_TARGET);
        amount1 = bufferAmount1.add(poolAmount1).div(BUFFER_TARGET);
    }

    // Check how much xU3LP tokens will be minted
    function calculateMintAmount(uint256 _amount, uint256 totalSupply)
        public
        view
        returns (uint256 mintAmount)
    {
        if (totalSupply == 0) return _amount.mul(INITIAL_SUPPLY_MULTIPLIER);
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
        (uint256 bufferToken0Balance, uint256 bufferToken1Balance) =
            getBufferTokenBalance();
        (uint256 targetToken0Balance, uint256 targetToken1Balance) =
            getTargetBufferTokenBalance();

        uint256 _amount0 = subAbs(bufferToken0Balance, targetToken0Balance);
        uint256 _amount1 = subAbs(bufferToken1Balance, targetToken1Balance);
        (uint256 amount0, uint256 amount1) =
            checkIfAmountsMatchAndSwap(_amount0, _amount1);

        if (bufferBalance > targetBalance) {
            _stake(amount0, amount1);
        } else if (bufferBalance < targetBalance) {
            _unstake(amount0, amount1);
        }
    }

    function _stake(uint256 amount0, uint256 amount1) private {
        positionManager.increaseLiquidity(
            tokenId,
            amount0,
            amount1,
            amount0.sub(amount0.div(MINT_BURN_SLIPPAGE)),
            amount1.sub(amount1.div(MINT_BURN_SLIPPAGE)),
            block.timestamp.add(MINT_BURN_TIMEOUT)
        );
    }

    function _unstake(uint256 amount0, uint256 amount1) private {
        uint160 price = getPoolPrice();
        uint128 liquidityAmount =
            LiquidityAmounts.getLiquidityForAmounts(
                price,
                priceLower,
                priceUpper,
                amount0,
                amount1
            );
        (uint256 _amount0, uint256 _amount1) =
            positionManager.decreaseLiquidity(
                tokenId,
                liquidityAmount,
                amount0.sub(amount0.div(MINT_BURN_SLIPPAGE)),
                amount1.sub(amount0.div(MINT_BURN_SLIPPAGE)),
                block.timestamp.add(MINT_BURN_TIMEOUT)
            );
        positionManager.collect(
            tokenId,
            address(this),
            uint128(_amount0),
            uint128(_amount1)
        );
    }

    // Collect fees
    function _collect() private {
        uint128 requestAmount0 = type(uint128).max;
        uint128 requestAmount1 = type(uint128).max;

        (uint256 collected0, uint256 collected1) =
            positionManager.collect(
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
     * Check if token amounts match before attempting mint() or burn()
     * Uniswap contract requires deposits at a precise token ratio
     * If they don't match, swap the tokens so as to deposit as much as possible
     */
    function checkIfAmountsMatchAndSwap(
        uint256 amount0ToMint,
        uint256 amount1ToMint
    ) private returns (uint256 amount0, uint256 amount1) {
        uint160 price = getPoolPrice();
        uint128 liquidityAmount =
            LiquidityAmounts.getLiquidityForAmounts(
                price,
                priceLower,
                priceUpper,
                amount0ToMint,
                amount1ToMint
            );
        (uint256 amount0Minted, uint256 amount1Minted) =
            LiquidityAmounts.getAmountsForLiquidity(
                price,
                priceLower,
                priceUpper,
                liquidityAmount
            );
        if (
            amount0ToMint.div(TOKEN_0_DECIMALS) !=
            amount0Minted.div(TOKEN_0_DECIMALS) ||
            amount1ToMint.div(TOKEN_1_DECIMALS) !=
            amount1Minted.div(TOKEN_1_DECIMALS)
        ) {
            (amount0, amount1) = restoreTokenRatios(
                amount0ToMint,
                amount1ToMint,
                amount0Minted,
                amount1Minted
            );
        } else {
            (amount0, amount1) = (amount0ToMint, amount1ToMint);
        }
    }

    /**
     * Mint function which initializes the pool position
     * Must be called before any liquidity can be deposited
     */
    function mintInitial(uint256 amount0, uint256 amount1) external onlyOwner {
        require(
            amount0 > 0 || amount1 > 0,
            "Cannot mint without sending tokens"
        );
        if (amount0 > 0) {
            token0.transferFrom(msg.sender, address(this), amount0);
        }
        if (amount1 > 0) {
            token1.transferFrom(msg.sender, address(this), amount1);
        }
        (uint256 _tokenId, , , ) =
            positionManager.mint(
                INonfungiblePositionManager.MintParams({
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
                })
            );
        tokenId = _tokenId;
        _mintInternal(amount0.add(getAmountInAsset0Terms(amount1)));
    }

    /**
     * Transfers asset amount when user calls burn()
     * If there's not enough balance of that asset,
     * triggers a router swap to increase the balance
     * keep token ratio in xU3LP at 50:50 after swapping
     */
    function transferOnBurn(uint8 outputAsset, uint256 transferAmount) private {
        (uint256 balance0, uint256 balance1) = getBufferTokenBalance();
        if (outputAsset == 0) {
            if (balance0 < transferAmount) {
                uint256 amountIn =
                    transferAmount.add(transferAmount.div(SWAP_SLIPPAGE)).sub(
                        balance0
                    );
                uint256 amountOut = transferAmount.sub(balance0);
                uint256 balanceFactor = sub0(balance1, amountOut).div(2);
                amountIn = amountIn.add(balanceFactor);
                amountOut = amountOut.add(balanceFactor);
                swapToken1ForToken0(amountIn, amountOut);
            }
            token0.safeTransfer(msg.sender, transferAmount);
        } else if (outputAsset == 1) {
            if (balance1 < transferAmount) {
                uint256 amountIn =
                    transferAmount.add(transferAmount.div(SWAP_SLIPPAGE)).sub(
                        balance1
                    );
                uint256 amountOut = transferAmount.sub(balance1);
                uint256 balanceFactor = sub0(balance0, amountOut).div(2);
                amountIn = amountIn.add(balanceFactor);
                amountOut = amountOut.add(balanceFactor);
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
        uint256 mintAmount = calculateMintAmount(_amount, totalSupply());

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
        router.exactOutputSingle(
            ISwapRouter.ExactOutputSingleParams({
                tokenIn: address(token0),
                tokenOut: address(token1),
                fee: POOL_FEE,
                recipient: address(this),
                deadline: block.timestamp.add(SWAP_TIMEOUT),
                amountOut: amountOut,
                amountInMaximum: amountIn,
                sqrtPriceLimitX96: priceLower
            })
        );
    }

    function swapToken1ForToken0(uint256 amountIn, uint256 amountOut) private {
        router.exactOutputSingle(
            ISwapRouter.ExactOutputSingleParams({
                tokenIn: address(token1),
                tokenOut: address(token0),
                fee: POOL_FEE,
                recipient: address(this),
                deadline: block.timestamp.add(SWAP_TIMEOUT),
                amountOut: amountOut,
                amountInMaximum: amountIn,
                sqrtPriceLimitX96: priceUpper
            })
        );
    }

    /**
     * Swap tokens in xU3LP so as to keep a ratio which is required for depositing in the pool
     * @dev TODO: Handle not enough balances for swap in xU3LP
     */
    function restoreTokenRatios(
        uint256 amount0ToMint,
        uint256 amount1ToMint,
        uint256 amount0Minted,
        uint256 amount1Minted
    ) private returns (uint256 amount0, uint256 amount1) {
        uint256 swapAmount =
            calculateSwapAmount(
                amount0ToMint,
                amount1ToMint,
                amount0Minted,
                amount1Minted
            );
        if (swapAmount == 0) {
            (amount0, amount1) = (amount0ToMint, amount1ToMint);
            return (amount0, amount1);
        }

        uint256 mul1 = amount0ToMint.mul(amount1Minted);
        uint256 mul2 = amount1ToMint.mul(amount0Minted);

        if (mul1 > mul2) {
            swapToken0ForToken1(
                swapAmount.add(swapAmount.div(SWAP_SLIPPAGE)),
                swapAmount
            );
            amount0 = amount0ToMint.sub(swapAmount);
            amount1 = amount1ToMint.add(swapAmount);
        } else if (mul1 < mul2) {
            swapToken1ForToken0(
                swapAmount.add(swapAmount.div(SWAP_SLIPPAGE)),
                swapAmount
            );
            amount0 = amount0ToMint.add(swapAmount);
            amount1 = amount1ToMint.sub(swapAmount);
        } else if (amount0ToMint > amount1ToMint) {
            swapToken0ForToken1(
                swapAmount.add(swapAmount.div(SWAP_SLIPPAGE)),
                swapAmount
            );
            amount0 = amount0ToMint.sub(swapAmount);
            amount1 = amount1ToMint.add(swapAmount);
        } else if (amount0ToMint < amount1ToMint) {
            swapToken1ForToken0(
                swapAmount.add(swapAmount.div(SWAP_SLIPPAGE)),
                swapAmount
            );
            amount0 = amount0ToMint.add(swapAmount);
            amount1 = amount1ToMint.sub(swapAmount);
        }
    }

    /**
     * Helper function to calculate how much to swap to deposit / withdraw
     * In Uni Pool to satisfy the required buffer balance in xU3LP of 5%
     */
    function calculateSwapAmount(
        uint256 amount0ToMint,
        uint256 amount1ToMint,
        uint256 amount0Minted,
        uint256 amount1Minted
    ) private pure returns (uint256 swapAmount) {
        // formula: swapAmount = 
        // (amount0ToMint * amount1Minted - 
        //  amount1ToMint * amount0Minted) / 
        // (amount0Minted + amount1Minted)
        uint256 mul1 = amount0ToMint.mul(amount1Minted);
        uint256 mul2 = amount1ToMint.mul(amount0Minted);

        uint256 sub1 = subAbs(mul1, mul2);
        uint256 add1 = amount0Minted.add(amount1Minted);

        // Some numbers are too big to fit in ABDK's div 128-bit representation
        // So calculate the root of the equation and then raise to the 2nd power
        uint128 sub1sqrt = ABDKMath64x64.sqrtu(sub1);
        uint128 add1sqrt = ABDKMath64x64.sqrtu(add1);
        int128 nRatio = ABDKMath64x64.divu(sub1sqrt, add1sqrt);
        int64 n = ABDKMath64x64.toInt(nRatio);
        swapAmount = uint256(n)**2;
    }

    // Returns the current pool price
    function getPoolPrice() private view returns (uint160) {
        (uint160 sqrtRatioX96, , , , , , ) = pool.slot0();
        return sqrtRatioX96;
    }

    // Returns the latest oracle observation time
    function getObservationTime() private view returns (uint32) {
        (, , uint16 observationIndex, , , , ) = pool.slot0();
        (uint32 observationTime, , , ) = pool.observations(observationIndex);
        return observationTime;
    }

    /**
        Get asset 0 twap price for the period of [now - TWAP_SECONDS, now]
     */
    function getAsset0Price() public view returns (int128) {
        uint32[] memory secondsArray = new uint32[](2);
        secondsArray[0] = TWAP_SECONDS;
        secondsArray[1] = 0;
        uint32 observationTime = getObservationTime();
        uint32 currTimestamp = uint32(block.timestamp);

        // If there are no observations from TWAP_SECONDS ago
        // return price 1
        if (
            !lte(currTimestamp, observationTime, currTimestamp - TWAP_SECONDS)
        ) {
            return ABDKMath64x64.fromInt(1);
        }
        (int56[] memory prices, ) = pool.observe(secondsArray);

        // Formula is
        // 1.0001 ^ (currentPrice - pastPrice) / secondsAgo
        int256 currentPrice = int256(prices[0]);
        int256 pastPrice = int256(prices[1]);

        int256 diff = currentPrice - pastPrice;
        uint256 priceDiff = diff < 0 ? uint256(-diff) : uint256(diff);

        int128 power = ABDKMath64x64.divu(10000, 10001);
        int128 _fraction = ABDKMath64x64.divu(priceDiff, uint256(TWAP_SECONDS));
        uint256 fraction = uint256(ABDKMath64x64.toUInt(_fraction));

        int128 twap = ABDKMath64x64.pow(power, fraction);

        // This is necessary because we cannot call .pow on unsigned integers
        // And thus when asset0Price > asset1Price we need to reverse the value
        twap = diff < 0 ? ABDKMath64x64.inv(twap) : twap;
        return twap;
    }

    /// comparator for 32-bit timestamps
    /// @return bool Whether a <= b
    function lte(
        uint32 time,
        uint32 a,
        uint32 b
    ) private pure returns (bool) {
        if (a <= time && b <= time) return a <= b;

        uint256 aAdjusted = a > time ? a : a + 2**32;
        uint256 bAdjusted = b > time ? b : b + 2**32;

        return aAdjusted <= bAdjusted;
    }

    // Subtract two numbers and return absolute value
    function subAbs(uint256 amount0, uint256 amount1)
        private
        pure
        returns (uint256)
    {
        int256 result = int256(amount0) - int256(amount1);
        return result < 0 ? uint256(-result) : uint256(result);
    }

    // Subtract two numbers and return 0 if result is < 0
    function sub0(uint256 amount0, uint256 amount1)
        private
        pure
        returns (uint256)
    {
        int256 result = int256(amount0) - int256(amount1);
        return result < 0 ? 0 : uint256(result);
    }
}
