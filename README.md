# @xny/gas-payment-sdk

TypeScript SDK for gas payment: token/ETH price, EntryPoint handleOps, fee calculation (Amount = gas × gas_price × ETH_price / token_price), ERC3009 payment, and submit.

Works in **Node.js** and **browser**.

## Install

```bash
npm install @xny/gas-payment-sdk
```

## Config

| Option | Description |
|--------|-------------|
| `apiBaseUrl` | Bundler REST API base (e.g. `https://api.example.com/api/v1`) |
| `rpcUrl` | Chain RPC URL |
| `chainId` | Chain ID |
| `entryPointAddress` | EntryPoint contract (handleOps) |
| `erc3009TokenAddress` | ERC3009 token used for payment |
| `paymentTargetContract` | Payment recipient / beneficiary |
| `ethPriceFactoryAddress` | Uniswap V3 Factory (used to resolve pool from WETH + quote token) |
| `ethPriceWethAddress` | WETH address |
| `ethPriceQuoteTokenAddress` | Quote token address (e.g. USDC) |
| `ethPriceFeeTier` | Pool fee in hundredths of a bip (e.g. 500 = 0.05%, 3000 = 0.3%) |
| `ethPriceQuoteDecimals` | Quote token decimals (default 6, e.g. USDC) |
| `apiKey` | Optional API key for bundler |
| `timeout` | Request timeout in ms |

## Usage

```ts
import { GasPaymentClient } from "@xny/gas-payment-sdk";

const client = new GasPaymentClient({
  apiBaseUrl: "https://api.example.com/api/v1",
  rpcUrl: "https://eth.llamarpc.com",
  chainId: 1,
  entryPointAddress: "0x...",
  erc3009TokenAddress: "0x...",
  paymentTargetContract: "0x...",
  ethPriceFactoryAddress: "0x...",
  ethPriceWethAddress: "0x...",
  ethPriceQuoteTokenAddress: "0x...",
  ethPriceFeeTier: 500,
});

// 1. Token price
const tokenPrice = await client.getTokenPrice({ symbol: "USDC" });

// 2. ETH price (from Uniswap V3 pool, not backend)
const ethPrice = await client.getEthPrice();

// 3. Gas quote
const { quote, gasPriceWei } = await client.getQuote();

// 4. Prepare payment: UserOp, handleOps tx, fee, ERC3009 payload
const prepared = await client.preparePayment({
  sender: "0xUser...",
  target: "0xTarget...",
  callData: "0x...",
  tokenDecimals: 6,
});
// Sign prepared.userOpHash (UserOperation) and prepared.erc3009Payload.typedData (ERC3009).

// 5. Submit
const result = await client.submitPayment({
  userOp: { ...prepared.userOp, signature: "0x..." },
  signature: "0x...",
});

// 6. Status
const status = await client.getStatus(result.requestId);
```

## Fee formula

Payment amount in token (smallest units):

```
Amount = gas × gas_price × ETH_price / token_price
```

- `gas`: estimated gas for the handleOps call  
- `gas_price`: wei per gas (from quote or RPC)  
- `ETH_price`: from backend (e.g. USD per ETH)  
- `token_price`: from backend (e.g. USD per token)

## Example

Run all steps:

```bash
npm run example
```

Run a single SDK interface:

| Command | Interface |
|---------|-----------|
| `npm run example:price` | `getTokenPrice()` |
| `npm run example:eth-price` | `getEthPrice()` |
| `npm run example:quote` | `getQuote()` |
| `npm run example:prepare` | `preparePayment()` |
| `npm run example:status` | `getStatus(REQUEST_ID)` |
| `npm run example:submit` | `submitPayment()` (set `SUBMIT_SIGNATURE` to actually submit) |

Optional env: `API_BASE_URL`, `RPC_URL`, `CHAIN_ID`, `ENTRY_POINT_ADDRESS`, `ERC3009_TOKEN_ADDRESS`, `PAYMENT_TARGET_CONTRACT`, `ETH_PRICE_FACTORY_ADDRESS`, `ETH_PRICE_WETH_ADDRESS`, `ETH_PRICE_QUOTE_TOKEN_ADDRESS`, `ETH_PRICE_FEE_TIER`, `SENDER`, `TARGET`, `CALL_DATA`, `REQUEST_ID`, `SUBMIT_SIGNATURE`, `SUBMIT_NONCE`, `SUBMIT_CALL_GAS`, `SUBMIT_MAX_FEE`.

## Tests

```bash
npm run test
```

Tests cover: token/ETH price parsing and fee formula, EntryPoint UserOperation and handleOps encoding, ERC3009 typed data, HTTP client (price, quote, submit, status), and GasPaymentClient (config validation, getTokenPrice, getEthPrice, getQuote, submitPayment, getStatus, preparePayment validation).

## License

MIT
