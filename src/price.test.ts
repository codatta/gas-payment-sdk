import { describe, it, expect } from "vitest";
import {
  parsePriceResponse,
  calculatePaymentAmount,
  buildFeeBreakdown,
  normalizeQuote,
} from "./price";

describe("parsePriceResponse", () => {
  it("parses tokenPerETH string to bigint", () => {
    const out = parsePriceResponse({ tokenPerETH: "2500000000" }); // 2500 USDC (6 decimals)
    expect(out.tokenPerETH).toBe(2500000000n);
  });

  it("handles missing tokenPerETH as 0", () => {
    const out = parsePriceResponse({ tokenPerETH: "" });
    expect(out.tokenPerETH).toBe(0n);
  });

  it("handles invalid string as 0", () => {
    const out = parsePriceResponse({ tokenPerETH: "invalid" });
    expect(out.tokenPerETH).toBe(0n);
  });
});

describe("calculatePaymentAmount", () => {
  it("computes amount = gasCostWei * tokenPerETH / 1e18 * safetyMargin", () => {
    // 100000 gas * 20 Gwei = 2e15 wei gas cost = 0.002 ETH
    // tokenPerETH = 2500e6 (2500 USDC in smallest units per ETH)
    // expected: 0.002 ETH * 2500 USDC/ETH = 5 USDC = 5e6
    // with 20% margin: ceil(5e6 * 1.2) = 6e6
    const amount = calculatePaymentAmount({
      gas: 100_000n,
      gasPriceWei: 20n * 10n ** 9n,
      tokenPerETH: 2_500_000_000n, // 2500 USDC
      safetyMargin: 1.2,
    });
    expect(amount).toBe(6_000_000n);
  });

  it("computes without safety margin when safetyMargin=1.0", () => {
    const amount = calculatePaymentAmount({
      gas: 100_000n,
      gasPriceWei: 20n * 10n ** 9n,
      tokenPerETH: 2_500_000_000n,
      safetyMargin: 1.0,
    });
    // 2e15 * 2500e6 / 1e18 = 5000000
    expect(amount).toBe(5_000_000n);
  });

  it("returns 0 when tokenPerETH is 0", () => {
    const amount = calculatePaymentAmount({
      gas: 100_000n,
      gasPriceWei: 20n * 10n ** 9n,
      tokenPerETH: 0n,
    });
    expect(amount).toBe(0n);
  });

  it("rounds up result with ceil division", () => {
    // 1 gas * 1 wei = 1 wei gas cost
    // tokenPerETH = 2500e6
    // raw: 1 * 2500e6 / 1e18 = 0.0000000025 → ceil = 1
    const amount = calculatePaymentAmount({
      gas: 1n,
      gasPriceWei: 1n,
      tokenPerETH: 2_500_000_000n,
      safetyMargin: 1.0,
    });
    expect(amount).toBe(1n);
  });
});

describe("buildFeeBreakdown", () => {
  it("returns FeeBreakdown with paymentAmount from formula", () => {
    const fee = buildFeeBreakdown({
      gas: 150_000n,
      gasPriceWei: 30n * 10n ** 9n,
      tokenPerETH: 2_500_000_000n,
    });
    expect(fee.gas).toBe(150_000n);
    expect(fee.gasPriceWei).toBe(30n * 10n ** 9n);
    expect(fee.tokenPerETH).toBe(2_500_000_000n);
    expect(fee.paymentAmount).toBeGreaterThan(0n);
  });
});

describe("normalizeQuote", () => {
  it("uses gasPrice when provided (legacy)", () => {
    const { quote, gasPriceWei } = normalizeQuote({
      gasPrice: "25000000000",
      gasLimit: 200_000,
    });
    expect(quote.gasPrice).toBe("25000000000");
    expect(quote.gasLimit).toBe(200_000);
    expect(gasPriceWei).toBe(25_000_000_000n);
  });

  it("uses baseFee + priorityFee when gasPrice not set", () => {
    const { quote, gasPriceWei } = normalizeQuote({
      baseFee: "10000000000",
      priorityFee: "2000000000",
      gasLimit: 150_000,
    });
    expect(quote.baseFee).toBe("10000000000");
    expect(gasPriceWei).toBe(12_000_000_000n);
  });

  it("defaults missing fields to 0", () => {
    const { quote, gasPriceWei } = normalizeQuote({});
    expect(quote.baseFee).toBe("0");
    expect(quote.gasLimit).toBe(0);
    expect(gasPriceWei).toBe(0n);
  });
});
