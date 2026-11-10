import { PUT } from "./route";
import { withTransaction } from "@/lib/database/sql";
import { requireRestaurantOwner } from "@/lib/auth/restaurantOwner";

jest.mock("@/lib/database/sql", () => ({ withTransaction: jest.fn() }));
jest.mock("@/lib/auth/restaurantOwner", () => ({
  ...jest.requireActual("@/lib/auth/restaurantOwner"),
  requireRestaurantOwner: jest.fn(),
}));

const restaurantId = "30000000-0000-4000-8000-000000000001";
const orderId = "50000000-0000-4000-8000-000000000001";
const itemId = "10000000-0000-4000-8000-000000000001";

it.each([
  ["balcao", true, "Cliente"], ["mesa", true, "Cliente"], ["mesa", false, "Cliente"],
  ["balcao", true, ""], ["mesa", true, ""],
] as const)("edits %s orders with salao availability %s and customer name %s, preserving destination and discounts", async (destination, available, customerName) => {
  const tableId = "40000000-0000-4000-8000-000000000001";
  (requireRestaurantOwner as jest.Mock).mockResolvedValue({});
  const client = {
    query: jest.fn(async (sql: string, _values: unknown[]) => {
      if (sql.includes("SELECT * FROM orders")) return { rows: [{
        status: "pending_physical_payment", payment_method: "dinheiro", is_delivery: destination,
        table_id: destination === "mesa" ? tableId : null, total_cents: 6960, coupon_code: null, loyalty_points_used: 0,
        loyalty_credited: false,
      }] };
      if (sql.includes("SELECT automatic_promotions")) return { rows: [{ automatic_promotions: [], pizza_settings: null }] };
      if (sql.includes("SELECT item_id, quantity, pizza")) return { rows: [{ item_id: itemId, quantity: 4, pizza: null }] };
      if (sql.includes("SELECT id, name, price_cents, is_available")) return { rows: [{ id: itemId, name: "Dog", price_cents: 1740, is_available: true }] };
      if (sql.includes("FROM promotions p")) return { rows: [{ item_id: itemId, type: "fixed", value: 750 }] };
      if (sql.includes("stock_enabled, stock_quantity")) return { rows: [{ stock_enabled: false, stock_quantity: 99, is_available: true, name: "Dog", available_for_salao: available }] };
      if (sql.includes("FROM restaurant_tables")) return { rows: [{ id: tableId, name: "Mesa 1" }] };
      if (sql.includes("INSERT INTO order_items")) return { rows: [{ id: "order-item" }] };
      return { rows: [] };
    }),
  };
  (withTransaction as jest.Mock).mockImplementation(async (callback) => callback(client));
  const response = await PUT(new Request(`https://preview.imenuapp.com.br/api/orders/${orderId}/edit`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: "Bearer owner-token" },
    body: JSON.stringify({
      restaurantId, customer_name: customerName, delivery_fee_cents: 0, paymentMethod: "dinheiro",
      is_delivery: destination, ...(destination === "mesa" ? { table_id: tableId } : {}), expected_promotion: { id: null, total_cents: 3960 },
      items: [{ id: "line", base_item_id: itemId, name: "Dog", qty: 4, unit_price_cents: 1740,
        total_cents: 6960, selectedSubitems: [] }],
    }),
  }), { params: Promise.resolve({ id: orderId }) });
  if (!available) {
    expect(response.status).toBe(409);
    expect(client.query.mock.calls.some(([sql]) => /UPDATE orders|DELETE FROM order_items|INSERT INTO order_items/.test(String(sql)))).toBe(false);
    return;
  }
  expect(response.status).toBe(200);
  const orderUpdate = client.query.mock.calls.find(([sql]) => String(sql).includes("UPDATE orders SET"));
  const itemInsert = client.query.mock.calls.find(([sql]) => String(sql).includes("INSERT INTO order_items"));
  expect(orderUpdate?.[1][0]).toBe(customerName || null);
  expect(orderUpdate?.[1][8]).toBe(destination);
  expect(orderUpdate?.[1][9]).toBe(destination === "mesa" ? tableId : null);
  expect(orderUpdate?.[1][10]).toBe(destination === "mesa" ? "Mesa 1" : null);
  expect(orderUpdate?.[1][3]).toBe(3960);
  expect(orderUpdate?.[1][5]).toBe(3960);
  expect(itemInsert?.[1][3]).toBe(990);
  expect(itemInsert?.[1][6]).toBe(3960);
  expect(itemInsert?.[1][7]).toBe(1740);
});
