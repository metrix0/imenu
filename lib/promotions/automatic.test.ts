import {
  evaluateAutomaticPromotions,
  parseAutomaticPromotions,
  promotionAvailable,
  promotionCartSubtotal,
  validateAutomaticPromotion,
  type AutomaticPromotion,
  type PromotionBenefit,
  type PromotionRule,
} from "./automatic";

const burger = "10000000-0000-4000-8000-000000000001";
const drink = "10000000-0000-4000-8000-000000000002";
const tuesday = new Date("2026-09-08T15:00:00Z");
const offer = (
  rules: PromotionRule[] = [],
  benefits: PromotionBenefit[] = [{ type: "delivery" }],
): AutomaticPromotion => ({
  id: "20000000-0000-4000-8000-000000000001",
  name: "Terça especial",
  active: true,
  show_on_menu: true,
  delivery: true,
  mesa: true,
  allow_coupon: false,
  rules,
  benefits,
});
const item = (id = burger, unit = 5000, qty = 1) => ({
  base_item_id: id,
  qty,
  unit_price_cents: unit,
  total_cents: unit * qty,
});
const products = [
  { id: burger, name: "Hambúrguer", price_cents: 5000, is_available: true },
  { id: drink, name: "Suco", price_cents: 1000, is_available: true },
];
const calculate = (p: AutomaticPromotion[], extra: Record<string, any> = {}) =>
  evaluateAutomaticPromotions(p, {
    items: [item()],
    products,
    subtotal_cents: 5000,
    delivery_cents: 800,
    coupon_discount_cents: 0,
    channel: "delivery",
    at: tuesday,
    ...extra,
  });

