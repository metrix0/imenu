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
let addon: any, usage: any, used: boolean, kind: string, credits: any;
beforeEach(() => {
  addon = null;
  credits = null;
  used = false;
  kind = "chat";
  usage = { tokens: 0, reserved: 0, images: 0, monthly_images: 0 };
  sql.mockImplementation(async (statement: string) => ({
    rows: statement.includes("SELECT EXISTS") ? [{ used }]
      : statement.startsWith("SELECT kind") ? [{ kind }]
      : statement.includes("restaurant_addons") ? (addon ? [addon] : [])
      : statement.includes("sum(input_tokens + output_tokens)") ? [usage]
      : statement.includes("FROM public.ia_vendas_credit_balances") ? (credits ? [credits] : [])
      : statement.includes("WITH counted AS") ? [{ tokens_reset_at: new Date("2026-11-09T14:30:00Z"), images_reset_at: new Date("2026-11-10T14:30:00Z") }]
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
  const exhausted = await aiAccess("restaurant");
  expect(exhausted.images_remaining).toBe(0);
  expect(exhausted.images_reset_at).toBe("2026-11-10T14:30:00.000Z");
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

test("chat access reports when the next reserved request cannot fit, even below 100% usage", async () => {
  addon = { status: "active" };
  usage = { monthly_input: 1_900_000, monthly_output: 25_000, monthly_images: 0 };
  expect((await aiAccess("restaurant")).chat_limit_reached).toBe(false);
  usage.monthly_input = 1_969_153;
  expect((await aiAccess("restaurant")).chat_limit_reached).toBe(true);
  credits = { input_tokens: 70_000, output_tokens: 0, images: 0 };
  expect((await aiAccess("restaurant")).chat_limit_reached).toBe(false);
  usage.monthly_output = 119_000;
  expect((await aiAccess("restaurant")).chat_limit_reached).toBe(true);
});

test("free allowance exhaustion also shows the chat limit until reset or recharge", async () => {
  usage = { tokens: 150_000, monthly_input: 0, monthly_output: 0, monthly_images: 0 };
  expect((await aiAccess("restaurant")).chat_limit_reached).toBe(true);
  credits = { input_tokens: 100_000, output_tokens: 6_000, images: 0 };
  expect((await aiAccess("restaurant")).chat_limit_reached).toBe(false);
});

test("image limit text includes reset, continued chat and support phone", async () => {
  const { imageLimitMessage } = await import("../access");
  expect(imageLimitMessage({ plus: false, images_reset_at: "2026-11-10T14:30:00Z" })).toContain("10/11 às 11:30");
  expect(imageLimitMessage({ plus: true, images_reset_at: "2026-12-01T00:00:00Z" })).toContain("75 imagens");
  expect(imageLimitMessage({ plus: true, images_reset_at: "2026-12-01T00:00:00Z" })).toContain("Assistente IA normalmente");
  expect(imageLimitMessage({ plus: false })).toContain("+55 19 99723-5394");
});

test("rolling free reset timestamp is computed only when tokens are exhausted", async () => {
  usage = { tokens: 149_999, reserved: 0, images: 0 };
  expect((await aiAccess("restaurant")).tokens_reset_at).toBeNull();
  expect(sql.mock.calls.some(([statement]) => statement.includes("WITH counted AS"))).toBe(false);
  usage.tokens = 150_000;
  const exhausted = await aiAccess("restaurant");
  expect(exhausted.tokens_reset_at).toBe("2026-11-09T14:30:00.000Z");
  const resetCall = sql.mock.calls.find(([statement]) => statement.includes("WITH counted AS"));
  expect(resetCall?.[0]).toContain("sum(tokens) OVER");
  expect(resetCall?.[1]).toEqual(["restaurant", 0, 0]);
});
