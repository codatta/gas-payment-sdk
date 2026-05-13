import {
  type Address,
  encodeFunctionData,
  hashTypedData,
} from "viem";
import type {
  UserOperation,
  HandleOpsParams,
  BuildUserOpParams,
  UserOperationTypedData,
} from "../types";

/** EIP-712 domain name used by `EntryPoint` for `UserOperation` signing. */
export const USER_OP_DOMAIN_NAME = "Humanbased Gas Bundler";

/** EIP-712 domain version used by `EntryPoint` for `UserOperation` signing. */
export const USER_OP_DOMAIN_VERSION = "1";

/** EIP-712 type definitions for `UserOperation`. Field order matches `IEntryPoint.UserOperation`, excluding `signature`. */
export const USER_OPERATION_TYPES = {
  UserOperation: [
    { name: "sender", type: "address" },
    { name: "target", type: "address" },
    { name: "nonce", type: "uint256" },
    { name: "callData", type: "bytes" },
    { name: "callGasLimit", type: "uint256" },
    { name: "verificationGasLimit", type: "uint256" },
    { name: "preVerificationGas", type: "uint256" },
    { name: "maxFeePerGas", type: "uint256" },
    { name: "maxPriorityFeePerGas", type: "uint256" },
    { name: "paymasterAndData", type: "bytes" },
  ],
} as const;

/** ABI fragment for the EntryPoint contract (`handleOps`, `getUserOpHash`, `getNonce`). */
export const ENTRY_POINT_ABI = [
  {
    inputs: [
      {
        components: [
          { name: "sender", type: "address" },
          { name: "target", type: "address" },
          { name: "nonce", type: "uint256" },
          { name: "callData", type: "bytes" },
          { name: "callGasLimit", type: "uint256" },
          { name: "verificationGasLimit", type: "uint256" },
          { name: "preVerificationGas", type: "uint256" },
          { name: "maxFeePerGas", type: "uint256" },
          { name: "maxPriorityFeePerGas", type: "uint256" },
          { name: "paymasterAndData", type: "bytes" },
          { name: "signature", type: "bytes" },
        ],
        name: "ops",
        type: "tuple[]",
      },
      { name: "beneficiary", type: "address" },
    ],
    name: "handleOps",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        components: [
          { name: "sender", type: "address" },
          { name: "target", type: "address" },
          { name: "nonce", type: "uint256" },
          { name: "callData", type: "bytes" },
          { name: "callGasLimit", type: "uint256" },
          { name: "verificationGasLimit", type: "uint256" },
          { name: "preVerificationGas", type: "uint256" },
          { name: "maxFeePerGas", type: "uint256" },
          { name: "maxPriorityFeePerGas", type: "uint256" },
          { name: "paymasterAndData", type: "bytes" },
          { name: "signature", type: "bytes" },
        ],
        name: "op",
        type: "tuple",
      },
    ],
    name: "getUserOpHash",
    outputs: [{ name: "", type: "bytes32" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "sender", type: "address" },
      { name: "key", type: "uint192" },
    ],
    name: "getNonce",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

function userOpToTuple(op: UserOperation) {
  return {
    sender: op.sender as Address,
    target: op.target as Address,
    nonce: op.nonce,
    callData: op.callData as `0x${string}`,
    callGasLimit: op.callGasLimit,
    verificationGasLimit: op.verificationGasLimit,
    preVerificationGas: op.preVerificationGas,
    maxFeePerGas: op.maxFeePerGas,
    maxPriorityFeePerGas: op.maxPriorityFeePerGas,
    paymasterAndData: op.paymasterAndData as `0x${string}`,
    signature: op.signature as `0x${string}`,
  };
}

