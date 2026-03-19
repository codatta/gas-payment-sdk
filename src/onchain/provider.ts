import { createPublicClient, http, type PublicClient } from "viem";

/**
 * Create a public client for the given RPC URL.
 * Works in both Node.js and browser (uses fetch).
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
