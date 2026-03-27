import type { PreparedTx } from "../types";
import type { Address, PublicClient } from "viem";
import { encodePacked } from "viem";
import { EIP712_DOMAIN_EIP5267_ABI } from "./constants";

/** EIP-3009 TransferWithAuthorization typed data for signing */
export interface TransferWithAuthorizationTypedData {
  domain: {
    name: string;
    version: string;
    chainId: number;
    verifyingContract: Address;
  };
  types: {
    TransferWithAuthorization: [
      { name: "from"; type: "address" },
      { name: "to"; type: "address" },
      { name: "value"; type: "uint256" },
      { name: "validAfter"; type: "uint256" },
      { name: "validBefore"; type: "uint256" },
      { name: "nonce"; type: "bytes32" },
    ];
  };
  primaryType: "TransferWithAuthorization";
  message: {
    from: Address;
    to: Address;
    value: bigint;
    validAfter: bigint;
    validBefore: bigint;
    nonce: `0x${string}`;
  };
}

/** EIP-712 domain as used by ERC3009 tokens. */
export interface Eip712Domain {
  name: string;
  version: string;
  chainId: number;
  verifyingContract: Address;
  salt?: `0x${string}`;
}

/** Parameters for building TransferWithAuthorization typed data from an explicit domain. */
export interface TransferWithAuthorizationParams {
  domain: {
    name: string;
    version: string;
    chainId: number;
    verifyingContract: Address;
  };
  from: Address;
  to: Address;
  value: bigint;
  validAfter: bigint;
  validBefore: bigint;
  nonce: `0x${string}`;
}

/**
 * Build EIP-712 `TransferWithAuthorization` typed data from an explicit domain and message.
 *
 * Use this when you already have the token's EIP-712 domain (e.g. from {@link fetchEip712DomainFromToken}).
 *
 * @param params - The domain, sender, receiver, value, validity window, and nonce.
 * @returns A fully structured {@link TransferWithAuthorizationTypedData} ready for `signTypedData`.
 */
export function buildTransferWithAuthorizationTypedData(
  params: TransferWithAuthorizationParams
): TransferWithAuthorizationTypedData {
  const { domain, from, to, value, validAfter, validBefore, nonce } = params;
  return {
    domain: {
      name: domain.name,
      version: domain.version,
      chainId: domain.chainId,
      verifyingContract: domain.verifyingContract,
    },
    types: {
      TransferWithAuthorization: [
        { name: "from", type: "address" },
        { name: "to", type: "address" },
        { name: "value", type: "uint256" },
        { name: "validAfter", type: "uint256" },
        { name: "validBefore", type: "uint256" },
        { name: "nonce", type: "bytes32" },
      ],
    },
    primaryType: "TransferWithAuthorization",
    message: {
      from,
      to,
      value,
      validAfter,
      validBefore,
      nonce,
    },
  };
}

/**
 * Build an EIP-3009 `TransferWithAuthorization` typed data payload and a {@link PreparedTx}.
 *
 * The caller signs the returned `typedData`; the signed authorization is then submitted
 * to the token contract by the bundler.
 *
 * @param params - Payment parameters including `token`, `from`, `to`, `amount`, `chainId`, and optional `validAfter`, `validBefore`, `nonce`, `tokenName`, `tokenVersion`.
 * @returns The EIP-712 typed data for signing and a {@link PreparedTx} envelope.
 */
export function buildErc3009Payment(params: {
  token: Address;
  from: Address;
  to: Address;
  amount: bigint;
  validAfter?: number;
  validBefore?: number;
  nonce?: `0x${string}`;
  chainId: number;
  tokenName?: string;
  tokenVersion?: string;
}): { typedData: TransferWithAuthorizationTypedData; preparedTx: PreparedTx } {
  const validAfter = BigInt(params.validAfter ?? 0);
  const validBefore = BigInt(
    params.validBefore ?? Math.floor(Date.now() / 1000) + 3600
  );
  const nonce =
    params.nonce ??
    (`0x${"00".repeat(32)}` as `0x${string}`); // caller should use a real random nonce

  const typedData: TransferWithAuthorizationTypedData = {
    domain: {
      name: params.tokenName ?? "USD Coin",
      version: params.tokenVersion ?? "2",
      chainId: params.chainId,
      verifyingContract: params.token,
    },
    types: {
      TransferWithAuthorization: [
        { name: "from", type: "address" },
        { name: "to", type: "address" },
        { name: "value", type: "uint256" },
        { name: "validAfter", type: "uint256" },
        { name: "validBefore", type: "uint256" },
        { name: "nonce", type: "bytes32" },
      ],
    },
    primaryType: "TransferWithAuthorization",
    message: {
      from: params.from,
      to: params.to,
      value: params.amount,
      validAfter,
      validBefore,
      nonce,
    },
  };

  const preparedTx: PreparedTx = {
    to: params.token,
    data: "0x" as `0x${string}`, // actual call is transferWithAuthorization(..., v, r, s) by submitter
    typedData: typedData as unknown as Record<string, unknown>,
  };

  return { typedData, preparedTx };
}

