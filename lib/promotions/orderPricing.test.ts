import { automaticOrderPricing } from "./orderPricing";
import type { AutomaticPromotion } from "./automatic";

const restaurantId = "30000000-0000-4000-8000-000000000001";
const itemId = "10000000-0000-4000-8000-000000000001";
const promotion: AutomaticPromotion = {
  id: "20000000-0000-4000-8000-000000000001",
  name: "Oferta",
  active: true,
  show_on_menu: true,
  delivery: true,
  mesa: true,
  allow_coupon: false,
  rules: [],
  benefits: [{ type: "percent", value: 10 }],
};
const input = {
  restaurantId,
  promotions: [promotion],
  items: [
    {
      base_item_id: itemId,
      name: "Item",
      qty: 1,
      unit_price_cents: 5000,
      total_cents: 5000,
      selectedSubitems: [],
    },
  ],
  subtotal_cents: 5000,
  delivery_cents: 800,
  coupon_discount_cents: 0,
  channel: "delivery" as const,
  pickup: false,
  at: new Date("2026-09-08T12:00:00Z"),
};

it("does not query or change the old cart when there are no automatic promotions", async () => {
  const client = { query: jest.fn() };
  const result = await automaticOrderPricing(client as any, {
    ...input,
    promotions: [],
  });
  expect(client.query).not.toHaveBeenCalled();
  expect(result.items).toBe(input.items);
  expect(result.result.total_cents).toBe(5800);
});

it("uses the database price, not inflated client values, to qualify minimum spend", async () => {
  const client = {
    query: jest
      .fn()
      .mockResolvedValue({
        rows: [
          { id: itemId, name: "Item", price_cents: 3000, is_available: true },
        ],
      }),
  };
  const result = await automaticOrderPricing(client as any, {
    ...input,
    promotions: [
      {
        ...promotion,
        rules: [{ type: "minimum", cents: 4000, comparison: "gte" }],
      },
    ],
  });
  expect(result.result.promotion).toBeNull();
});

it("reconstructs paid extras and preserves the validated loyalty object", async () => {
  const client = {
    query: jest
      .fn()
      .mockImplementation(async (sql: string) => ({
        rows: sql.includes("FROM subitems")
          ? [
              {
                id: "extra",
                item_id: itemId,
                name: "Extra",
                price_cents: 500,
                is_available: true,
              },
            ]
          : [
              {
                id: itemId,
                name: "Item",
                price_cents: 3000,
                is_available: true,
              },
            ],
      })),
  };
  const reward = {
    ...input.items[0],
    is_reward: true,
    total_cents: 0,
    unit_price_cents: 0,
  };
  const result = await automaticOrderPricing(client as any, {
    ...input,
    items: [
      {
        ...input.items[0],
        selectedSubitems: [{ subitemId: "extra", price_cents: 1, quantity: 2 }],
      },
      reward,
    ],
  });
  expect(result.subtotal_cents).toBe(4000);
  expect(result.result.total_cents).toBe(4400);
  expect(result.items[0].selectedSubitems[0].price_cents).toBe(500);
  expect(result.items[1]).toBe(reward);
});

it("checks category membership against the catalog rather than untrusted cart values", async () => {
  const category = "40000000-0000-4000-8000-000000000001";
  const other = "40000000-0000-4000-8000-000000000002";
  const client = { query: jest.fn().mockResolvedValue({ rows: [
    { id: itemId, name: "Item", category_id: category, price_cents: 5000, is_available: true },
  ] }) };
  const good = await automaticOrderPricing(client as any, {
    ...input, promotions: [{ ...promotion, rules: [{ type: "category", category_id: category, quantity: 1 }] }],
    items: [{ ...input.items[0], category_id: other }],
  });
  expect(good.result.discount_cents).toBe(500);
  expect(client.query.mock.calls[0][0]).toContain("i.category_id");
  const bad = await automaticOrderPricing(client as any, {
    ...input, promotions: [{ ...promotion, rules: [{ type: "category", category_id: other, quantity: 1 }] }],
    items: [{ ...input.items[0], category_id: other }],
  });
  expect(bad.result.promotion).toBeNull();
});

it("rejects unavailable extras before inserting an order", async () => {
  const client = {
    query: jest
      .fn()
      .mockImplementation(async (sql: string) => ({
        rows: sql.includes("FROM subitems")
          ? []
          : [
              {
                id: itemId,
                name: "Item",
                price_cents: 3000,
                is_available: true,
              },
            ],
      })),
  };
  await expect(
    automaticOrderPricing(client as any, {
      ...input,
      items: [
        { ...input.items[0], selectedSubitems: [{ subitemId: "extra" }] },
      ],
    }),
  ).rejects.toThrow("complemento");
});