/**
 * Build the EIP-712 typed-data envelope for signing a UserOperation.
 *
 * Pass the returned value directly to `walletClient.signTypedData(...)` or
 * `account.signTypedData(...)` to produce `op.signature`.
 *
 * @param op - The UserOperation to wrap (its `signature` field is ignored).
 * @param chainId - The chain ID for the EIP-712 domain separator.
 * @param entryPointAddress - The deployed EntryPoint contract address (`verifyingContract`).
 * @returns A typed-data envelope ready for `signTypedData`.
 */
export function buildUserOperationTypedData(
  op: UserOperation,
  chainId: number,
  entryPointAddress: Address
): UserOperationTypedData {
  return {
    domain: {
      name: USER_OP_DOMAIN_NAME,
      version: USER_OP_DOMAIN_VERSION,
      chainId,
      verifyingContract: entryPointAddress,
    },
    types: USER_OPERATION_TYPES,
    primaryType: "UserOperation",
    message: {
      sender: op.sender as Address,
      target: op.target as Address,
      nonce: op.nonce,
      callData: op.callData as `0x${string}`,
      callGasLimit: op.callGasLimit,
      verificationGasLimit: op.verificationGasLimit,
      preVerificationGas: op.preVerificationGas,
      maxFeePerGas: op.maxFeePerGas,
      maxPriorityFeePerGas: op.maxPriorityFeePerGas,
      paymasterAndData: op.paymasterAndData as `0x${string}`,
    },
  };
}

/**
 * Compute the `userOpHash` locally, matching `EntryPoint.getUserOpHash` on-chain.
 *
 * The hash is the EIP-712 typed-data digest of the UserOperation:
 * `keccak256("\x19\x01" || domainSeparator || keccak256(abi.encode(USER_OPERATION_TYPEHASH, ...)))`.
 *
 * Most users should call {@link buildUserOperationTypedData} and pass the result to
 * `signTypedData` — this function is provided for debugging and equality checks.
 *
 * @param op - The UserOperation to hash.
 * @param chainId - The chain ID for the EIP-712 domain separator.
 * @param entryPointAddress - The deployed EntryPoint contract address (`verifyingContract`).
 * @returns The 32-byte digest as a hex string.
 */
export function getUserOpHash(
  op: UserOperation,
  chainId: number,
  entryPointAddress: Address
): `0x${string}` {
  return hashTypedData(buildUserOperationTypedData(op, chainId, entryPointAddress));
}

/**
 * Encode the `handleOps(ops, beneficiary)` calldata for the EntryPoint contract.
 *
 * @param params - The operations array and beneficiary address.
 * @param entryPointAddress - The deployed EntryPoint contract address.
 * @returns An object with `to` (EntryPoint address) and `data` (ABI-encoded calldata).
 */
export function encodeHandleOpsCall(
  params: HandleOpsParams,
  entryPointAddress: Address
): { to: Address; data: `0x${string}` } {
  const tuples = params.ops.map(userOpToTuple);
  const data = encodeFunctionData({
    abi: ENTRY_POINT_ABI,
    functionName: "handleOps",
    args: [tuples, params.beneficiary as Address],
  });
  return {
    to: entryPointAddress,
    data,
  };
}

/**
 * Build a {@link UserOperation} struct from the given parameters.
 *
 * The `signature` field is set to `"0x"` (placeholder) — suitable for gas estimation
 * before the user signs.
 *
 * @param params - All UserOperation fields except `signature`.
 * @returns A complete {@link UserOperation} with a placeholder signature.
 */
export function buildUserOperation(params: BuildUserOpParams): UserOperation {
  return {
    sender: params.sender,
    target: params.target,
    nonce: params.nonce,
    callData: params.callData,
    callGasLimit: params.callGasLimit,
    verificationGasLimit: params.verificationGasLimit,
    preVerificationGas: params.preVerificationGas,
    maxFeePerGas: params.maxFeePerGas,
    maxPriorityFeePerGas: params.maxPriorityFeePerGas,
    paymasterAndData: params.paymasterAndData,
    signature: "0x" as `0x${string}`,
  };
}
