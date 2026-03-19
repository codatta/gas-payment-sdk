import type { PublicClient } from "viem";
import type { Address } from "viem";
import { PRICE_SCALE } from "../price";

const FACTORY_ABI = [
  {
    inputs: [
      { name: "tokenA", type: "address" },
      { name: "tokenB", type: "address" },
      { name: "fee", type: "uint24" },
    ],
    name: "getPool",
    outputs: [{ name: "pool", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

const POOL_ABI = [
  {
    inputs: [],
    name: "slot0",
    outputs: [
      { name: "sqrtPriceX96", type: "uint160" },
      { name: "tick", type: "int24" },
      { name: "observationIndex", type: "uint16" },
      { name: "observationCardinality", type: "uint16" },
      { name: "observationCardinalityNext", type: "uint16" },
      { name: "feeProtocol", type: "uint8" },
      { name: "unlocked", type: "bool" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "token0",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "token1",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

const Q192 = 2n ** 192n;

/**
 * Get Uniswap V3 pool address from Factory. Token order for getPool is arbitrary.
 */
export async function getPoolAddress(
  client: PublicClient,
  factoryAddress: Address,
  tokenA: Address,
  tokenB: Address,
  feeTier: number
): Promise<Address> {
  const pool = await client.readContract({
    address: factoryAddress,
    abi: FACTORY_ABI,
    functionName: "getPool",
    args: [tokenA, tokenB, feeTier],
  });
  return pool as Address;
}

/** True if token0 < token1 by address (canonical Uniswap order). */
export function isToken0(tokenA: Address, tokenB: Address): boolean {
  return tokenA.toLowerCase() < tokenB.toLowerCase();
}

export interface EthPriceFromPoolOptions {
  /** True if WETH is token0 in the pool (e.g. WETH/USDC with WETH < USDC by address) */
  wethIsToken0: boolean;
  /** WETH decimals (default 18) */
  wethDecimals?: number;
  /** Quote token decimals (e.g. 6 for USDC) */
  quoteDecimals?: number;
}

/**
 * Get ETH price (quote token per 1 ETH, e.g. USD per ETH) from a Uniswap V3 pool.
 * Uses slot0().sqrtPriceX96: price_raw = token1/token0 (raw units) = (sqrtPriceX96)^2 / 2^192.
 */
export async function getEthPriceFromPool(
  client: PublicClient,
  poolAddress: `0x${string}`,
  options: EthPriceFromPoolOptions
): Promise<{ priceE18: bigint; price: string }> {
  const wethDecimals = options.wethDecimals ?? 18;
  const quoteDecimals = options.quoteDecimals ?? 6;

  const slot0 = await client.readContract({
    address: poolAddress,
    abi: POOL_ABI,
    functionName: "slot0",
  });
  const sqrtPriceX96 = (slot0 as unknown as [bigint])[0];
  const sqrtPriceSq = sqrtPriceX96 * sqrtPriceX96;

  // Avoid BigInt truncation: (sqrtPriceX96)^2 / 2^192 can be < 1 so integer division => 0.
  // Compute quotePerEthRaw by (10^wethDecimals * sqrtPriceSq) / Q192 or (10^wethDecimals * Q192) / sqrtPriceSq.
  let quotePerEthRaw: bigint;
  if (options.wethIsToken0) {
    quotePerEthRaw = (BigInt(10 ** wethDecimals) * sqrtPriceSq) / Q192;
  } else {
    quotePerEthRaw = (BigInt(10 ** wethDecimals) * Q192) / sqrtPriceSq;
  }

  // Price in 10^18: priceE18 = quotePerEthRaw * 10^18 / 10^quoteDecimals (all BigInt).
  const quoteScale = 10n ** BigInt(quoteDecimals);
  const priceE18 = (quotePerEthRaw * PRICE_SCALE) / quoteScale;
  const priceString = (Number(priceE18) / 1e18).toFixed(quoteDecimals);

  return { priceE18, price: priceString };
}
