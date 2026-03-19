import type { Address } from "viem";

/** Default Uniswap V3 factory/WETH/USDC addresses and fee tiers for supported networks. */
export const DEFAULT_FACTORY_BASE =
  "0x33128a8fC17869897dcE68Ed026d694621f6FDfD" as Address;
export const DEFAULT_FACTORY_BASE_SEPOLIA =
  "0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24" as Address;
export const DEFAULT_WETH_BASE =
  "0x4200000000000000000000000000000000000006" as Address;
export const DEFAULT_USDC_BASE =
  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as Address;
/** Base Sepolia (84532) USDC test token */
export const DEFAULT_USDC_BASE_SEPOLIA =
  "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as Address;
export const DEFAULT_FEE_TIER = 500;

/** Minimal ERC20 ABI for balanceOf(address). */
export const ERC20_BALANCE_OF_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

/** EIP-5267: domain from contract eip712Domain(). */
export const EIP712_DOMAIN_EIP5267_ABI = [
  {
    name: "eip712Domain",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "fields", type: "bytes1" },
      { name: "name", type: "string" },
      { name: "version", type: "string" },
      { name: "chainId", type: "uint256" },
      { name: "verifyingContract", type: "address" },
      { name: "salt", type: "bytes32" },
      { name: "extensions", type: "uint256[]" },
    ],
  },
] as const;

/** Per-chain default config for ETH price pool (factory/WETH/quote/fee tier). */
export function getDefaultEthPriceConfig(chainId: number): {
  ethPriceFactoryAddress: Address;
  ethPriceWethAddress: Address;
  ethPriceQuoteTokenAddress: Address;
  ethPriceFeeTier: number;
} {
  const isBaseSepolia = chainId === 84532;
  return {
    ethPriceFactoryAddress: isBaseSepolia
      ? DEFAULT_FACTORY_BASE_SEPOLIA
      : DEFAULT_FACTORY_BASE,
    ethPriceWethAddress: DEFAULT_WETH_BASE,
    ethPriceQuoteTokenAddress: isBaseSepolia
      ? DEFAULT_USDC_BASE_SEPOLIA
      : DEFAULT_USDC_BASE,
    ethPriceFeeTier: DEFAULT_FEE_TIER,
  };
}

