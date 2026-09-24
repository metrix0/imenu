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
test("cooldown is enforced by completed analysis, under a restaurant lock", async () => {
  c.query.mockImplementation(async (sql: string) => ({
    rows: sql.includes("SELECT finished_at")
      ? [{ finished_at: new Date() }]
      : [],
    rowCount: 0,
  }));
  await expect(
    beginRun("restaurant", "conversation", "run", "analysis"),
  ).rejects.toThrow("duas semanas");
  const lookup = c.query.mock.calls.find(([sql]) =>
    sql.includes("SELECT finished_at"),
  )![0];
  expect(lookup).toContain("status='completed'");
  expect(lookup).toContain("interval '14 days'");
  expect(c.query.mock.calls.some(([sql]) => sql.includes("INSERT INTO"))).toBe(
    false,
  );
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
test("two completed calendar-month analyses cap new analysis", async () => {
  c.query.mockImplementation(async (sql: string) => ({
    rows: sql.includes("SELECT count(*)::int n") ? [{ n: 2 }] : [],
    rowCount: 0,
  }));
  await expect(
    beginRun("restaurant", "conversation", "run", "analysis"),
  ).rejects.toThrow("duas análises");
});
