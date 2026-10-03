import { beginRun, finishRun } from "../runs";
import { query, withTransaction } from "@/lib/database/sql";
jest.mock("@/lib/database/sql", () => ({
  query: jest.fn(),
  withTransaction: jest.fn(),
}));
const c = { query: jest.fn() };
beforeEach(() => {
  (withTransaction as jest.Mock).mockImplementation(async (fn) => fn(c));
  c.query.mockImplementation(async (sql: string) => ({
    rows: sql.includes("sum(greatest")
      ? [{ input: 0, output: 0, recent: 0 }]
      : [],
    rowCount: 0,
  }));
});
test("manual analysis is allowed immediately after completed analyses", async () => {
  c.query.mockImplementation(async (sql: string) => ({
    rows: sql.includes("SELECT finished_at")
      ? [{ finished_at: new Date() }]
      : sql.includes("SELECT count(*)::int n")
        ? [{ n: 2 }]
        : sql.includes("sum(greatest")
          ? [{ input: 9000000, output: 900000, recent: 5 }]
          : [],
    rowCount: 0,
  }));
  await expect(
    beginRun("restaurant", "conversation", "run", "analysis"),
  ).resolves.toBeNull();
  expect(c.query.mock.calls.some(([sql]) => sql.includes("INSERT INTO"))).toBe(true);
});
test("duplicate completed run is idempotent", async () => {
  c.query.mockImplementation(async (sql: string) => ({
    rows: sql.includes("SELECT id,status,result")
      ? [{ id: "run", status: "completed" }]
      : [],
    rowCount: 0,
  }));
  expect(await beginRun("restaurant", "conversation", "run", "chat")).toEqual({
    id: "run",
    status: "completed",
  });
  expect(c.query.mock.calls.some(([sql]) => sql.includes("INSERT INTO"))).toBe(
    false,
  );
});
test("completion is always tenant scoped", async () => {
  (query as jest.Mock).mockResolvedValue({ rows: [] });
  await finishRun("owner", "run", {});
  expect((query as jest.Mock).mock.calls[0][0]).toContain(
    "restaurant_id=$1 AND id=$2",
  );
  expect((query as jest.Mock).mock.calls[0][1].slice(0, 2)).toEqual([
    "owner",
    "run",
  ]);
});
test("deep analysis ignores monthly token totals while chat keeps its quota", async () => {
  c.query.mockImplementation(async (sql: string) => ({
    rows: sql.includes("sum(greatest")
      ? [{ input: 9000000, output: 900000, recent: 0 }]
      : [],
    rowCount: 0,
  }));
  await expect(
    beginRun("restaurant", "conversation", "run", "analysis"),
  ).resolves.toBeNull();
  await expect(
    beginRun("restaurant", "conversation", "chat-run", "chat"),
  ).rejects.toThrow("capacidade");
});
test("manual analysis has no minute quota while chat retains storm protection", async () => {
  c.query.mockImplementation(async (sql: string) => ({
    rows: sql.includes("sum(greatest")
      ? [{ input: 0, output: 0, recent: 5 }]
      : [],
    rowCount: 0,
  }));
  await expect(
    beginRun("restaurant", "conversation", "run", "analysis"),
  ).resolves.toBeNull();
  await expect(
    beginRun("restaurant", "conversation", "chat-run", "chat"),
  ).rejects.toThrow("capacidade");
});

test("queued analyses survive the synchronous stale timeout and don't block contextual chat", async () => {
  await beginRun("restaurant", "conversation", "run", "chat");
  const cleanup = c.query.mock.calls.find(([sql]) => sql.startsWith("UPDATE public.ia_vendas_runs"));
  expect(cleanup?.[0]).toContain("coalesce(result->'batch'->>'mode','')<>'batch'");
  const concurrent = c.query.mock.calls.find(([sql]) => sql.startsWith("SELECT 1 FROM public.ia_vendas_runs"));
  expect(concurrent?.[0]).toContain("$2='analysis'");
  expect(concurrent?.[1]).toEqual(["restaurant", "chat"]);
});
