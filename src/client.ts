import type {
  SdkConfig,
  TokenPriceRequest,
  GasQuote,
  PreparePaymentParams,
  PreparePaymentResult,
  SubmitRequest,
  SubmitResult,
  UserOperation,
  StatusResponse,
} from "./types";
import { ValidationError } from "./types";
import { HttpClient } from "./httpClient";
import { buildFeeBreakdown, normalizeQuote } from "./price";
import { createProvider } from "./onchain/provider";
import {
  encodeHandleOpsCall,
  buildUserOperation,
  getUserOpHash,
  buildErc3009Payment,
} from "./onchain";
import type { PublicClient } from "viem";

const ERC3009_UNDERLYING_ABI = [
  {
    name: "underlyingToken",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
] as const;

const ERC20_ALLOWANCE_ABI = [
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
] as const;

/**
 * High-level client for the gas payment pooling system.
 *
 * Provides methods to quote gas fees, prepare ERC3009-based payment operations,
 * submit signed UserOperations to the bundler, and query transaction status.
 *
 * @example
 * ```ts
 * const client = new GasPaymentClient({
 *   apiBaseUrl: "https://api.example.com/api/v1",
 *   rpcUrl: "https://mainnet.base.org",
 *   chainId: 8453,
 *   erc3009TokenAddress: "0x...",
 *   paymentTargetContract: "0x...",
 *   entryPointAddress: "0x...",
 * });
 * const { fee, userOp, erc3009Payload } = await client.preparePayment({
 *   sender: "0x...",
 *   target: "0x...",
 *   callData: "0x...",
 * });
 * ```
 */
export class GasPaymentClient {
  private config: SdkConfig;
  private http: HttpClient;
  private _provider: PublicClient | null = null;

  /**
   * Create a new GasPaymentClient.
   *
   * @param config - SDK configuration including API URL, RPC URL, chain ID, and contract addresses.
   * @throws {@link ValidationError} if required config fields are missing.
   */
  constructor(config: SdkConfig) {
    if (!config.apiBaseUrl?.trim()) {
      throw new ValidationError("apiBaseUrl is required");
    }
    if (!config.rpcUrl?.trim()) {
      throw new ValidationError("rpcUrl is required");
    }
    if (!config.erc3009TokenAddress || !config.paymentTargetContract) {
      throw new ValidationError("erc3009TokenAddress and paymentTargetContract are required");
    }
    if (!config.entryPointAddress) {
      throw new ValidationError("entryPointAddress is required");
    }
    this.config = config;
    this.http = new HttpClient({
      apiBaseUrl: config.apiBaseUrl,
      apiKey: config.apiKey,
      timeout: config.timeout,
    });
  }

  private get provider(): PublicClient {
    if (!this._provider) {
      this._provider = createProvider(this.config.rpcUrl, this.config.chainId);
    }
    return this._provider;
  }

  /**
   * Get token price from the bundler backend.
   *
   * Returns the number of token smallest units equivalent to 1 ETH,
   * plus optional gas limit suggestions from the backend.
   *
   * @param params - Optional token address override. Defaults to the configured `erc3009TokenAddress`.
   * @returns Token-per-ETH rate and optional gas limit hints.
   */
  async getTokenPrice(
    params: Partial<TokenPriceRequest> = {}
  ): Promise<{ tokenPerETH: bigint; verificationGasLimit?: number; preVerificationGas?: number }> {
    const token = params.token ?? this.config.erc3009TokenAddress;
    const res = await this.http.getTokenPrice({ token });
    const tokenPerETH = BigInt(res.tokenPerETH ?? "0");
    return {
      tokenPerETH,
      verificationGasLimit: res.verificationGasLimit,
      preVerificationGas: res.preVerificationGas,
    };
  }

  /**
   * Get a gas quote from the bundler backend (`POST /bundler/quote`).
   *
   * @param params - Optional parameters (e.g. `batchSize`).
   * @returns Normalized gas quote and the effective gas price in wei.
   */
  async getQuote(
    params: { batchSize?: number } = {}
  ): Promise<{ quote: GasQuote; gasPriceWei: bigint }> {
    const res = await this.http.postQuote(params);
    return normalizeQuote(res);
  }

  /**
   * Get the current gas price in wei from the bundler backend.
   *
   * Convenience wrapper around {@link getQuote}.
   *
   * @param params - Optional parameters (e.g. `batchSize`).
   * @returns Gas price in wei.
   */
  async getGasPriceWei(params: { batchSize?: number } = {}): Promise<bigint> {
    const { gasPriceWei } = await this.getQuote(params);
    return gasPriceWei;
  }

  /**
   * Prepare a full payment operation.
   *
   * Builds a UserOperation, estimates gas for `handleOps`, computes the token fee
   * (including safety margin), checks underlying ERC20 allowance, and constructs
   * the ERC3009 `TransferWithAuthorization` payload for signing.
   *
   * @param params - Payment parameters including sender, target, callData, and optional gas limit overrides.
   * @returns Everything needed to sign and submit: UserOp, fee breakdown, ERC3009 typed data, and userOpHash.
   * @throws {@link ValidationError} if token price is non-positive, EntryPoint is unreachable, or ERC20 allowance is insufficient.
   */
  async preparePayment(
    params: PreparePaymentParams
  ): Promise<PreparePaymentResult> {
    const { quote, gasPriceWei } = await this.getQuote();
    const tokenPriceRes = await this.getTokenPrice();
    const tokenPerETH = tokenPriceRes.tokenPerETH;
    if (tokenPerETH <= 0n) {
      throw new ValidationError("Token price must be positive");
    }

    const verificationGasLimit =
      params.verificationGasLimit ??
      BigInt(quote.verificationGasLimit ?? 100_000);
    const preVerificationGas =
      params.preVerificationGas ??
      BigInt(quote.preVerificationGas ?? 50_000);
    const maxFeePerGas = gasPriceWei;
    const maxPriorityFeePerGas = gasPriceWei / 2n;

    // Caller is responsible for constructing callData and (optionally) callGasLimit.
    const target = params.target;
    const callData = params.callData;
    const callGasLimit =
      params.callGasLimit ?? BigInt(quote.gasLimit ?? 150_000);

    let nonce: bigint;
    try {
      nonce = await this.provider.readContract({
        address: this.config.entryPointAddress,
        abi: [
          {
            name: "getNonce",
            type: "function",
            stateMutability: "view",
            inputs: [
              { name: "sender", type: "address" },
              { name: "key", type: "uint192" },
            ],
            outputs: [{ type: "uint256" }],
          },
        ],
        functionName: "getNonce",
        args: [params.sender, 0n],
      });
    } catch (err) {
      const msg = (err as Error)?.message ?? String(err);
      if (
        msg.includes("returned no data") ||
        msg.includes("is not a contract") ||
        msg.includes("does not have the function")
      ) {
        throw new ValidationError(
          `EntryPoint getNonce failed at ${this.config.entryPointAddress}. ` +
            "Set ENTRY_POINT_ADDRESS to the deployed EntryPoint on this chain (e.g. 0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789 for EntryPoint v0.6)."
        );
      }
      throw err;
    }

    const userOp = buildUserOperation({
      sender: params.sender,
      target,
      callData,
      nonce,
      callGasLimit,
      verificationGasLimit,
      preVerificationGas,
      maxFeePerGas,
      maxPriorityFeePerGas,
      paymasterAndData: params.paymasterAndData ?? ("0x" as `0x${string}`),
    });

    const handleOpsParams = {
      ops: [{ ...userOp, signature: "0x" as `0x${string}` }],
      beneficiary: this.config.paymentTargetContract,
    };
    const { to, data } = encodeHandleOpsCall(
      handleOpsParams,
      this.config.entryPointAddress
    );

    // Total gas = callGasLimit + verificationGasLimit + preVerificationGas.
    const gasEstimation =
      callGasLimit + verificationGasLimit + preVerificationGas;
    const gasForFormula = gasEstimation;

    const fee = buildFeeBreakdown({
      gas: gasForFormula,
      gasPriceWei,
      tokenPerETH,
    });

    // Check underlying ERC20 allowance: user must have approved the ERC3009 token contract.
    try {
      const underlyingAddress = (await this.provider.readContract({
        address: this.config.erc3009TokenAddress,
        abi: ERC3009_UNDERLYING_ABI,
        functionName: "underlyingToken",
        args: [],
      })) as `0x${string}`;
      const currentAllowance = (await this.provider.readContract({
        address: underlyingAddress,
        abi: ERC20_ALLOWANCE_ABI,
        functionName: "allowance",
        args: [params.sender, this.config.erc3009TokenAddress],
      })) as bigint;
      if (currentAllowance < fee.paymentAmount) {
        throw new ValidationError(
          `Insufficient underlying ERC20 allowance for ERC3009 token ${this.config.erc3009TokenAddress}. ` +
            `Required at least ${fee.paymentAmount.toString()} (token smallest units), ` +
            `current allowance (owner=${params.sender}, spender=ERC3009) is ${currentAllowance.toString()}. ` +
            "Approve the ERC3009 token contract to spend the underlying token before calling preparePayment/submitPayment."
        );
      }
    } catch (err) {
      if (err instanceof ValidationError) {
        throw err;
      }
      const msg = (err as Error)?.message ?? String(err);
      throw new ValidationError(
        `Failed to check underlying token allowance: ${msg}. ` +
          "Ensure the ERC3009 token implements underlyingToken() and the underlying token implements allowance(owner,spender)."
      );
    }

    const { preparedTx: erc3009Payload } = buildErc3009Payment({
      token: this.config.erc3009TokenAddress,
      from: params.sender,
      to: this.config.paymentTargetContract,
      amount: fee.paymentAmount,
      chainId: this.config.chainId,
    });

    const userOpHash = getUserOpHash(
      userOp,
      this.config.chainId,
      this.config.entryPointAddress
    );

    return {
      userOp: { ...userOp, signature: "0x" as `0x${string}` },
      handleOpsTx: { to, data, gasEstimation },
      quote,
      gasPriceWei,
      fee,
      erc3009Payload,
      userOpHash,
    };
  }

  /**
   * Submit a signed UserOperation to the bundler backend (`POST /bundler/submit`).
   *
   * @param params - The UserOperation and its EIP-712 signature.
   * @param params.userOp - The UserOperation struct (from {@link preparePayment}).
   * @param params.signature - The user's hex-encoded signature over the userOpHash.
   * @returns A {@link SubmitResult} containing the `requestId` for status polling.
   */
  async submitPayment(params: {
    userOp: UserOperation;
    signature: `0x${string}`;
  }): Promise<SubmitResult> {
    const op = params.userOp;
    const req: SubmitRequest = {
      sender: op.sender,
      target: op.target,
      token: this.config.erc3009TokenAddress,
      nonce: Number(op.nonce),
      callData: op.callData,
      callGasLimit: Number(op.callGasLimit),
      verificationGasLimit: Number(op.verificationGasLimit),
      preVerificationGas: Number(op.preVerificationGas),
      maxFeePerGas: op.maxFeePerGas.toString(),
      maxPriorityFeePerGas: op.maxPriorityFeePerGas.toString(),
      paymasterAndData: op.paymasterAndData,
      signature: params.signature,
    };
    console.log("req", req);
    const res = await this.http.postSubmit(req);
    return { requestId: res.requestId };
  }

  /**
   * Query the status of a previously submitted operation (`GET /bundler/status/:id`).
   *
   * @param requestId - The request ID returned by {@link submitPayment}.
   * @returns Current status, optional txHash, and failure reason if applicable.
   */
  async getStatus(requestId: string): Promise<StatusResponse> {
    return this.http.getStatus(requestId);
  }
}
