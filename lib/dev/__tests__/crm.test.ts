import { query } from "@/lib/database/sql";
import { getCrm } from "../crm";

jest.mock("@/lib/database/sql", () => ({ query: jest.fn() }));
const sqlQuery = query as jest.Mock;

beforeEach(() => {
    sqlQuery.mockReset();
    sqlQuery
        .mockResolvedValueOnce({ rows: [{ id: "r-1", name: "A", gmv_cents: "123456" }] })
        .mockResolvedValueOnce({ rows: [{ total: 35 }] });
});

test("CRM list returns lifetime GMV using the same eligible order statuses as the profile", async () => {
    const data = await getCrm(new URLSearchParams("page=0"));
    expect("rows" in data && data.rows[0]?.gmv_cents).toBe("123456");
    const [sql] = sqlQuery.mock.calls[0];
    expect(sql).toContain("LEFT JOIN LATERAL");
    expect(sql).toContain("SUM(o.total_cents)");
    expect(sql).toContain("o.restaurant_id=r.id");
    expect(sql).toContain("o.status IS DISTINCT FROM 'canceled'");
    expect(sql).toContain("o.status IS DISTINCT FROM 'pending_online_payment'");
    expect(sql).toContain("ORDER BY  r.created_at DESC,r.id LIMIT $2 OFFSET $3");
});

test.each([
    ["name", "asc", "LOWER(r.name) ASC NULLS LAST, r.id"],
    ["gmv", "desc", "gmv.gmv_cents DESC NULLS LAST, r.id"],
    ["gmv", "asc", "gmv.gmv_cents ASC NULLS LAST, r.id"],
    ["created", "desc", "r.created_at DESC NULLS LAST, r.id"],
    ["owner", "asc", "COALESCE(NULLIF(BTRIM(u.raw_user_meta_data->>'phone'), ''), NULLIF(BTRIM(r.phone), '')) ASC NULLS LAST, r.id"],
    ["store", "asc", "NULLIF(BTRIM(r.store_whatsapp), '') ASC NULLS LAST, r.id"],
])("sort %s %s is applied in SQL before pagination", async (sort, direction, expected) => {
    await getCrm(new URLSearchParams({ sort, direction, page: "2" }));
    const [sql, params] = sqlQuery.mock.calls[0];
    expect(sql).toContain("ORDER BY " + expected + " LIMIT $2 OFFSET $3");
    expect(params).toEqual(["", 10, 20]);
});

test("sorting by customer tier uses Plus > historically paid > free", async () => {
    await getCrm(new URLSearchParams({ sort: "status", direction: "desc", paid: "1" }));
    const [sql] = sqlQuery.mock.calls[0];
    expect(sql).toContain("ORDER BY CASE WHEN (");
    expect(sql).toContain("THEN 2 WHEN (");
    expect(sql).toContain("THEN 1 ELSE 0 END DESC NULLS LAST, r.id");
});

test("unrecognized sort input cannot become executable SQL", async () => {
    await getCrm(new URLSearchParams({ sort: "gmv;DROP TABLE orders", direction: "asc" }));
    const [sql] = sqlQuery.mock.calls[0];
    expect(sql).not.toContain("DROP TABLE");
    expect(sql).toContain("ORDER BY  r.created_at DESC,r.id");
});

test("paid CRM list retains Plus-first default ordering", async () => {
    await getCrm(new URLSearchParams({ paid: "1" }));
    const [sql] = sqlQuery.mock.calls[0];
    expect(sql).toContain(") DESC, r.created_at DESC,r.id");
});
