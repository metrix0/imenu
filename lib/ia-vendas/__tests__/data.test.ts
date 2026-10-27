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
test("growth settings are included in complete tenant-scoped analysis snapshots", async () => {
  const ctx = await context("restaurant", true);
  const sql = c.query.mock.calls.map(([statement]) => statement);
  expect(sql.some(statement => statement.includes("FROM public.automatic_upsell t WHERE t.restaurant_id=$1"))).toBe(true);
  expect(sql.some(statement => statement.includes("FROM public.whatsapp_bot_settings t WHERE t.restaurant_id=$1"))).toBe(true);
  expect(ctx.growth_settings.upsell_automatico.enabled).toBe(false);
  expect(ctx.growth_settings.marketing.settings.cart.enabled).toBe(false);
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

test("selective reads fetch only requested fields and IDs", async () => {
  const id = "11111111-1111-4111-8111-111111111111";
  (query as jest.Mock).mockResolvedValue({
    rows: [{ id, name: "Pernil Burger", is_available: true }],
  });
  const result = await readData("restaurant", "items", 0, false, undefined, {
    ids: [id], fields: ["name", "is_available"], limit: 2,
  });
  const [sql, params] = (query as jest.Mock).mock.calls[0];
  expect(sql).toContain("SELECT t.id,t.name,t.is_available FROM public.items");
  expect(sql).toContain("t.id=ANY($3::uuid[])");
  expect(sql).toContain("LIMIT 3 OFFSET $2");
  expect(params).toEqual(["restaurant", 0, [id]]);
  expect(result).toEqual({
    rows: [{ id, name: "Pernil Burger", is_available: true }],
    has_more: false, next_offset: 2,
  });
});

test("selective reads reject invalid fields, IDs and limits before querying", async () => {
  (query as jest.Mock).mockClear();
  await expect(readData("restaurant", "items", 0, false, undefined, {
    fields: ["owner_password"],
  })).rejects.toThrow("Campos inválidos.");
  await expect(readData("restaurant", "items", 0, false, undefined, {
    ids: ["not-a-uuid"],
  })).rejects.toThrow("Identificadores inválidos.");
  await expect(readData("restaurant", "items", 0, false, undefined, {
    limit: 51,
  })).rejects.toThrow("Limite de registros inválido.");
  expect(query).not.toHaveBeenCalled();
});

test("full records remain available up to 50 at a time", async () => {
  (query as jest.Mock).mockResolvedValue({
    rows: Array.from({ length: 51 }, (_, i) => ({ id: i, image_path: null })),
  });
  const page = await readData("restaurant", "items", 0, false, undefined, { limit: 50 });
  expect(page.rows).toHaveLength(50);
  expect(page.has_more).toBe(true);
  expect((query as jest.Mock).mock.calls[0][0]).toContain("LIMIT 51 OFFSET $2");
});
