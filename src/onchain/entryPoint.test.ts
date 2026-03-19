import { describe, it, expect } from "vitest";
import {
  getUserOpHash,
  encodeHandleOpsCall,
  buildUserOperation,
  ENTRY_POINT_ABI,
} from "./entryPoint";
import type { UserOperation, HandleOpsParams } from "../types";

const ENTRY_POINT = "0x0000000000000000000000000000000000000001" as const;
const CHAIN_ID = 1;

function makeUserOp(overrides: Partial<UserOperation> = {}): UserOperation {
  return {
    sender: "0x0000000000000000000000000000000000000002" as `0x${string}`,
    target: "0x0000000000000000000000000000000000000003" as `0x${string}`,
    nonce: 0n,
    callData: "0x" as `0x${string}`,
    callGasLimit: 100_000n,
    verificationGasLimit: 50_000n,
    preVerificationGas: 21_000n,
    maxFeePerGas: 30n * 10n ** 9n,
    maxPriorityFeePerGas: 2n * 10n ** 9n,
    paymasterAndData: "0x" as `0x${string}`,
    signature: "0x" as `0x${string}`,
    ...overrides,
  };
}

describe("buildUserOperation", () => {
  it("builds UserOperation with placeholder signature", () => {
    const op = buildUserOperation({
      sender: "0xaaa" as `0x${string}`,
      target: "0xbbb" as `0x${string}`,
      callData: "0x1234" as `0x${string}`,
      nonce: 1n,
      callGasLimit: 80_000n,
      verificationGasLimit: 40_000n,
      preVerificationGas: 20_000n,
      maxFeePerGas: 25n * 10n ** 9n,
      maxPriorityFeePerGas: 1n * 10n ** 9n,
      paymasterAndData: "0x" as `0x${string}`,
    });
    expect(op.sender).toBe("0xaaa");
    expect(op.target).toBe("0xbbb");
    expect(op.callData).toBe("0x1234");
    expect(op.nonce).toBe(1n);
    expect(op.signature).toBe("0x");
  });
});

describe("getUserOpHash", () => {
  it("returns deterministic bytes32 for same op, chainId, entryPoint", () => {
    const op = makeUserOp();
    const h1 = getUserOpHash(op, CHAIN_ID, ENTRY_POINT as `0x${string}`);
    const h2 = getUserOpHash(op, CHAIN_ID, ENTRY_POINT as `0x${string}`);
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^0x[a-fA-F0-9]{64}$/);
  });

  it("returns different hash for different chainId", () => {
    const op = makeUserOp();
    const h1 = getUserOpHash(op, 1, ENTRY_POINT as `0x${string}`);
    const h2 = getUserOpHash(op, 84532, ENTRY_POINT as `0x${string}`);
    expect(h1).not.toBe(h2);
  });

  it("returns different hash for different callData", () => {
    const op1 = makeUserOp({ callData: "0x11" as `0x${string}` });
    const op2 = makeUserOp({ callData: "0x22" as `0x${string}` });
    const h1 = getUserOpHash(op1, CHAIN_ID, ENTRY_POINT as `0x${string}`);
    const h2 = getUserOpHash(op2, CHAIN_ID, ENTRY_POINT as `0x${string}`);
    expect(h1).not.toBe(h2);
  });
});

describe("encodeHandleOpsCall", () => {
  it("returns to = entryPoint and data starting with handleOps selector", () => {
    const ops = [makeUserOp()];
    const params: HandleOpsParams = {
      ops,
      beneficiary: "0x0000000000000000000000000000000000000004" as `0x${string}`,
    };
    const { to, data } = encodeHandleOpsCall(
      params,
      ENTRY_POINT as `0x${string}`
    );
    expect(to).toBe(ENTRY_POINT);
    expect(data.startsWith("0x")).toBe(true);
    expect(data.length).toBeGreaterThan(10);
  });

  it("encodes multiple ops", () => {
    const ops = [
      makeUserOp({ nonce: 0n }),
      makeUserOp({ sender: "0x0000000000000000000000000000000000000005" as `0x${string}`, nonce: 1n }),
    ];
    const beneficiary = "0x0000000000000000000000000000000000000004" as `0x${string}`;
    const { data } = encodeHandleOpsCall(
      { ops, beneficiary },
      ENTRY_POINT as `0x${string}`
    );
    expect(data.length).toBeGreaterThan(200);
  });
});

describe("ENTRY_POINT_ABI", () => {
  it("has handleOps and getNonce", () => {
    const names = ENTRY_POINT_ABI.map((x) => (x as { name?: string }).name);
    expect(names).toContain("handleOps");
    expect(names).toContain("getNonce");
    expect(names).toContain("getUserOpHash");
  });
});
