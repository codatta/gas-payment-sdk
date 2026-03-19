import { describe, it, expect } from "vitest";
import { buildErc3009Payment } from "./erc3009";

const token = "0x0000000000000000000000000000000000000001" as `0x${string}`;
const from = "0x0000000000000000000000000000000000000002" as `0x${string}`;
const to = "0x0000000000000000000000000000000000000003" as `0x${string}`;

describe("buildErc3009Payment", () => {
  it("returns typedData and preparedTx with correct domain and message", () => {
    const { typedData, preparedTx } = buildErc3009Payment({
      token,
      from,
      to,
      amount: 1_000_000n,
      chainId: 1,
    });
    expect(typedData.domain.verifyingContract).toBe(token);
    expect(typedData.domain.chainId).toBe(1);
    expect(typedData.domain.name).toBe("USD Coin");
    expect(typedData.domain.version).toBe("2");
    expect(typedData.primaryType).toBe("TransferWithAuthorization");
    expect(typedData.message.from).toBe(from);
    expect(typedData.message.to).toBe(to);
    expect(typedData.message.value).toBe(1_000_000n);
    expect(typedData.types.TransferWithAuthorization).toHaveLength(6);

    expect(preparedTx.to).toBe(token);
    expect(preparedTx.data).toBe("0x");
    expect(preparedTx.typedData).toBeDefined();
  });

  it("uses custom token name and version", () => {
    const { typedData } = buildErc3009Payment({
      token,
      from,
      to,
      amount: 0n,
      chainId: 84532,
      tokenName: "My Token",
      tokenVersion: "1",
    });
    expect(typedData.domain.name).toBe("My Token");
    expect(typedData.domain.version).toBe("1");
    expect(typedData.domain.chainId).toBe(84532);
  });

  it("uses provided nonce and validAfter/validBefore", () => {
    const nonce = "0x" + "ab".repeat(32) as `0x${string}`;
    const { typedData } = buildErc3009Payment({
      token,
      from,
      to,
      amount: 100n,
      chainId: 1,
      validAfter: 1000,
      validBefore: 2000,
      nonce,
    });
    expect(typedData.message.validAfter).toBe(1000n);
    expect(typedData.message.validBefore).toBe(2000n);
    expect(typedData.message.nonce).toBe(nonce);
  });
});
