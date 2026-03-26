import type { HttpClient } from "./httpClient";
import type { TokenPriceRequest, TokenPriceResponse, GasQuote, FeeBreakdown } from "./types";

/** Parse backend response: tokenPerETH = token smallest units per 1 ETH. */
export function parsePriceResponse(res: TokenPriceResponse): {
  tokenPerETH: bigint;
} {
  const raw = res.tokenPerETH ?? "0";
  let tokenPerETH: bigint;
  try {
    tokenPerETH = BigInt(raw);
  } catch {
    tokenPerETH = 0n;
  }
  return { tokenPerETH };
}

/** Fetch token price from API. */
export async function fetchTokenPrice(
  client: HttpClient,
  params: TokenPriceRequest
): Promise<{ tokenPerETH: bigint }> {
  const res = await client.getTokenPrice(params);
  return parsePriceResponse(res);
}

/**
 * Default safety margin (1.2 = 20% buffer) to cover gas price volatility
 * between quote and on-chain execution.
 */
export const DEFAULT_SAFETY_MARGIN = 1.2;

const ONE_ETH = 10n ** 18n;

/**
 * Compute payment amount in token smallest units.
 *
 * tokenPerETH = token smallest units per 1 ETH (from bundler API).
 * Formula: Amount = ceil(gasCostWei * tokenPerETH / 1e18 * safetyMargin)
 */
export function calculatePaymentAmount(params: {
  gas: bigint;
  gasPriceWei: bigint;
  /** Token smallest units per 1 ETH (from bundler API) */
  tokenPerETH: bigint;
  /** Safety margin to cover gas/price volatility (default: 1.2 = 20%) */
  safetyMargin?: number;
}): bigint {
  const { gas, gasPriceWei, tokenPerETH, safetyMargin = DEFAULT_SAFETY_MARGIN } = params;
  if (tokenPerETH <= 0n) return 0n;
  const gasCostWei = gas * gasPriceWei;

  // tokenAmount = gasCostWei * tokenPerETH * margin / 1e18
  const marginNumerator = BigInt(Math.ceil(safetyMargin * 10000));
  const numerator = gasCostWei * tokenPerETH * marginNumerator;
  const denominator = ONE_ETH * 10000n;

  // ceil division
  return (numerator + denominator - 1n) / denominator;
}

/** Build FeeBreakdown from quote, tokenPerETH, and estimated gas. */
export function buildFeeBreakdown(params: {
  gas: bigint;
  gasPriceWei: bigint;
  /** Token smallest units per 1 ETH (from bundler API) */
  tokenPerETH: bigint;
  /** Safety margin to cover gas/price volatility (default: 1.2 = 20%) */
  safetyMargin?: number;
}): FeeBreakdown {
  const safetyMargin = params.safetyMargin ?? DEFAULT_SAFETY_MARGIN;
  const paymentAmount = calculatePaymentAmount({ ...params, safetyMargin });
  return {
    gas: params.gas,
    gasPriceWei: params.gasPriceWei,
    tokenPerETH: params.tokenPerETH,
    paymentAmount,
    safetyMargin,
  };
}

/**
 * Compute ERC3009 paymaster \"value\" from fee data.
 * Placeholder implementation: returns 0n for now.
 */
export function computePaymasterValue(_fee: FeeBreakdown): bigint {
  return 0n;
}

/** Normalize backend QuoteResponse to GasQuote and get gas price in wei (for fee formula). */
export function normalizeQuote(res: {
  baseFee?: string;
  priorityFee?: string;
  gasPrice?: string;
  gasLimit?: number;
  verificationGasLimit?: number;
  preVerificationGas?: number;
}): { quote: GasQuote; gasPriceWei: bigint } {
  const baseFee = res.baseFee ?? "0";
  const priorityFee = res.priorityFee ?? "0";
  const gasLimit = res.gasLimit ?? 0;
  let gasPriceWei: bigint;
  if (res.gasPrice && res.gasPrice !== "0") {
    gasPriceWei = BigInt(res.gasPrice);
  } else {
    const base = BigInt(baseFee);
    const prio = BigInt(priorityFee);
    gasPriceWei = base + prio;
  }
  return {
    quote: {
      baseFee,
      priorityFee: res.priorityFee,
      gasPrice: res.gasPrice,
      gasLimit,
      verificationGasLimit: res.verificationGasLimit,
      preVerificationGas: res.preVerificationGas,
    },
    gasPriceWei,
  };
}
