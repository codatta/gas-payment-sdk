/**
 * SDK configuration. Supports both Node.js and browser.
 *
 * Every field is optional. Once `chainId` is known (or defaulted via
 * {@link DEFAULT_CHAIN_ID}), the remaining fields are filled in from
 * the built-in {@link CHAIN_DEFAULTS} table. Pass any field explicitly
 * to override the bundled default — useful for custom deployments,
 * unsupported chains, or production-grade RPC endpoints.
 */
export interface SdkConfig {
  /** Base URL for bundler REST API (e.g. https://api.example.com/api/v1) */
  apiBaseUrl?: string;
  /** RPC URL for the chain */
  rpcUrl?: string;
  /** Chain ID. Defaults to `DEFAULT_CHAIN_ID` when omitted. */
  chainId?: number;
  /** ERC3009 token contract address used for payment */
  erc3009TokenAddress?: `0x${string}`;
  /** Payment target / recipient contract address */
  paymentTargetContract?: `0x${string}`;
  /** EntryPoint contract address (handleOps) */
  entryPointAddress?: `0x${string}`;
  /** Optional API key for bundler auth */
  apiKey?: string;
  /** Request timeout in ms */
  timeout?: number;
}

/**
 * Resolved configuration after applying chain defaults. All address /
 * URL fields are guaranteed present at this point.
 */
export interface ResolvedSdkConfig {
  apiBaseUrl: string;
  rpcUrl: string;
  chainId: number;
  erc3009TokenAddress: `0x${string}`;
  paymentTargetContract: `0x${string}`;
  entryPointAddress: `0x${string}`;
  apiKey?: string;
  timeout?: number;
}

/** Backend wraps responses in { code, message, data } with camelCase data */
export interface ApiResponse<T> {
  code: number;
  message: string;
  data?: T;
}

/** GET /bundler/price?token=0x... */
export interface TokenPriceRequest {
  /** ERC3009 token (or adapter) address */
  token: `0x${string}`;
}

/** Price returned by backend: token smallest units equivalent to 1 ETH, plus optional gas limits. */
export interface TokenPriceResponse {
  /** Token amount (smallest units) per 1 ETH, with fee factor applied. */
  tokenPerETH: string;
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

/** Fee breakdown: Amount = ceil(gasCostWei * tokenPerETH / 1e18 * safetyMargin) */
export interface FeeBreakdown {
  /** Estimated gas units */
  gas: bigint;
  /** Gas price in wei per gas */
  gasPriceWei: bigint;
  /** Token smallest units per 1 ETH (from bundler API) */
  tokenPerETH: bigint;
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
  token: string;
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

/**
 * Error thrown when the bundler HTTP API returns a non-success response or a network failure occurs.
 *
 * @param message - Human-readable error description.
 * @param statusCode - HTTP status code (if available).
 * @param body - Raw response body string (if available).
 */
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

/**
 * Error thrown when an on-chain call (e.g. contract read, gas estimation) fails.
 *
 * @param message - Human-readable error description.
 * @param cause - The underlying error from the RPC provider.
 */
export class OnchainError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = "OnchainError";
  }
}

/**
 * Error thrown when SDK input validation fails (e.g. missing config, insufficient allowance).
 *
 * @param message - Human-readable validation error description.
 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}
