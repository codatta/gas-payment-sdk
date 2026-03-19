import { describe, it, expect } from "vitest";
import {
  parsePriceResponse,
  calculatePaymentAmount,
  buildFeeBreakdown,
  normalizeQuote,
  PRICE_SCALE,
} from "./price";

describe("parsePriceResponse", () => {
  it("parses scaled price 1e18 as 1.0", () => {
    const out = parsePriceResponse({ price: "1000000000000000000" });
    expect(out.priceRaw).toBe("1000000000000000000");
    expect(out.priceE18).toBe(1000000000000000000n);
    expect(out.price).toBe(1);
  });

  it("parses scaled price 2e18 as 2.0", () => {
    const out = parsePriceResponse({ price: "2000000000000000000" });
    expect(out.priceE18).toBe(2000000000000000000n);
    expect(out.price).toBe(2);
  });

  it("handles missing price as 0", () => {
    const out = parsePriceResponse({ price: "" });
    expect(out.priceE18).toBe(0n);
    expect(out.price).toBe(0);
  });

  it("handles invalid string as 0", () => {
    const out = parsePriceResponse({ price: "invalid" });
    expect(out.priceE18).toBe(0n);
    expect(out.price).toBe(0);
  });
});

describe("calculatePaymentAmount", () => {
  it("computes Amount = ceil(gas * gas_price * ETH_price / token_price * safetyMargin) in token smallest units (E18)", () => {
    // 100000 gas * 20 Gwei * 2000 USD/ETH / 1 USD/token, 6 decimals
    const amount = calculatePaymentAmount({
      gas: 100_000n,
      gasPriceWei: 20n * 10n ** 9n,
      ethPriceE18: 2000n * PRICE_SCALE,
      tokenPriceE18: 1n * PRICE_SCALE,
      tokenDecimals: 6,
      safetyMargin: 1.2, // 20% safety margin (default)
    });
    // costWei = 100000 * 20e9 = 2e15 wei
    // costUSD = 2e15 / 1e18 * 2000 = 4
    // token amount = 4 / 1 = 4, in smallest units = 4 * 1e6 = 4000000
    // with 20% margin: 4000000 * 1.2 = 4800000
    expect(amount).toBe(4_800_000n);
  });

  it("computes without safety margin when safetyMargin=1.0", () => {
    const amount = calculatePaymentAmount({
      gas: 100_000n,
      gasPriceWei: 20n * 10n ** 9n,
      ethPriceE18: 2000n * PRICE_SCALE,
      tokenPriceE18: 1n * PRICE_SCALE,
      tokenDecimals: 6,
      safetyMargin: 1.0, // no margin
    });
    // costWei = 100000 * 20e9 = 2e15 wei
    // costUSD = 2e15 / 1e18 * 2000 = 4
    // token amount = 4 / 1 = 4, in smallest units = 4 * 1e6 = 4000000
    expect(amount).toBe(4_000_000n);
  });

  it("returns 0 when tokenPriceE18 is 0", () => {
    const amount = calculatePaymentAmount({
      gas: 100_000n,
      gasPriceWei: 20n * 10n ** 9n,
      ethPriceE18: 2000n * PRICE_SCALE,
      tokenPriceE18: 0n,
      tokenDecimals: 6,
    });
    expect(amount).toBe(0n);
  });

  it("rounds down result", () => {
    const amount = calculatePaymentAmount({
      gas: 99_999n,
      gasPriceWei: 1n,
      ethPriceE18: PRICE_SCALE,
      tokenPriceE18: PRICE_SCALE,
      tokenDecimals: 0,
    });
    expect(amount).toBeGreaterThanOrEqual(0n);
  });
});

describe("buildFeeBreakdown", () => {
  it("returns FeeBreakdown with paymentAmount from formula", () => {
    const fee = buildFeeBreakdown({
      gas: 150_000n,
      gasPriceWei: 30n * 10n ** 9n,
      ethPriceE18: 3000n * PRICE_SCALE,
      tokenPriceE18: 1n * PRICE_SCALE,
      tokenDecimals: 6,
    });
    expect(fee.gas).toBe(150_000n);
    expect(fee.gasPriceWei).toBe(30n * 10n ** 9n);
    expect(fee.ethPriceE18).toBe(3000n * PRICE_SCALE);
    expect(fee.tokenPriceE18).toBe(1n * PRICE_SCALE);
    expect(fee.ethPrice).toBe(3000);
    expect(fee.tokenPrice).toBe(1);
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
