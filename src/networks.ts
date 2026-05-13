/**
 * Built-in chain defaults.
 *
 * Once `chainId` is known, every other config field (RPC, bundler URL,
 * deployed contract addresses) is derivable. Consumers can therefore
 * construct a {@link GasPaymentClient} with no arguments at all, or
 * just `{ chainId }`, and rely on the bundled defaults. Any explicitly
 * passed field overrides the default.
 */

/** Default chain ID used when the consumer omits `chainId`. */
export const DEFAULT_CHAIN_ID = 84532; // Base Sepolia

/** Per-chain defaults that the SDK ships with. */
export interface ChainDefaults {
  /** EIP-155 chain ID. */
  chainId: number;
  /** Default JSON-RPC endpoint (public; override for production traffic). */
  rpcUrl: string;
  /** Default bundler REST endpoint. */
  apiBaseUrl: string;
  /** Deployed EntryPoint contract. */
  entryPointAddress: `0x${string}`;
  /** Deployed ERC3009 wrapper used for gas payment. */
  erc3009TokenAddress: `0x${string}`;
  /** PoolPaymaster contract (also serves as the ERC3009 receiver). */
  paymentTargetContract: `0x${string}`;
}

/** Bundled defaults, keyed by chain ID. */
export const CHAIN_DEFAULTS: Record<number, ChainDefaults> = {
  // Base Sepolia
  84532: {
    chainId: 84532,
    rpcUrl: "https://sepolia.base.org",
    apiBaseUrl: "http://47.236.240.1:8088/api/v1",
    entryPointAddress: "0x598971199fED81FBE9c1d2E90d6Cc05Ba21331DD",
    erc3009TokenAddress: "0xdAF1bAe7C2b038D2CAe65Aa3d0dbdB026b920fe3",
    paymentTargetContract: "0x9631A0fE8081641d5c24C5BD575C638Fb42CF2C8",
  },
};

/** Lookup defaults for a chain ID. Returns `undefined` when none ship with the SDK. */
export function getChainDefaults(chainId: number): ChainDefaults | undefined {
  return CHAIN_DEFAULTS[chainId];
}
