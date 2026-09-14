import { POST } from "./route";
import { query, withTransaction } from "@/lib/database/sql";
import { createPayZuPixCharge } from "@/lib/payzu";
jest.mock("@/lib/database/sql", () => ({ query: jest.fn(), withTransaction: jest.fn() }));
jest.mock("@/lib/payzu", () => ({ createPayZuPixCharge: jest.fn() }));
const restaurant = "30000000-0000-4000-8000-000000000001";
const a = "10000000-0000-4000-8000-000000000001", b = "10000000-0000-4000-8000-000000000002";
const table = "40000000-0000-4000-8000-000000000001";
const settings = { enabled: true, pricing_rule: "average", max_flavors: 3, category_ids: ["pizza"] };
const pizza = { pricing_rule: "average", flavors: [{ item_id: a }, { item_id: b }] };
const line = { base_item_id: a, name: "forged", qty: 2, unit_price_cents: 5500, total_cents: 11000, selectedSubitems: [], pizza };
const payload = { restaurantId: restaurant, customer_name: "Teste", customer_phone: "11999990000", items: [line], delivery_fee_cents: 800, paymentMethod: "dinheiro", is_delivery: "entrega" };
let writes: Array<{ sql: string; values: any[] }>;
let rollback: boolean;
let secondaryStock: number;
beforeEach(() => {
    writes = []; rollback = false; secondaryStock = 5;
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    (query as jest.Mock).mockResolvedValue({ rows: [] });
    (createPayZuPixCharge as jest.Mock).mockResolvedValue({ id: "test", qrCodeText: "test" });
    const client = { query: jest.fn(async (sql: string, values: any[]) => {
        if (/INSERT|UPDATE/.test(sql) && !sql.includes("FOR UPDATE")) writes.push({ sql, values });
        if (sql.includes("SELECT url_slug")) return { rows: [{ url_slug: "test", automatic_promotions: [], pizza_settings: settings }] };
        if (sql.includes("FROM items i JOIN categories")) return { rows: [a, b].map((id, index) => ({ id, name: index ? "Calabresa" : "Portuguesa", price_cents: 5000 + index * 1000, category_id: "pizza", is_available: true, subcategories: [] })) };
        if (/FROM items\s+WHERE id/.test(sql)) return { rows: [{ id: values[0], restaurant_id: restaurant, name: "Pizza", stock_enabled: true, stock_quantity: values[0] === b ? secondaryStock : 5, is_available: true }] };
        if (sql.includes("FROM public.restaurant_addons")) return { rows: [{ id: table, name: "Mesa 1" }] };
        if (sql.includes("INSERT INTO orders")) return { rows: [{ id: "order-test" }] };
        if (sql.includes("INSERT INTO order_items")) return { rows: [{ id: "line-test" }] };
        if (/SELECT\s+id,\s+restaurant_id,\s+customer_phone/.test(sql)) return { rows: [{ id: "order-test", restaurant_id: restaurant, status: "pending_online_payment", payment_ref: null, loyalty_points_used: 0 }] };
        if (sql.includes("SELECT item_id, quantity")) return { rows: [{ item_id: a, quantity: 2, pizza }] };
        return { rows: [], rowCount: 1 };
    }) };
    (withTransaction as jest.Mock).mockImplementation(async fn => { try { return await fn(client); } catch (e) { rollback = true; throw e; } });
});
afterEach(() => jest.restoreAllMocks());
const send = (patch: Record<string, unknown> = {}) => POST(new Request("https://preview.imenuapp.com.br/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, ...patch }) }));
it.each(["entrega", "retirada", "mesa"])("persists one combined line and final price for %s", async channel => {
    const response = await send({ is_delivery: channel, ...(channel === "mesa" ? { table_token: table, table_id: table } : {}) });
    expect(response.status).toBe(200);
    const order = writes.find(w => w.sql.includes("INSERT INTO orders"))!;
    expect(order.values[2]).toBe(11000);
    expect(order.values[4]).toBe(channel === "entrega" ? 11800 : 11000);
    const lines = writes.filter(w => w.sql.includes("INSERT INTO order_items"));
    expect(lines).toHaveLength(1);
    expect(lines[0].values.slice(2, 5)).toEqual(["1/2 Portuguesa + 1/2 Calabresa", 5500, 2]);
    expect(JSON.parse(lines[0].values[8])).toMatchObject({ pricing_rule: "average", flavors: [{ item_id: a }, { item_id: b }] });
    expect(writes.filter(w => w.sql.includes("stock_quantity -")).map(w => w.values)).toEqual([[2, a], [2, b]]);
});
it("rolls back before inserting when the second flavor lacks stock", async () => {
    secondaryStock = 1;
    expect((await send()).status).toBe(400);
    expect(rollback).toBe(true);
    expect(writes).toHaveLength(0);
});
it("rejects tampered pizza prices before any order or stock mutation", async () => {
    expect((await send({ items: [{ ...line, unit_price_cents: 100, total_cents: 200 }] })).status).toBe(409);
    expect(writes).toHaveLength(0);
});
it("charges the calculated amount and restores both flavors if PIX fails", async () => {
    (createPayZuPixCharge as jest.Mock).mockRejectedValueOnce(new Error("offline"));
    await send({ paymentMethod: "pix" });
    expect(createPayZuPixCharge).toHaveBeenCalledWith(expect.objectContaining({ amount: 118 }));
    expect(writes.filter(w => w.sql.includes("stock_quantity + $1")).map(w => w.values)).toEqual([[2, a], [2, b]]);
});
