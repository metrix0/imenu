import { validate, validateMerged, scope, fields } from "../catalog";
import { same } from "../types";
import { potential, cosine, median } from "../peers";
jest.mock("@/lib/database/sql", () => ({
  query: jest.fn(),
  withTransaction: jest.fn(),
}));
jest.mock("@/lib/database/supabaseServerClient", () => ({
  createSupabaseServerClient: jest.fn(),
}));
describe("commercial boundary", () => {
  test.each([
    "orders",
    "order_items",
    "payouts",
    "restaurant_payouts",
    "users",
    "support_conversations",
    "restaurants; DROP TABLE items",
  ])("rejects protected entity %s", (name) =>
    expect(() => fields(name)).toThrow(),
  );
  test.each([
    "user_id",
    "email",
    "password",
    "phone",
    "payment_info",
    "payment_info_type",
    "balance_cents",
    "store_whatsapp",
    "meta_capi_token",
    "rating",
  ])("rejects protected restaurant field %s", (field) =>
    expect(() => validate("restaurants", { [field]: "x" })).toThrow(),
  );
  test("cannot transfer ownership or mutate historical usage", () => {
    expect(() => validate("items", { restaurant_id: "x" })).toThrow();
    expect(() => validate("coupons", { usage_count: 0 })).toThrow();
  });
  test("scopes nested complements through their actual owner", () => {
    expect(scope("subitems")).toContain("p.restaurant_id=$1");
    expect(scope("item_subcategories")).toContain("p.restaurant_id=$1");
    expect(scope("restaurants")).toBe("t.id=$1");
  });
  test("requires valid real prices and required fields", () => {
    expect(() => validate("items", { price_cents: -1 })).toThrow();
    expect(() => validate("items", { price_cents: 1.5 })).toThrow();
    expect(() => validate("items", { price_cents: null })).toThrow();
    expect(() => validate("items", { name: "New" }, true)).toThrow();
    expect(validate("items", { price_cents: 999 })).toEqual({
      price_cents: 999,
    });
  });
  test("protects discount units and supports delivery coupons", () => {
    expect(() =>
      validateMerged("coupons", {
        discount_type: "percent",
        discount_value: 10,
      }),
    ).toThrow();
    expect(() =>
      validateMerged("coupons", {
        discount_type: "percent",
        discount_value: 0.1,
      }),
    ).not.toThrow();
    expect(() =>
      validateMerged("coupons", {
        discount_type: "delivery",
        discount_value: 0,
      }),
    ).not.toThrow();
    expect(() =>
      validateMerged("promotions", { type: "percent", value: 101 }),
    ).toThrow();
  });
  test("rejects malformed settings and unsafe image protocols", () => {
    expect(() =>
      validate("restaurants", {
        availability_json: { "0": [{ open: "99:00", close: "99:30" }] },
      }),
    ).toThrow();
    expect(() =>
      validate("restaurants", { allowed_payment_methods: ["wire-secret"] }),
    ).toThrow();
    expect(() =>
      validate("items", { image_path: "javascript:alert(1)" }),
    ).toThrow();
    expect(() =>
      validate("restaurants", { pizza_settings: { enabled: true } }),
    ).toThrow();
  });
  test("snapshot comparison is stable for JSON key order and timestamps", () => {
    expect(same({ b: 2, a: 1 }, { a: 1, b: 2 })).toBe(true);
    expect(same(new Date("2026-01-01"), "2026-01-01T00:00:00.000Z")).toBe(true);
    expect(same({ price: 999 }, { price: 1000 })).toBe(false);
  });
});
describe("grounded projections", () => {
  const sales = {
    orders: 100,
    revenue_cents: 100000,
    ticket_cents: 1000,
    days: 28,
  };
  test("withholds weak-data headline", () =>
    expect(potential({ ...sales, orders: 20 }, {}).available).toBe(false));
  test("calculates one capped four-week scenario", () =>
    expect(
      potential(sales, {
        eligible_orders: 100,
        adoption_rate: 0.25,
        extra_cents: 1000,
        assumptions: "25 conversions",
      }).cents,
    ).toBe(15000));
  test.each([
    { eligible_orders: 101, adoption_rate: 0.1, extra_cents: 100 },
    { eligible_orders: 100, adoption_rate: 0.8, extra_cents: 100 },
    { eligible_orders: 100, adoption_rate: 0.1, extra_cents: 2000 },
  ])("rejects invented eligible volume or excessive lift", (p) =>
    expect(() => potential(sales, p)).toThrow(),
  );
  test("peer math does not mutate source arrays", () => {
    const values = [5, 1, 3, 2];
    expect(median(values)).toBe(2.5);
    expect(values).toEqual([5, 1, 3, 2]);
    expect(cosine([1, 0], [0, 1])).toBe(0);
    expect(cosine([1, 0], [1, 0])).toBe(1);
  });
});
