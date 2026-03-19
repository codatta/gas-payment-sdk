import {
  type Address,
  encodeFunctionData,
  keccak256,
  encodeAbiParameters,
  parseAbiParameters,
} from "viem";
import type { UserOperation, HandleOpsParams, BuildUserOpParams } from "../types";

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
 * Compute userOpHash as in EntryPoint.getUserOpHash (keccak256 of abi.encode(chainId, entryPoint, ...)).
 */
export function getUserOpHash(
  op: UserOperation,
  chainId: number,
  entryPointAddress: Address
): `0x${string}` {
  const encoded = encodeAbiParameters(
    parseAbiParameters(
      "uint256, address, address, address, uint256, bytes32, uint256, uint256, uint256, uint256, uint256, bytes32"
    ),
    [
      BigInt(chainId),
      entryPointAddress,
      op.sender as Address,
      op.target as Address,
      op.nonce,
      keccak256(op.callData as `0x${string}`),
      op.callGasLimit,
      op.verificationGasLimit,
      op.preVerificationGas,
      op.maxFeePerGas,
      op.maxPriorityFeePerGas,
      keccak256(op.paymasterAndData as `0x${string}`),
    ]
  );
  return keccak256(encoded as `0x${string}`);
}

/**
 * Encode handleOps(ops, beneficiary) calldata for EntryPoint.
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
 * Build UserOperation struct (signature can be placeholder 0x for estimation).
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
