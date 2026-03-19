import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { HttpClient } from "./httpClient";
import { SdkHttpError } from "./types";

describe("HttpClient", () => {
  const baseUrl = "https://api.test.com/v1";
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function respondOk(data: unknown) {
    fetchMock.mockResolvedValueOnce({
      status: 200,
      json: () => Promise.resolve({ code: 200, message: "ok", data }),
    });
  }

  function respondFail(code: number, message: string) {
    fetchMock.mockResolvedValueOnce({
      status: 200,
      json: () => Promise.resolve({ code, message }),
    });
  }

  describe("getTokenPrice", () => {
    it("calls GET /bundler/price and returns data.price", async () => {
      const client = new HttpClient({ apiBaseUrl: baseUrl });
      respondOk({ price: "1000000000000000000" });
      const res = await client.getTokenPrice();
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/bundler/price"),
        expect.objectContaining({ method: "GET" })
      );
      expect(res).toEqual({ price: "1000000000000000000" });
    });

    it("appends symbol query when provided", async () => {
      const client = new HttpClient({ apiBaseUrl: baseUrl });
      respondOk({ price: "2000000000000000000" });
      await client.getTokenPrice({ symbol: "ETH" });
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\?.*symbol=ETH/),
        expect.any(Object)
      );
    });

    it("throws SdkHttpError when code !== 200", async () => {
      const client = new HttpClient({ apiBaseUrl: baseUrl });
      respondFail(-1, "Server error");
      await expect(client.getTokenPrice()).rejects.toThrow(SdkHttpError);
    });
  });

  describe("postQuote", () => {
    it("calls POST /bundler/quote and returns quote", async () => {
      const client = new HttpClient({ apiBaseUrl: baseUrl });
      respondOk({
        baseFee: "10000000000",
        priorityFee: "2000000000",
        gasLimit: 150000,
      });
      const res = await client.postQuote({});
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/bundler/quote"),
        expect.objectContaining({
          method: "POST",
          body: "{}",
        })
      );
      expect(res.baseFee).toBe("10000000000");
      expect(res.gasLimit).toBe(150000);
    });
  });

  describe("postSubmit", () => {
    it("calls POST /bundler/submit with SubmitRequest and returns requestId", async () => {
      const client = new HttpClient({ apiBaseUrl: baseUrl });
      respondOk({ requestId: "req-123" });
      const res = await client.postSubmit({
        sender: "0xaaa",
        target: "0xbbb",
        nonce: 0,
        callData: "0x",
        signature: "0x",
      });
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/bundler/submit"),
        expect.objectContaining({ method: "POST" })
      );
      expect(res.requestId).toBe("req-123");
    });
  });

  describe("getStatus", () => {
    it("calls GET /bundler/status/:id and returns status", async () => {
      const client = new HttpClient({ apiBaseUrl: baseUrl });
      respondOk({
        requestId: "req-123",
        status: "pending",
        txHash: "0xabc",
      });
      const res = await client.getStatus("req-123");
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/bundler/status/req-123"),
        expect.objectContaining({ method: "GET" })
      );
      expect(res.requestId).toBe("req-123");
      expect(res.status).toBe("pending");
      expect(res.txHash).toBe("0xabc");
    });

    it("encodes request id in URL", async () => {
      const client = new HttpClient({ apiBaseUrl: baseUrl });
      respondOk({ requestId: "id/with/slash", status: "ok" });
      await client.getStatus("id/with/slash");
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("id%2Fwith%2Fslash"),
        expect.any(Object)
      );
    });
  });

  describe("apiKey", () => {
    it("sends Authorization header when apiKey is set", async () => {
      const client = new HttpClient({
        apiBaseUrl: baseUrl,
        apiKey: "secret",
      });
      respondOk({ price: "0" });
      await client.getTokenPrice();
      expect(fetchMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer secret",
          }),
        })
      );
    });
  });
});
