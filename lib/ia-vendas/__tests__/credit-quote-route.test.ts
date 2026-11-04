import { GET, POST } from "@/app/api/ia-vendas/credits/quote/route";
import { authorize } from "@/lib/ia-vendas/http";


jest.mock("@/lib/ia-vendas/http", () => ({
  authorize: jest.fn().mockResolvedValue("restaurant-id"),
  failure: (error: Error & { status?: number }) =>
    Response.json({ error: error.message }, { status: error.status || 500 }),
}));

jest.mock("@/lib/ia-vendas/creditPricing", () => {
  const actual = jest.requireActual("@/lib/ia-vendas/creditPricing");
  return {
    ...actual,
    getUsdBrlRate: jest.fn().mockResolvedValue(5.5),
    getAvailableCreditRechargeRates: jest.fn(async () => ({
      ...actual.getCreditRates(), maxOutputTokens: 120_000,
    })),
    quoteCreditPurchase: jest.fn(async (input: number, images: number) => {
      const { calculateCreditQuote, convertCreditCostToBrlCents } = require("@/lib/ia-vendas/creditMath");
      const rates = { ...actual.getCreditRates(), maxOutputTokens: 120_000 };
      const quote = calculateCreditQuote(rates, input, images);
      return { rates, quote, rate: 5.5, priceCents: convertCreditCostToBrlCents(quote.totalUsd, 5.5) };
    }),
  };
});
beforeEach(() => (authorize as jest.Mock).mockClear());

test("GET supplies server-configured rates without offering payment", async () => {
  const response = await GET(new Request("https://example.test/api/ia-vendas/credits/quote?restaurant_id=restaurant-id"));
  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body.rate).toBe(5.5);
  expect(body.rates.outputRatio).toBeCloseTo(0.06);
  expect(body.rates.maxOutputTokens).toBe(120_000);
  expect(authorize).toHaveBeenCalledWith(expect.any(Request), "restaurant-id");
});

test("POST recalculates quote and ignores client-side price fields", async () => {
  const response = await POST(new Request("https://example.test/api/ia-vendas/credits/quote", {
    method: "POST",
    body: JSON.stringify({
      restaurant_id: "restaurant-id",
      inputTokens: 1_000_000,
      images: 10,
      totalUsd: 0,
      outputTokens: 10_000_000,
    }),
  }));
  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body.priceCents).toBeGreaterThan(0);
  expect(body.quote.outputTokens).toBe(60_000);
  expect(body.priceCents).toBeGreaterThan(0);
  expect(body.quote.totalUsd).toBeGreaterThan(0);
});

test("POST rejects tampered or empty selections without payment", async () => {
  for (const input of [{ inputTokens: 100_001, images: 1 }, { inputTokens: 0, images: 0 }]) {
    const response = await POST(new Request("https://example.test/api/ia-vendas/credits/quote", {
      method: "POST",
      body: JSON.stringify({ restaurant_id: "restaurant-id", ...input }),
    }));
    expect(response.status).toBe(400);
  }
});
