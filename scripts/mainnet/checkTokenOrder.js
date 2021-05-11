
let dai = '0x6b175474e89094c44da98b954eedeac495271d0f';
let usdc = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
let susd = '0x57ab1ec28d129707052df4df418d58a2d46d5f51';
let ust = '0xa47c8bf37f92abed4a126bda807a7b7498661acd';
let usdt = '0xdac17f958d2ee523a2206206994597c13d831ec7';


async function checkOrder() {
    if(susd > usdc) {
        console.log('token addresses should be reversed');
    } else {
        console.log('token addresses are sorted correctly')
    }
}

checkOrder();