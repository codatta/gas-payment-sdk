# @xny/gas-payment-sdk

TypeScript SDK for gas payment: token/ETH price, EntryPoint handleOps, fee calculation (Amount = gas × gas_price × ETH_price / token_price), ERC3009 payment, and submit.

Works in **Node.js** and **browser**.

## Install

> Not yet published to npm. Install directly from the Git repository, or vendor the source into your project.

**Option A — install from Git** (requires SSH access to the repo):

```bash
npm install git+ssh://git@github.com:codatta/gas-payment-sdk.git
# pin to a commit / tag / branch:
npm install git+ssh://git@github.com:codatta/gas-payment-sdk.git#<commit-sha-or-tag>
```

The `prepare` lifecycle will build `dist/` automatically on install.

**Option B — local path** (monorepo / sibling checkout):

```bash
git clone git@github.com:codatta/gas-payment-sdk.git
cd gas-payment-sdk && npm install && npm run build
# in your app:
npm install /absolute/path/to/gas-payment-sdk
```

**Option C — npm link** (active SDK development):

```bash
cd /path/to/gas-payment-sdk && npm run build && npm link
cd /path/to/your-app && npm link @xny/gas-payment-sdk
```

Peer requirement: `viem ^2`, Node `>=18`.

## Config

Every field is **optional**. Once `chainId` is known (or defaulted to `DEFAULT_CHAIN_ID = 84532` / Base Sepolia), the rest are filled in from the bundled per-chain defaults (`CHAIN_DEFAULTS`). Pass any field explicitly to override.

| Option | Description | Default source |
|--------|-------------|----------------|
| `chainId` | EIP-155 chain ID | `DEFAULT_CHAIN_ID` (84532) |
| `apiBaseUrl` | Bundler REST API base | from `CHAIN_DEFAULTS[chainId]` |
| `rpcUrl` | Chain RPC URL | from `CHAIN_DEFAULTS[chainId]` |
| `entryPointAddress` | EntryPoint contract (handleOps) | from `CHAIN_DEFAULTS[chainId]` |
| `erc3009TokenAddress` | ERC3009 token used for payment | from `CHAIN_DEFAULTS[chainId]` |
| `paymentTargetContract` | PoolPaymaster (also ERC3009 receiver) | from `CHAIN_DEFAULTS[chainId]` |
| `apiKey` | Optional bearer token for bundler | — |
| `timeout` | Request timeout (ms) | 30000 |

Currently bundled chains: `84532` (Base Sepolia). For chains without bundled defaults you must pass every address explicitly, otherwise the constructor throws `ValidationError` listing what's missing.

## Usage

```ts
import { GasPaymentClient } from "@xny/gas-payment-sdk";

// Zero-config — uses Base Sepolia defaults
const client = new GasPaymentClient();

// Or pick the chain explicitly (still uses bundled defaults)
const client2 = new GasPaymentClient({ chainId: 84532 });

// Override individual fields (e.g. point at your own RPC)
const client3 = new GasPaymentClient({
  chainId: 84532,
  rpcUrl: "https://base-sepolia.g.alchemy.com/v2/<key>",
  apiKey: "<bundler-token>",
});

// Full custom (e.g. unsupported chain or local anvil)
const clientCustom = new GasPaymentClient({
  apiBaseUrl: "https://api.example.com/api/v1",
  rpcUrl: "http://127.0.0.1:8545",
  chainId: 31337,
  entryPointAddress: "0x...",
  erc3009TokenAddress: "0x...",
  paymentTargetContract: "0x...",
});

// 1. Token price (token smallest units per 1 ETH)
const tokenPrice = await client.getTokenPrice();

// 2. Gas quote
const { quote, gasPriceWei } = await client.getQuote();

// 3. Prepare payment: UserOp, handleOps tx, fee, ERC3009 payload
const prepared = await client.preparePayment({
  sender: "0xUser...",
  target: "0xTarget...",
  callData: "0x...",
});
// Sign prepared.userOpHash (UserOperation) and prepared.erc3009Payload.typedData (ERC3009).

// 4. Submit
const result = await client.submitPayment({
  userOp: { ...prepared.userOp, signature: "0x..." },
  signature: "0x...",
});

// 5. Status
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

```bash
cp .env.example .env       # then fill in SENDER_PRIVATE_KEY + TARGET
npm install
npm run example            # run all steps
```

Run a single SDK interface:

| Command | Interface |
|---------|-----------|
| `npm run example:price` | `getTokenPrice()` |
| `npm run example:quote` | `getQuote()` |
| `npm run example:prepare` | `preparePayment()` |
| `npm run example:state` | on-chain ETH + ERC20 balance snapshot |
| `npm run example:status` | `getStatus(REQUEST_ID)` |
| `npm run example:submit` | `submitPayment()` (signs with `SENDER_PRIVATE_KEY` and submits) |

See `.env.example` for the full list of variables and which are required vs optional. Network/contract values default to the Base Sepolia preset baked into the SDK.

## Tests

```bash
npm run test
```

Tests cover: token/ETH price parsing and fee formula, EntryPoint UserOperation and handleOps encoding, ERC3009 typed data, HTTP client (price, quote, submit, status), and GasPaymentClient (config validation, getTokenPrice, getEthPrice, getQuote, submitPayment, getStatus, preparePayment validation).

## License

MIT
