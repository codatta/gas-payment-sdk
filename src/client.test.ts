import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GasPaymentClient } from "./client";
import { ValidationError } from "./types";

const validConfig = {
  apiBaseUrl: "https://api.test.com/v1",
  rpcUrl: "https://eth.llamarpc.com",
  chainId: 1,
  entryPointAddress: "0x0000000000000000000000000000000000000001" as `0x${string}`,
  erc3009TokenAddress: "0x0000000000000000000000000000000000000002" as `0x${string}`,
  paymentTargetContract: "0x0000000000000000000000000000000000000003" as `0x${string}`,
};

describe("GasPaymentClient", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function respondOk(data: unknown) {
    fetchMock.mockResolvedValue({
      status: 200,
      json: () => Promise.resolve({ code: 200, message: "ok", data }),
    });
  }

  describe("constructor", () => {
    it("throws ValidationError when apiBaseUrl is empty", () => {
      expect(
        () =>
          new GasPaymentClient({
            ...validConfig,
            apiBaseUrl: "  ",
          })
      ).toThrow(ValidationError);
    });

    it("throws ValidationError when rpcUrl is empty", () => {
      expect(
        () =>
          new GasPaymentClient({
            ...validConfig,
            rpcUrl: "",
          })
      ).toThrow(ValidationError);
    });

    it("throws ValidationError when entryPointAddress is missing", () => {
      expect(
        () =>
          new GasPaymentClient({
            ...validConfig,
            entryPointAddress: undefined as unknown as `0x${string}`,
          })
      ).toThrow(ValidationError);
    });

    it("creates client with valid config", () => {
      const client = new GasPaymentClient(validConfig);
      expect(client).toBeDefined();
    });
  });

  describe("getTokenPrice", () => {
    it("returns tokenPerETH from backend", async () => {
      respondOk({ tokenPerETH: "2500000000" });
      const client = new GasPaymentClient(validConfig);
      const res = await client.getTokenPrice();
      expect(res.tokenPerETH).toBe(2500000000n);
    });
  });

  describe("getQuote", () => {
    it("returns quote and gasPriceWei from backend", async () => {
      respondOk({
        baseFee: "10000000000",
        priorityFee: "1000000000",
        gasLimit: 150000,
      });
      const client = new GasPaymentClient(validConfig);
      const { quote, gasPriceWei } = await client.getQuote();
      expect(quote.baseFee).toBe("10000000000");
      expect(quote.gasLimit).toBe(150000);
      expect(gasPriceWei).toBe(11_000_000_000n);
    });
  });

  describe("submitPayment", () => {
    it("sends userOp and signature to POST /bundler/submit and returns requestId", async () => {
      respondOk({ requestId: "sub-456" });
      const client = new GasPaymentClient(validConfig);
      const result = await client.submitPayment({
        userOp: {
          sender: "0xa" as `0x${string}`,
          target: "0xb" as `0x${string}`,
          nonce: 0n,
          callData: "0x" as `0x${string}`,
          callGasLimit: 100_000n,
          verificationGasLimit: 50_000n,
          preVerificationGas: 21_000n,
          maxFeePerGas: 30n * 10n ** 9n,
          maxPriorityFeePerGas: 2n * 10n ** 9n,
          paymasterAndData: "0x" as `0x${string}`,
          signature: "0x" as `0x${string}`,
        },
        signature: "0x1234" as `0x${string}`,
      });
      expect(result.requestId).toBe("sub-456");
      const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(callBody.sender).toBe("0xa");
      expect(callBody.token).toBe(validConfig.erc3009TokenAddress);
      expect(callBody.signature).toBe("0x1234");
    });
  });

  describe("getStatus", () => {
    it("calls GET /bundler/status/:id and returns status", async () => {
      respondOk({
        requestId: "req-1",
        status: "mined",
        txHash: "0xabc",
      });
      const client = new GasPaymentClient(validConfig);
      const status = await client.getStatus("req-1");
      expect(status.status).toBe("mined");
      expect(status.txHash).toBe("0xabc");
    });
  });

  describe("preparePayment", () => {
    it("throws ValidationError when token price is 0", async () => {
      fetchMock
        .mockResolvedValueOnce({
          status: 200,
          json: () =>
            Promise.resolve({
              code: 200,
              message: "ok",
              data: { baseFee: "10000000000", priorityFee: "1000000000", gasLimit: 150_000 },
            }),
        })
        .mockResolvedValueOnce({
          status: 200,
          json: () => Promise.resolve({ code: 200, message: "ok", data: { tokenPerETH: "0" } }),
        });
      const client = new GasPaymentClient(validConfig);
      await expect(
        client.preparePayment({
          sender: "0x0000000000000000000000000000000000000002" as `0x${string}`,
          target: validConfig.paymentTargetContract,
          callData: "0x" as `0x${string}`,
        })
      ).rejects.toThrow(ValidationError);
    });
  });
});
