import { context, readData } from "../data";
import { FIELDS } from "../fields";
import { query, withTransaction } from "@/lib/database/sql";
jest.mock("@/lib/database/sql", () => ({
  query: jest.fn(),
  withTransaction: jest.fn(),
}));
jest.mock("@/lib/database/supabaseServerClient", () => ({
  createSupabaseServerClient: jest.fn(),
}));
const c = { query: jest.fn() };
beforeEach(() => {
  (withTransaction as jest.Mock).mockImplementation((fn) => fn(c));
  c.query.mockImplementation(async (sql: string) => ({
    rows: sql.includes("FROM public.items t")
      ? Array.from({ length: 97 }, (_, i) => ({
          id: `item-${i}`,
          image_path: null,
        }))
      : sql.includes("FROM public.categories t")
        ? Array.from({ length: 11 }, (_, i) => ({ id: `cat-${i}` }))
        : sql.includes("WITH selected")
          ? [
              {
                orders: 0,
                units: 0,
                revenue_cents: 0,
                identified_customers: 0,
                products: [],
              },
            ]
          : [],
  }));
});
test("deep context deterministically reads all commercial entities in a consistent tenant snapshot", async () => {
  const data = await context("restaurant", true);
  expect(data.items.rows).toHaveLength(97);
  expect(data.categories.rows).toHaveLength(11);
  expect(data.coverage.items).toEqual({
    loaded: 97,
    total: 97,
    complete: true,
  });
  expect(Object.keys(data.entities)).toEqual(Object.keys(FIELDS));
  const reads = c.query.mock.calls.filter(([s]) => s.includes(" t WHERE "));
  expect(reads).toHaveLength(Object.keys(FIELDS).length);
  for (const [sql, params] of reads) {
    expect(sql).not.toMatch(/LIMIT|OFFSET/);
    expect(params).toEqual(["restaurant"]);
    expect(sql).toContain("$1");
  }
  expect(
    c.query.mock.calls.find(([s]) => s.includes("WITH selected"))[0],
  ).not.toContain("LIMIT 100");
  expect(c.query.mock.calls[0][0]).toContain("REPEATABLE READ READ ONLY");
  const priorQuery = c.query.mock.calls.find(([sql]) =>
    sql.includes("SELECT id,result->'report' report"),
  )?.[0];
  expect(priorQuery).toContain("status='completed'");
  expect(priorQuery).toContain("result->'report'->>'status'='complete'");
  const actionQuery = c.query.mock.calls.find(([sql]) =>
    sql.includes("SELECT id,title,reason,status,operations"),
  )?.[0];
  expect(actionQuery).toContain("r.kind='analysis'");
  expect(actionQuery).toContain("r.status<>'completed'");
});
test("normal reads retain 50-row pagination", async () => {
  (query as jest.Mock).mockResolvedValue({
    rows: Array.from({ length: 51 }, (_, i) => ({ id: i, image_path: null })),
  });
  const page = await readData("restaurant", "items");
  expect(page.rows).toHaveLength(50);
  expect(page.has_more).toBe(true);
  expect((query as jest.Mock).mock.calls[0][0]).toContain("LIMIT 51 OFFSET $2");
});
