import { calculateCreditQuote, convertCreditCostToBrlCents, type CreditRates } from "../creditMath";
import { getCreditRates } from "../creditPricing";
import { LIMITS } from "../config";

const rates: CreditRates = {
  chatModel: "gpt-5.6-luna",
  imageModel: "gpt-image-2",
  inputUsdPerMillion: 0.20,
  outputUsdPerMillion: 1.20,
  imageUsdEstimate: 0.006,
  outputRatio: 120_000 / 2_000_000,
  maxInputTokens: 10_000_000,
  maxImages: 150,
  inputStep: 100_000,
};

test("additional input tokens automatically bring the matching output allowance", () => {
  const quote = calculateCreditQuote(rates, 1_000_000, 0);
  expect(quote.outputTokens).toBe(60_000);
  expect(quote.outputAllowanceTokens).toBe(60_000);
  expect(quote.inputUsd).toBeCloseTo(0.20);
  expect(quote.outputUsd).toBeCloseTo(0.072);
  expect(quote.totalUsd).toBeCloseTo(0.272);
});

test("image packs contribute separately to the live total", () => {
  const quote = calculateCreditQuote(rates, 500_000, 10);
  expect(quote.outputTokens).toBe(30_000);
  expect(quote.imagesUsd).toBeCloseTo(0.06);
  expect(quote.totalUsd).toBeCloseTo(0.196);
});

test.each([
  [-1, 1], [100_001, 0], [10_100_000, 0], [0, -1], [0, 151], [1.1, 2], [0, NaN],
])("rejects invalid units (input=%s, images=%s)", (inputTokens, images) => {
  expect(() => calculateCreditQuote(rates, inputTokens, images)).toThrow("Quantidade");
});

test("published rates are tied to the configured model and quota ratio", () => {
  const current = getCreditRates();
  if (current) {
    expect(current.outputRatio).toBeGreaterThan(0);
    expect(current.inputUsdPerMillion).toBeGreaterThan(0);
    expect(current.outputUsdPerMillion).toBeGreaterThan(0);
    expect(current.imageUsdEstimate).toBeGreaterThan(0);
    expect(current.maxInputTokens).toBe(LIMITS.monthlyChatInput);
    expect(current.maxImages).toBe(LIMITS.images);
    expect(calculateCreditQuote(current, current.maxInputTokens, current.maxImages).outputTokens)
      .toBe(LIMITS.monthlyChatOutput);
    expect(() => calculateCreditQuote(current, current.maxInputTokens + current.inputStep, 0))
      .toThrow("Quantidade");
    expect(() => calculateCreditQuote(current, 0, current.maxImages + 1))
      .toThrow("Quantidade");
  }
});

test("BRL billing rounds the USD exchange rate up by at least R$ 0,50, then rounds cents up", () => {
  expect(convertCreditCostToBrlCents(0.272, 5)).toBe(164);
  expect(convertCreditCostToBrlCents(0.301, 5)).toBe(181);
  expect(convertCreditCostToBrlCents(1, 5)).toBe(600);
  expect(convertCreditCostToBrlCents(0, 5)).toBe(0);
  expect(() => convertCreditCostToBrlCents(1, 0)).toThrow();
});

test("2M input + 120k purchased output + 70 low images costs R$ 5,79 at USD/BRL 5,4666", () => {
  const quote = calculateCreditQuote(rates, 2_000_000, 70);
  expect(quote.inputUsd).toBeCloseTo(0.4);
  expect(quote.outputTokens).toBe(120_000);
  expect(quote.outputUsd).toBeCloseTo(0.144);
  expect(quote.imagesUsd).toBeCloseTo(0.42);
  expect(quote.totalUsd).toBeCloseTo(0.964);
  expect(convertCreditCostToBrlCents(quote.totalUsd, 5.4666)).toBe(579);
});
