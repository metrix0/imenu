import { aiAccess, IaPlusRequired, requireIaPlus } from "../access";
import { beginRun, reserveImage } from "../runs";
import { query, withTransaction } from "@/lib/database/sql";

jest.mock("@/lib/database/sql", () => ({ query: jest.fn(), withTransaction: jest.fn() }));
const sql = query as jest.Mock;
let addon: any, usage: any;
beforeEach(() => {
  addon = null;
  usage = { tokens: 0, reserved: 0, images: 0 };
  sql.mockImplementation(async (statement: string) => ({
    rows: statement.includes("restaurant_addons") ? (addon ? [addon] : [])
      : statement.includes("sum(input_tokens + output_tokens)") ? [usage]
      : statement.includes("sum(greatest") ? [{ input: 0, output: 0, recent: 0 }]
      : statement.includes("sum(image_count),0) n") ? [{ n: usage.images }] : [],
    rowCount: statement.startsWith("UPDATE public.ia_vendas_runs SET image_count") ? 1 : 0,
  }));
  (withTransaction as jest.Mock).mockImplementation(fn => fn({ query: sql }));
});
test("a restaurant without Plus starts with 10,000 tokens and one image", async () => {
  expect(await aiAccess("restaurant")).toMatchObject({ plus: false, tokens_remaining: 10000, images_remaining: 1 });
  usage = { tokens: 9500, images: 1, reserved: 0 };
  expect(await aiAccess("restaurant")).toMatchObject({ tokens_remaining: 500, images_remaining: 0 });
  await expect(requireIaPlus("restaurant")).rejects.toBeInstanceOf(IaPlusRequired);
});
test("free tokens use a rolling seven-day window while images remain monthly", async () => {
  await aiAccess("restaurant");
  const usageQuery = sql.mock.calls.find(([statement]) =>
    statement.includes("sum(input_tokens + output_tokens)"),
  )?.[0] as string;
  expect(usageQuery).toContain("kind='chat' AND created_at>=now()-interval '7 days'");
  expect(usageQuery).toContain(
    "sum(image_count) FILTER (WHERE created_at>=date_trunc('month',now()))",
  );
});
test.each([
  ["active", null, true],
  ["canceled", "2099-01-01", true],
  ["past_due", "2099-01-01", true],
  ["canceled", "2000-01-01", false],
  ["past_due", "2000-01-01", false],
  ["pending", "2099-01-01", false],
])("%s entitlement uses the existing addon access rules", async (status, end, plus) => {
  addon = { status, current_period_ends_at: end };
  usage.tokens = 100000;
  expect((await aiAccess("restaurant")).plus).toBe(plus);
});
test("another run's reserved allowance cannot be spent twice", async () => {
  usage = { tokens: 8000, images: 0, reserved: 1700 };
  await expect(beginRun("restaurant", "conversation", "run", "chat")).rejects.toBeInstanceOf(IaPlusRequired);
  expect(sql.mock.calls.some(([s]) => s.startsWith("INSERT INTO public.ia_vendas_runs"))).toBe(false);
});
test("free chat reserves only the restaurant's remaining allowance", async () => {
  usage.tokens = 7000;
  await beginRun("restaurant", "conversation", "run", "chat");
  const insert = sql.mock.calls.find(([s]) => s.startsWith("INSERT INTO public.ia_vendas_runs"));
  expect(insert?.[1].slice(5, 7)).toEqual([3000, 0]);
});
test("free image quota blocks the second generation; Plus keeps the existing capacity", async () => {
  await expect(reserveImage("restaurant", "run")).resolves.toBeUndefined();
  usage.images = 1;
  await expect(reserveImage("restaurant", "run")).rejects.toBeInstanceOf(IaPlusRequired);
  addon = { status: "active" };
  await expect(reserveImage("restaurant", "run")).resolves.toBeUndefined();
});
test("manual analysis remains available even after all free allowances are exhausted", async () => {
  usage = { tokens: 10000, reserved: 0, images: 1 };
  await expect(beginRun("restaurant", "conversation", "run", "analysis")).resolves.toBeNull();
  expect(sql.mock.calls.some(([s]) => s.includes("restaurant_addons"))).toBe(false);
});
