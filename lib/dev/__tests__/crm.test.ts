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

test.each([
    ["active", ["o.status='done'", "COUNT(DISTINCT", "INTERVAL '14 days'"]],
    ["active_customers", ["o.customer_phone", "COUNT(DISTINCT normalized.phone)", "INTERVAL '30 days'"]],
    ["abandoned_plus", ["MAX(o.created_at)", "INTERVAL '15 days'", "addon.product_key = 'ia_plus'"]],
    ["abandoned_imenu", ["MAX(o.created_at)", "INTERVAL '15 days'", "AND NOT "]],
    ["single_day", ["owned.creation_step=4", "owned.first_time=false", "GROUP BY owned.id, "]],
    ["no_first_order", ["owned.onboarding_completed_at", "INTERVAL '48 hours'", "INTERVAL '24 hours'", "NOT EXISTS"]],
])("CRM activity %s filters data and total before pagination", async (activity, parts) => {
    await getCrm(new URLSearchParams({ activity, page: "2", sort: "gmv", direction: "desc" }));
    const [listSql, params] = sqlQuery.mock.calls[0];
    const [countSql] = sqlQuery.mock.calls[1];
    for (const part of parts) {
        expect(listSql).toContain(part);
        expect(countSql).toContain(part);
    }
    expect(listSql).toContain("ORDER BY gmv.gmv_cents DESC NULLS LAST, r.id LIMIT $2 OFFSET $3");
    expect(params).toEqual(["", 10, 20]);
});

test("invalid activity values are ignored (cannot inject SQL)", async () => {
    await getCrm(new URLSearchParams({ activity: "x' OR true --" }));
    const [sql] = sqlQuery.mock.calls[0];
    expect(sql).not.toContain("x' OR true --");
    expect(sql).not.toContain("COUNT(DISTINCT normalized.phone)");
});

test("legacy Cadastro query parameter no longer affects filtering", async () => {
    await getCrm(new URLSearchParams({ age: "30" }));
    const [sql] = sqlQuery.mock.calls[0];
    expect(sql).not.toContain("r.created_at >= NOW() - INTERVAL '30 days'");
});
