/**
 * SDK configuration. Supports both Node.js and browser.
 */
export interface SdkConfig {
  /** Base URL for bundler REST API (e.g. https://api.example.com/api/v1) */
  apiBaseUrl: string;
  /** RPC URL for the chain */
  rpcUrl: string;
  /** Chain ID */
  chainId: number;
  /** ERC3009 token contract address used for payment */
  erc3009TokenAddress: `0x${string}`;
  /** Payment target / recipient contract address */
  paymentTargetContract: `0x${string}`;
  /** EntryPoint contract address (handleOps) */
  entryPointAddress: `0x${string}`;
  /** Uniswap V3 Factory address. Used by getEthPrice() to resolve pool from WETH + quote token. */
  ethPriceFactoryAddress: `0x${string}`;
  /** WETH address for ETH price (e.g. Wrapped Ether). */
  ethPriceWethAddress: `0x${string}`;
  /** Quote token address (e.g. USDC) for the ETH price pool. */
  ethPriceQuoteTokenAddress: `0x${string}`;
  /** Fee tier of the pool in hundredths of a bip (e.g. 500 = 0.05%, 3000 = 0.3%). */
  ethPriceFeeTier: number;
  /** Quote token decimals (e.g. 6 for USDC). Default 6. */
  ethPriceQuoteDecimals?: number;
  /** Optional API key for bundler auth */
  apiKey?: string;
  /** Request timeout in ms */
  timeout?: number;
}

/** Backend wraps responses in { code, message, data } with camelCase data */
export interface ApiResponse<T> {
  code: number;
  message: string;
  data?: T;
}

/** GET /bundler/price - optional symbol query for future multi-token support */
export interface TokenPriceRequest {
  /** Token symbol (e.g. "ETH", "USDC"). Optional if backend returns single price */
  symbol?: string;
}

/** Price returned by backend: scaled string e.g. 1e18 = 1.0, plus optional gas limits. */
export interface TokenPriceResponse {
  price: string;
  /** Minimum verificationGasLimit required for submit (from config/env). */
  verificationGasLimit?: number;
  /** Minimum preVerificationGas required for submit (from config/env). */
  preVerificationGas?: number;
}

/** Token price as number for fee math (e.g. USD per unit) */
export interface TokenPrice {
  /** Raw string from API */
  priceRaw: string;
  /** Numeric value for calculations */
  price: number;
}

/** POST /bundler/quote request */
export interface QuoteRequest {
  batchSize?: number;
}

/** POST /bundler/quote response */
export interface QuoteResponse {
  baseFee?: string;
  priorityFee?: string;
  gasPrice?: string;
  gasLimit?: number;
  /** Optional verificationGasLimit from backend (uint64). */
  verificationGasLimit?: number;
  /** Optional preVerificationGas from backend (uint64). */
  preVerificationGas?: number;
}

/** Normalized gas quote for SDK use */
export interface GasQuote {
  baseFee: string;
  priorityFee?: string;
  gasPrice?: string;
  gasLimit?: number;
   /** verificationGasLimit suggested by backend (if any). */
  verificationGasLimit?: number;
  /** preVerificationGas suggested by backend (if any). */
  preVerificationGas?: number;
}

/** Fee breakdown: Amount = ceil(gas * gas_price * ETH_price / token_price * safetyMargin) (prices in 10^18 BigInt). */
export interface FeeBreakdown {
  /** Estimated gas units */
  gas: bigint;
  /** Gas price in wei per gas (used in formula) */
  gasPriceWei: bigint;
  /** ETH price scaled by 10^18 (BigInt) */
  ethPriceE18: bigint;
  /** Payment token price scaled by 10^18 (BigInt) */
  tokenPriceE18: bigint;
  /** ETH price for display (e.g. USD per ETH) */
  ethPrice: number;
  /** Payment token price for display (e.g. USD per token) */
  tokenPrice: number;
  /** Resulting payment amount in token smallest units (includes safety margin) */
  paymentAmount: bigint;
  /** Safety margin applied (e.g. 1.2 = 20% buffer) */
  safetyMargin: number;
}

/**
 * UserOperation struct matching IEntryPoint.UserOperation (EntryPoint.sol).
 */
export interface UserOperation {
  sender: `0x${string}`;
  target: `0x${string}`;
  nonce: bigint;
  callData: `0x${string}`;
  callGasLimit: bigint;
  verificationGasLimit: bigint;
  preVerificationGas: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  paymasterAndData: `0x${string}`;
  signature: `0x${string}`;
}

/** Params for encoding handleOps(ops, beneficiary) call */
export interface HandleOpsParams {
  ops: UserOperation[];
  beneficiary: `0x${string}`;
}

/** Prepared transaction (e.g. for ERC3009 or handleOps) */
export interface PreparedTx {
  to: `0x${string}`;
  data: `0x${string}`;
  value?: bigint;
  gasLimit?: bigint;
  /** EIP-712 typed data for signing (ERC3009) */
  typedData?: Record<string, unknown>;
}

/** Build UserOperation input (before signature) */
export interface BuildUserOpParams {
  sender: `0x${string}`;
  target: `0x${string}`;
  callData: `0x${string}`;
  nonce: bigint;
  callGasLimit: bigint;
  verificationGasLimit: bigint;
  preVerificationGas: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  paymasterAndData: `0x${string}`;
}

/** POST /bundler/submit request (matches backend SubmitRequest) */
export interface SubmitRequest {
  sender: string;
  target: string;
  nonce: number;
  callData: string;
  callGasLimit?: number;
  verificationGasLimit?: number;
  preVerificationGas?: number;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  paymasterAndData?: string;
  signature: string;
}

/** POST /bundler/submit response */
export interface SubmitResponse {
  requestId: string;
}

/** Result after submit */
export interface SubmitResult {
  requestId: string;
}

/** Params for preparePayment: build UserOp, estimate gas, compute fee, build ERC3009 payload */
export interface PreparePaymentParams {
  sender: `0x${string}`;
  target: `0x${string}`;
  callData: `0x${string}`;
  paymasterAndData?: `0x${string}`;
  /** Token decimals for payment amount (e.g. 6 for USDC) */
  tokenDecimals: number;
  /** Override gas limits from quote; if not set, quote values are used */
  callGasLimit?: bigint;
  verificationGasLimit?: bigint;
  preVerificationGas?: bigint;
}

/** Result of preparePayment */
export interface PreparePaymentResult {
  userOp: UserOperation;
  handleOpsTx: { to: `0x${string}`; data: `0x${string}`; gasEstimation?: bigint };
  quote: GasQuote;
  gasPriceWei: bigint;
  fee: FeeBreakdown;
  erc3009Payload: PreparedTx;
  userOpHash: `0x${string}`;
}

/** GET /bundler/status/:id response */
export interface StatusResponse {
  requestId: string;
  status: string;
  txHash?: string;
  failReason?: string;
}

/** SDK error types */
export class SdkHttpError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public body?: string
  ) {
    super(message);
    this.name = "SdkHttpError";
  }
}

export class OnchainError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = "OnchainError";
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}
