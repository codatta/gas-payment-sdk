import type { Address } from "viem";

/** Default WETH contract address on Base (and Base Sepolia). */
export const DEFAULT_WETH_BASE =
  "0x4200000000000000000000000000000000000006" as Address;

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
