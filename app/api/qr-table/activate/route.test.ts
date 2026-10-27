import { POST } from "./route";
import { requireRestaurantOwner } from "@/lib/auth/restaurantOwner";
import { query } from "@/lib/database/sql";

jest.mock("@/lib/auth/restaurantOwner", () => ({
  requireRestaurantOwner: jest.fn(async () => ({ user: { id: "owner" } })),
  RestaurantOwnerAuthError: class extends Error { status = 403; },
}));
jest.mock("@/lib/database/sql", () => ({ query: jest.fn() }));

beforeEach(() => {
  jest.clearAllMocks();
  (query as jest.Mock).mockResolvedValue({ rows: [{ product_key: "qr_code_mesa", status: "active", price_cents: 0, universal_token: "existing-token" }] });
});
test("activates free QR while preserving legacy universal QR tokens and design", async () => {
  const response = await POST(new Request("https://example.test/api/qr-table/activate", {
    method: "POST", body: JSON.stringify({ restaurantId: "restaurant", source: "mesas" }),
  }));
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ active: true, addon: { universal_token: "existing-token" } });
  expect(requireRestaurantOwner).toHaveBeenCalledWith(expect.any(Request), "restaurant");
  const sql = (query as jest.Mock).mock.calls[0][0] as string;
  expect(sql).toContain("price_cents=0");
  expect(sql).toContain("ON CONFLICT (restaurant_id,product_key)");
  expect(sql).not.toContain("universal_token=");
  expect(sql).not.toContain("qr_design_template=");
  expect(sql).not.toContain("restaurant_addon_payments");
});
test("rejects a missing restaurant without changing any data", async () => {
  const response = await POST(new Request("https://example.test/api/qr-table/activate", {
    method: "POST", body: JSON.stringify({}),
  }));
  expect(response.status).toBe(400);
  expect(query).not.toHaveBeenCalled();
});
