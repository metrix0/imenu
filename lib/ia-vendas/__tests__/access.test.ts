import {
  aiAccess,
  FREE_AI_IMAGES,
  FREE_AI_MESSAGE_TOKENS,
  FREE_AI_TOKENS,
  IaImageLimitReached,
  IaPlusRequired,
  requireIaPlus,
  requireApplicationAccess,
} from "../access";
import { beginRun, reserveImage } from "../runs";
import { query, withTransaction } from "@/lib/database/sql";

jest.mock("@/lib/database/sql", () => ({ query: jest.fn(), withTransaction: jest.fn() }));
const sql = query as jest.Mock;
let addon: any, usage: any, used: boolean, kind: string;
beforeEach(() => {
  addon = null;
  used = false;
  kind = "chat";
  usage = { tokens: 0, reserved: 0, images: 0, monthly_images: 0 };
  sql.mockImplementation(async (statement: string) => ({
    rows: statement.includes("SELECT EXISTS") ? [{ used }]
      : statement.startsWith("SELECT kind") ? [{ kind }]
      : statement.includes("restaurant_addons") ? (addon ? [addon] : [])
      : statement.includes("sum(input_tokens + output_tokens)") ? [usage]
      : statement.includes("sum(greatest") ? [{ input: 0, output: 0, recent: 0 }]
      : statement.includes("sum(image_count),0) n") ? [{ n: usage.monthly_images }] : [],
    rowCount: statement.startsWith("UPDATE public.ia_vendas_runs SET image_count") ? 1 : 0,
  }));
  (withTransaction as jest.Mock).mockImplementation(fn => fn({ query: sql }));
});
test("the free application is lifetime history, including undo, excluding image generation", async () => {
  expect((await aiAccess("restaurant")).free_applications_remaining).toBe(1);
  await expect(requireApplicationAccess("restaurant", "chat")).resolves.toBeUndefined();
  used = true;
  expect((await aiAccess("restaurant")).free_applications_remaining).toBe(0);
  await expect(requireApplicationAccess("restaurant", "chat")).rejects.toBeInstanceOf(IaPlusRequired);
  const history = sql.mock.calls.find(([s]) => s.includes("SELECT EXISTS"))[0];
  expect(history).toContain("a.applied_at IS NOT NULL");
  expect(history).toContain("a.image_jobs IS NULL");
  expect(history).not.toMatch(/interval|status='applied'/);
  addon = { status: "active" };
  await expect(requireApplicationAccess("restaurant", "chat")).resolves.toBeUndefined();
  expect((await aiAccess("restaurant")).free_applications_remaining).toBeNull();
});
test("the first free application does not unlock Vendas IA", async () => {
  kind = "analysis";
  await expect(requireApplicationAccess("restaurant", "analysis")).rejects.toBeInstanceOf(IaPlusRequired);
});
test("a restaurant without Plus starts with 150,000 weekly tokens and three weekly images", async () => {
  expect(FREE_AI_TOKENS).toBe(150_000);
  expect(FREE_AI_IMAGES).toBe(3);
  expect(FREE_AI_MESSAGE_TOKENS).toBe(60_000);
  expect(await aiAccess("restaurant")).toMatchObject({
    plus: false,
    tokens_remaining: 150_000,
    images_remaining: 3,
  });
  usage = { tokens: 149_500, images: 2, reserved: 0 };
  expect(await aiAccess("restaurant")).toMatchObject({
    tokens_remaining: 500,
    images_remaining: 1,
  });
  usage.images = 3;
  expect((await aiAccess("restaurant")).images_remaining).toBe(0);
  await expect(requireIaPlus("restaurant")).rejects.toBeInstanceOf(IaPlusRequired);
});
test("free tokens and images use the rolling seven-day window", async () => {
  await aiAccess("restaurant");
  const usageQuery = sql.mock.calls.find(([statement]) =>
    statement.includes("sum(input_tokens + output_tokens)"),
  )?.[0] as string;
  expect(usageQuery).toContain(
    "kind='chat' AND status='completed' AND coalesce(result->>'quota_exempt','false')<>'true' AND created_at>=now()-interval '7 days'",
  );
  expect(usageQuery).toContain(
    "sum(image_count) FILTER (WHERE created_at>=now()-interval '7 days')",
  );
  expect(usageQuery).toContain("created_at>=date_trunc('month',now())");
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
test("weekly soft cap allows one last chat run while any allowance remains", async () => {
  usage = { tokens: 149_999, images: 0, reserved: 0 };
  await expect(
    beginRun("restaurant", "conversation", "run", "chat"),
  ).resolves.toBeNull();
  const insert = sql.mock.calls.find(([statement]) =>
    statement.startsWith("INSERT INTO public.ia_vendas_runs"),
  );
  expect(insert?.[1].slice(5, 7)).toEqual([60_000, 0]);
});

test("weekly token cap blocks new chat and image runs only after it is exhausted", async () => {
  usage = { tokens: 150_000, images: 0, reserved: 0 };
  await expect(
    beginRun("restaurant", "conversation", "chat-run", "chat"),
  ).rejects.toBeInstanceOf(IaPlusRequired);
  await expect(
    beginRun("restaurant", "conversation", "image-run", "image"),
  ).rejects.toBeInstanceOf(IaPlusRequired);
});
test("free image quota blocks the fourth generation; Plus keeps the existing capacity", async () => {
  for (const usedImages of [0, 1, 2]) {
    usage.images = usedImages;
    await expect(reserveImage("restaurant", "run")).resolves.toBeUndefined();
  }
  usage.images = 3;
  const blocked = reserveImage("restaurant", "run");
  await expect(blocked).rejects.toBeInstanceOf(IaImageLimitReached);
  await expect(blocked).rejects.not.toBeInstanceOf(IaPlusRequired);
  addon = { status: "active" };
  await expect(reserveImage("restaurant", "run")).resolves.toBeUndefined();
});
test("iMenu Plus allows 75 images per calendar month and blocks the 76th", async () => {
  addon = { status: "active" };
  usage.monthly_images = 74;
  expect((await aiAccess("restaurant")).images_remaining).toBe(1);
  await expect(reserveImage("restaurant", "run")).resolves.toBeUndefined();
  usage.monthly_images = 75;
  expect((await aiAccess("restaurant")).images_remaining).toBe(0);
  await expect(reserveImage("restaurant", "run")).rejects.toThrow("75 imagens");
  usage.monthly_images = 0;
  expect((await aiAccess("restaurant")).images_remaining).toBe(75);
});
test("manual analysis remains available even after all free allowances are exhausted", async () => {
  usage = { tokens: 150_000, reserved: 0, images: 1 };
  await expect(beginRun("restaurant", "conversation", "run", "analysis")).resolves.toBeNull();
  expect(sql.mock.calls.some(([s]) => s.includes("restaurant_addons"))).toBe(false);
});


test('Plus usage follows the enforced monthly input/output budgets and reports both resources', async () => {
 addon = { status: 'active' };
 usage = { monthly_input: 1_400_000, monthly_output: 0, monthly_images: 15 };
 expect((await aiAccess('restaurant')).usage).toMatchObject({ tokens: { percent: 70 }, images: { percent: 20 } });
 usage = { monthly_input: 0, monthly_output: 84_000, monthly_images: 75 };
 expect((await aiAccess('restaurant')).usage).toMatchObject({ tokens: { percent: 70 }, images: { percent: 100 } });
 addon = null;
 expect((await aiAccess('restaurant')).usage).toBeNull();
});
