import type { HttpClient } from "./httpClient";
import type { TokenPriceRequest, TokenPriceResponse, GasQuote, FeeBreakdown } from "./types";

const SCALE = 1e18;
/** Price scale: 1e18 = 1.0; all prices in BigInt use this. */
export const PRICE_SCALE = 10n ** 18n;

/** Parse backend price string (e.g. 1e18 = 1.0) to BigInt and number. */
export function parsePriceResponse(res: TokenPriceResponse): {
  priceRaw: string;
  priceE18: bigint;
  price: number;
} {
  const raw = res.price ?? "0";
  let priceE18: bigint;
  try {
    priceE18 = BigInt(raw);
  } catch {
    priceE18 = 0n;
  }
  const price = Number(priceE18) / SCALE;
  return { priceRaw: raw, priceE18, price };
}

/** Fetch token price from API (optional symbol). */
export async function fetchTokenPrice(
  client: HttpClient,
  params: TokenPriceRequest = {}
): Promise<{ priceRaw: string; priceE18: bigint; price: number }> {
  const res = await client.getTokenPrice(params);
  return parsePriceResponse(res);
}

/** Fetch ETH price from API (GET /bundler/price with symbol=ETH when supported). */
export async function fetchEthPrice(
  client: HttpClient
): Promise<{ priceRaw: string; priceE18: bigint; price: number }> {
  const res = await client.getTokenPrice({ symbol: "ETH" });
  return parsePriceResponse(res);
}

/**
 * Default safety margin (1.2 = 20% buffer) to cover gas price volatility
 * between quote and on-chain execution.
 */
export const DEFAULT_SAFETY_MARGIN = 1.2;

/**
 * Compute payment amount in token smallest units (BigInt only).
 * Formula: Amount = ceil((gas * gas_price * ethPriceE18 * 10^tokenDecimals) / (PRICE_SCALE * tokenPriceE18) * safetyMargin)
 */
export function calculatePaymentAmount(params: {
  gas: bigint;
  gasPriceWei: bigint;
  ethPriceE18: bigint;
  tokenPriceE18: bigint;
  tokenDecimals: number;
  /** Safety margin to cover gas/price volatility (default: 1.2 = 20%) */
  safetyMargin?: number;
}): bigint {
  const { gas, gasPriceWei, ethPriceE18, tokenPriceE18, tokenDecimals, safetyMargin = DEFAULT_SAFETY_MARGIN } = params;
  if (tokenPriceE18 <= 0n) return 0n;
  const gasCostWei = gas * gasPriceWei;
  const numerator =
    gasCostWei * ethPriceE18 * (10n ** BigInt(tokenDecimals));
  const denominator = PRICE_SCALE * tokenPriceE18;
  // Use ceil division: (numerator + denominator - 1) / denominator
  const baseAmount = (numerator + denominator - 1n) / denominator;
  // Apply safety margin (convert to bigint with proper precision)
  const marginNumerator = BigInt(Math.ceil(safetyMargin * 100));
  const marginDenominator = 100n;
  return (baseAmount * marginNumerator + marginDenominator - 1n) / marginDenominator;
}

/** Build FeeBreakdown from quote, prices (E18), and estimated gas. */
export function buildFeeBreakdown(params: {
  gas: bigint;
  gasPriceWei: bigint;
  ethPriceE18: bigint;
  tokenPriceE18: bigint;
  tokenDecimals: number;
  /** Safety margin to cover gas/price volatility (default: 1.2 = 20%) */
  safetyMargin?: number;
}): FeeBreakdown {
  const safetyMargin = params.safetyMargin ?? DEFAULT_SAFETY_MARGIN;
  const paymentAmount = calculatePaymentAmount({ ...params, safetyMargin });
  return {
    gas: params.gas,
    gasPriceWei: params.gasPriceWei,
    ethPriceE18: params.ethPriceE18,
    tokenPriceE18: params.tokenPriceE18,
    ethPrice: Number(params.ethPriceE18) / SCALE,
    tokenPrice: Number(params.tokenPriceE18) / SCALE,
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
