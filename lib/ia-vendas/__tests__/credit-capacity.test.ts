import { getAvailableCreditRechargeRates, getCreditRates } from "../creditPricing";
import { aiAccess } from "../access";
import { query } from "@/lib/database/sql";
import { calculateCreditQuote } from "../creditMath";
import { LIMITS } from "../config";

jest.mock("../access", () => ({ aiAccess: jest.fn() }));
jest.mock("@/lib/database/sql", () => ({ query: jest.fn() }));

const current = {
  plus: true,
  usage: {
    tokens: { input: 1_500_000, output: 100_000 },
  },
  base_images_remaining: 20,
  purchased_credits: { input: 400_000, output: 15_000, images: 4 },
};

beforeEach(() => {
  (aiAccess as jest.Mock).mockResolvedValue(current);
  (query as jest.Mock).mockResolvedValue({
    rows: [{ input: 100_000, output: 2_000, images: 3 }],
  });
});

test("available recharge capacity is the Plus cap minus included, paid and pending credits", async () => {
  const rates = await getAvailableCreditRechargeRates("restaurant-1");
  expect(rates.maxInputTokens).toBe(1_000_000);
  expect(rates.maxOutputTokens).toBe(83_000);
  expect(rates.availableOutputTokens).toBe(35_000);
  expect(rates.maxImages).toBe(48);
  expect(rates.inputStep).toBe(100_000);
  expect(query).toHaveBeenCalledWith(
    expect.stringContaining("status='pending'"),
    ["restaurant-1"],
  );
});

test("recharge does not exceed output headroom when the user buys more input", async () => {
  (aiAccess as jest.Mock).mockResolvedValue({
    ...current,
    usage: { tokens: { input: 2_000_000, output: 25 } },
    base_images_remaining: 0,
    purchased_credits: { input: 0, output: 0, images: 0 },
  });
  (query as jest.Mock).mockResolvedValue({ rows: [{ input: 0, output: 0, images: 0 }] });
  const rates = await getAvailableCreditRechargeRates("restaurant-1");
  expect(rates.maxInputTokens).toBe(LIMITS.monthlyChatInput);
  expect(rates.maxOutputTokens).toBe(25);
  expect(rates.availableOutputTokens).toBe(119_975);
  const quote = calculateCreditQuote(rates, 2_000_000, 0);
  expect(quote.outputAllowanceTokens).toBe(120_000);
  expect(quote.outputTokens).toBe(25);
  expect(quote.inputTokens).toBe(2_000_000);
});

test("output shown follows the slider despite just 29 extra output credits being needed", async () => {
  (aiAccess as jest.Mock).mockResolvedValue({
    ...current,
    usage: { tokens: { input: 2_000_000, output: 29 } },
    base_images_remaining: 5,
    purchased_credits: { input: 0, output: 0, images: 0 },
  });
  (query as jest.Mock).mockResolvedValue({ rows: [{ input: 0, output: 0, images: 0 }] });
  const rates = await getAvailableCreditRechargeRates("restaurant-1");
  expect(rates.availableOutputTokens).toBe(119_971);
  expect(rates.maxOutputTokens).toBe(29);
  expect(rates.maxInputTokens).toBe(2_000_000);
  expect(calculateCreditQuote(rates, 0, 0).outputAllowanceTokens).toBe(0);
  const halfMillion = calculateCreditQuote(rates, 500_000, 0);
  expect(halfMillion.outputAllowanceTokens).toBe(30_000);
  expect(halfMillion.outputTokens).toBe(0);
  expect(calculateCreditQuote(rates, 1_000_000, 0).outputAllowanceTokens).toBe(60_000);
  const full = calculateCreditQuote(rates, 2_000_000, 0);
  expect(full.outputAllowanceTokens).toBe(120_000);
  expect(full.outputTokens).toBe(29);
});

test("a full unused plan cannot buy credits beyond the existing allowance", async () => {
  (aiAccess as jest.Mock).mockResolvedValue({
    ...current,
    usage: { tokens: { input: 0, output: 0 } },
    base_images_remaining: LIMITS.images,
    purchased_credits: { input: 0, output: 0, images: 0 },
  });
  (query as jest.Mock).mockResolvedValue({ rows: [{ input: 0, output: 0, images: 0 }] });
  const rates = await getAvailableCreditRechargeRates("restaurant-1");
  expect(rates.maxInputTokens).toBe(0);
  expect(rates.maxOutputTokens).toBe(0);
  expect(rates.maxImages).toBe(0);
  expect(() => calculateCreditQuote(rates, 100_000, 0)).toThrow("Quantidade");
});

test("free allowance is also counted before permitting top-ups", async () => {
  (aiAccess as jest.Mock).mockResolvedValue({
    plus: false,
    base_tokens_remaining: 150_000,
    base_images_remaining: 3,
    purchased_credits: { input: 0, output: 0, images: 0 },
  });
  (query as jest.Mock).mockResolvedValue({ rows: [{ input: 0, output: 0, images: 0 }] });
  const rates = await getAvailableCreditRechargeRates("restaurant-1");
  expect(rates.maxInputTokens).toBe(1_800_000);
  expect(rates.maxOutputTokens).toBe(LIMITS.monthlyChatOutput);
  expect(rates.maxImages).toBe(72);
});

test("helper respects the configured Plus plan capacities", () => {
  expect(getCreditRates()?.maxInputTokens).toBe(LIMITS.monthlyChatInput);
  expect(getCreditRates()?.maxImages).toBe(LIMITS.images);
});