describe("automatic promotion rules and totals", () => {
  it("keeps the checkout and coupon unchanged without an automatic promotion", () => {
    expect(calculate([], { coupon_discount_cents: 700 })).toEqual({
      promotion: null,
      coupon_discount_cents: 700,
      discount_cents: 700,
      total_cents: 5100,
    });
  });
  it("applies Tuesday + strictly more than R$40 together", () => {
    const p = offer([
      { type: "weekdays", days: [2] },
      { type: "minimum", cents: 4000, comparison: "gt" },
    ]);
    expect(calculate([p]).total_cents).toBe(5000);
    expect(calculate([p], { subtotal_cents: 4000 }).promotion).toBeNull();
    expect(
      calculate([p], { at: new Date("2026-09-09T15:00:00Z") }).promotion,
    ).toBeNull();
  });
  it("uses Brasília weekdays at UTC midnight and on scheduled orders", () => {
    const p = offer([{ type: "weekdays", days: [2] }]);
    expect(
      promotionAvailable(p, "delivery", new Date("2026-09-09T02:59:59Z")),
    ).toBe(true);
    expect(
      promotionAvailable(p, "delivery", new Date("2026-09-09T03:00:00Z")),
    ).toBe(false);
    expect(calculate([p], { at: tuesday }).discount_cents).toBe(800);
  });
  it("checks channels independently and never discounts delivery on pickup or Mesa", () => {
    const p = { ...offer(), mesa: false };
    expect(calculate([p], { channel: "mesa" }).discount_cents).toBe(0);
    expect(calculate([p], { pickup: true }).discount_cents).toBe(0);
    expect(
      calculate(
        [{ ...offer([], [{ type: "fixed", cents: 500 }]), delivery: false }],
        { channel: "mesa" },
      ).total_cents,
    ).toBe(4500);
  });
  it("combines benefits, caps totals, and gives free delivery only once", () => {
    const p = offer(
      [],
      [
        { type: "fixed", cents: 1000 },
        { type: "percent", value: 10 },
        { type: "delivery" },
        { type: "delivery" },
      ],
    );
    expect(calculate([p]).total_cents).toBe(3600);
    expect(
      calculate([
        offer([], [{ type: "fixed", cents: 100_000 }, { type: "delivery" }]),
      ]).total_cents,
    ).toBe(0);
    expect(
      calculate([offer([], [{ type: "fixed", cents: 100_000 }])]).total_cents,
    ).toBe(800);
  });
  it("keeps the better coupon or automatic offer and only stacks when enabled", () => {
    const p = offer([], [{ type: "fixed", cents: 500 }]);
    expect(calculate([p], { coupon_discount_cents: 900 }).promotion).toBeNull();
    expect(calculate([p], { coupon_discount_cents: 200 }).discount_cents).toBe(
      500,
    );
    expect(
      calculate([{ ...p, allow_coupon: true }], { coupon_discount_cents: 200 })
        .discount_cents,
    ).toBe(700);
    expect(
      calculate([{ ...offer(), allow_coupon: true }], {
        coupon_type: "delivery",
        coupon_discount_cents: 800,
      }).discount_cents,
    ).toBe(800);
  });
  it("selects one automatic offer rather than stacking different offers", () => {
    expect(
      calculate([
        offer([], [{ type: "fixed", cents: 500 }]),
        offer([], [{ type: "percent", value: 20 }]),
      ]).discount_cents,
    ).toBe(1000);
  });
  it("uses the existing server coupon cap when stacking with free delivery", () => {
    const result = calculate([{ ...offer(), allow_coupon: true }], {
      subtotal_cents: 500,
      coupon_discount_cents: 1000,
    });
    expect(result.coupon_discount_cents).toBe(500);
    expect(result.promotion?.discount_cents).toBe(800);
    expect(result.total_cents).toBe(0);
  });
  it("does not apply a delivery coupon to a pickup order", () => {
    const result = calculate([offer([], [{ type: "fixed", cents: 500 }])], {
      pickup: true,
      coupon_type: "delivery",
      coupon_discount_cents: 800,
    });
    expect(result.coupon_discount_cents).toBe(0);
    expect(result.promotion?.discount_cents).toBe(500);
    expect(result.total_cents).toBe(4500);
  });
  it("counts required products across cart rows and excludes loyalty gifts", () => {
    const p = offer(
      [{ type: "product", item_id: burger, quantity: 2 }],
      [{ type: "fixed", cents: 500 }],
    );
    expect(calculate([p], { items: [item(), item()] }).discount_cents).toBe(
      500,
    );
    expect(
      calculate([p], { items: [item(), { ...item(), is_reward: true }] })
        .promotion,
    ).toBeNull();
  });
  it("discounts the free base product while keeping paid extras and extra units", () => {
    const p = offer(
      [{ type: "product", item_id: burger, quantity: 1 }],
      [{ type: "product", item_id: drink, quantity: 1 }],
    );
    const cart = [item(), item(drink, 1200, 2)];
    const result = calculate([p], { items: cart, subtotal_cents: 7400 });
    expect(result.discount_cents).toBe(1000);
    expect(result.total_cents).toBe(7200);
    expect(result.promotion?.benefits[0].label).toBe("1× Suco grátis");
  });
  it("requires additional free units when the purchased and free product match", () => {
    const p = offer(
      [{ type: "product", item_id: burger, quantity: 1 }],
      [{ type: "product", item_id: burger, quantity: 1 }],
    );
    expect(calculate([p]).promotion).toBeNull();
    expect(
      calculate([p], { items: [item(burger, 5000, 2)], subtotal_cents: 10_000 })
        .discount_cents,
    ).toBe(5000);
  });
  it("does not count the free product or delivery toward minimum spend", () => {
    const p = offer(
      [{ type: "minimum", cents: 5500, comparison: "gte" }],
      [{ type: "product", item_id: drink, quantity: 1 }],
    );
    expect(
      calculate([p], {
        items: [item(), item(drink, 1000)],
        subtotal_cents: 6000,
      }).promotion,
    ).toBeNull();
  });
  it("does not duplicate free units and keeps breakdown equal to the discount", () => {
    const p = {
      ...offer(
        [],
        [
          { type: "product", item_id: burger, quantity: 1 },
          { type: "product", item_id: burger, quantity: 1 },
        ],
      ),
      allow_coupon: true,
    };
    const result = calculate([p], { coupon_discount_cents: 4500 });
    expect(result.discount_cents).toBe(5000);
    expect(result.promotion?.discount_cents).toBe(500);
    expect(
      result.promotion?.benefits.reduce((n, b) => n + b.discount_cents, 0),
    ).toBe(500);
  });
  it("preserves product-level discounts and loyalty totals", () => {
    const cart = [
      { ...item(drink, 1200, 2), promotion: { type: "percent", value: 10 } },
      { ...item(), unit_price_cents: 0, total_cents: 0, is_reward: true },
    ];
    expect(promotionCartSubtotal(cart)).toBe(2160);
    expect(
      calculate(
        [offer([], [{ type: "product", item_id: drink, quantity: 1 }])],
        { items: cart, subtotal_cents: 2160 },
      ).discount_cents,
    ).toBe(900);
  });
  it("does not apply paused offers or unavailable required products", () => {
    expect(calculate([{ ...offer(), active: false }]).promotion).toBeNull();
    expect(
      calculate([offer([{ type: "product", item_id: burger, quantity: 1 }])], {
        products: products.map((p) => ({ ...p, is_available: false })),
      }).promotion,
    ).toBeNull();
  });
  it("rejects invalid configuration instead of turning malformed rules into unconditional discounts", () => {
    expect(validateAutomaticPromotion(offer())).toBeNull();
    expect(
      validateAutomaticPromotion(offer([{ type: "weekdays", days: [] }])),
    ).not.toBeNull();
    expect(
      validateAutomaticPromotion(offer([], [{ type: "percent", value: 101 }])),
    ).not.toBeNull();
    expect(
      parseAutomaticPromotions([
        {},
        { ...offer(), rules: [{ type: "unknown" }] },
        offer(),
      ]),
    ).toHaveLength(1);
  });
});
