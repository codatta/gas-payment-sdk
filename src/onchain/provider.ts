import { createPublicClient, http, type PublicClient } from "viem";

/**
 * Create a viem `PublicClient` for the given RPC URL and chain ID.
 *
 * Uses the HTTP transport and works in both Node.js and browser environments.
 *
 * @param rpcUrl - The JSON-RPC endpoint URL.
 * @param chainId - The numeric chain ID (e.g. 8453 for Base).
 * @returns A viem `PublicClient` instance.
 */
export function createProvider(rpcUrl: string, chainId: number): PublicClient {
  return createPublicClient({
    transport: http(rpcUrl),
    chain: {
      id: chainId,
      name: "Custom",
      nativeCurrency: { decimals: 18, name: "Ether", symbol: "ETH" },
      rpcUrls: { default: { http: [rpcUrl] } },
    },
  });
}