/**
 * Build the `paymasterAndData` bytes for ERC3009-based gas payment.
 *
 * Encodes the paymaster address and ERC3009 authorization signature via `abi.encodePacked`:
 * ```
 * paymaster | paymentType | expectedSender | erc3009Receiver |
 * value | validAfter | validBefore | nonce | v | r | s
 * ```
 *
 * @param params - All fields for packed encoding: `paymaster`, `paymentType`, `expectedSender`, `erc3009Receiver`, `value`, `validAfter`, `validBefore`, `nonce`, `v`, `r`, `s`.
 * @returns The ABI-packed `paymasterAndData` hex string.
 */
export function buildErc3009PaymasterAndData(params: {
  paymaster: Address;
  paymentType: number;
  expectedSender: Address;
  erc3009Receiver: Address;
  value: bigint;
  validAfter: bigint;
  validBefore: bigint;
  nonce: `0x${string}`;
  v: number;
  r: `0x${string}`;
  s: `0x${string}`;
}): `0x${string}` {
  const {
    paymaster,
    paymentType,
    expectedSender,
    erc3009Receiver,
    value,
    validAfter,
    validBefore,
    nonce,
    v,
    r,
    s,
  } = params;
  return encodePacked(
    [
      "address",
      "uint8",
      "address",
      "address",
      "uint256",
      "uint256",
      "uint256",
      "bytes32",
      "uint8",
      "bytes32",
      "bytes32",
    ],
    [
      paymaster,
      paymentType,
      expectedSender,
      erc3009Receiver,
      value,
      validAfter,
      validBefore,
      nonce,
      v,
      r,
      s,
    ],
  ) as `0x${string}`;
}

/**
 * Fetch the EIP-712 domain from an ERC3009 token using the EIP-5267 `eip712Domain()` function.
 *
 * Falls back to `fallbackName` / `fallbackVersion` when the contract does not implement EIP-5267.
 *
 * @param params - Query parameters: `provider`, `token`, `chainId`, and optional `fallbackName` / `fallbackVersion`.
 * @returns The token's {@link Eip712Domain}.
 */
export async function fetchEip712DomainFromToken(params: {
  provider: PublicClient;
  token: Address;
  chainId: number;
  /** Optional fallback name when eip712Domain() is not available. */
  fallbackName?: string;
  /** Optional fallback version when eip712Domain() is not available. */
  fallbackVersion?: string;
}): Promise<Eip712Domain> {
  const { provider, token, chainId, fallbackName, fallbackVersion } = params;
  try {
    const res = (await provider.readContract({
      address: token,
      abi: EIP712_DOMAIN_EIP5267_ABI,
      functionName: "eip712Domain",
      args: [],
    })) as readonly [
      unknown,
      string,
      string,
      bigint,
      `0x${string}`,
      `0x${string}`,
      readonly bigint[],
    ];
    const [, name, version, domainChainId, verifyingContract, salt] = res;
    const domain: Eip712Domain = {
      name,
      version,
      chainId: Number(domainChainId),
      verifyingContract,
    };
    if (
      salt &&
      salt !==
        "0x0000000000000000000000000000000000000000000000000000000000000000"
    ) {
      domain.salt = salt;
    }
    return domain;
  } catch {
    return {
      name: fallbackName ?? "Token",
      version: fallbackVersion ?? "1",
      chainId,
      verifyingContract: token,
    };
  }
}
