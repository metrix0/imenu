import { productReviewTargets, presentationItemIds, validateProductEstimate } from "../products";
import { analysisModelContext } from "../data";
import { LIMITS } from "../config";
import type { Data } from "../types";

jest.mock("@/lib/database/sql", () => ({ query: jest.fn() }));
jest.mock("@/lib/analytics/posthogConsumer", () => ({}));
jest.mock("../access", () => ({}));

const fixture = (): Data => ({
  entities: {
    items: { rows: [
      { id: "popular", name: "Caseiro", description: "Carne 180g. " + "Receita confirmada. ".repeat(30), price_cents: 2500, category_id: "cat", position: 8, image_path: "own/popular.png" },
      { id: "second", name: "Segundo", price_cents: 1599, category_id: "cat", position: 0 },
      { id: "fractional", name: "Fracionado", price_cents: 2550, category_id: "cat", position: 1 },
      { id: "hidden", name: "Oculto", is_available: false },
      { id: "empty", name: "Sem estoque", stock_enabled: true, stock_quantity: 0 },
    ] },
    categories: { rows: [{ id: "cat", name: "Caseiros", position: 2 }] },
    item_subcategories: { rows: [{ id: "additions", item_id: "popular", name: "Adicionais", min_select: 0, max_select: 3 }] },
  },
  sales: { products: [
    { item_id: "popular", gross_cents: 500000, units: 200 },
    { item_id: "second", gross_cents: 100000, units: 300 },
    { item_id: "hidden", gross_cents: 900000, units: 400 },
    { item_id: "empty", gross_cents: 800000, units: 400 },
  ] },
  image_review: { photos: [{ item_id: "popular", status: "loaded" }] },
  coverage: {}, actions: [],
});

test("focused context preserves the full recipe and ranks available products by real revenue", () => {
  const ctx = fixture(), targets = productReviewTargets(ctx);
  expect(targets.map((t) => t.item_id)).toEqual(["popular", "second", "fractional"]);
  expect(targets[0]).toMatchObject({ rank: 1, visible_position: 3, image_status: "loaded", category_name: "Caseiros" });
  const compact = analysisModelContext(ctx);
  expect(compact.catalog.product_review[0].description).toBe(ctx.entities.items.rows[0].description);
  expect(compact.catalog.product_review[0].selections).toEqual([{ id: "additions", name: "Adicionais", min_select: 0, max_select: 3 }]);
  expect(ctx.product_review.targets).toEqual(targets);
});

test("reviews every leading product up to the configured limit", () => {
  const ctx = fixture();
  ctx.entities.items.rows = Array.from({ length: 15 }, (_, i) => ({ id: `p-${i}`, name: `Produto ${i}` }));
  ctx.sales.products = ctx.entities.items.rows.map((item: Data, i: number) => ({ item_id: item.id, gross_cents: i * 1000 }));
  expect(productReviewTargets(ctx).map((t) => t.item_id)).toEqual(Array.from({ length: LIMITS.analysisProductReviews }, (_, i) => `p-${14 - i}`));
});

test("optional .99 pricing reduces only integer prices by one cent and states the observed volume loss", () => {
  const targets = productReviewTargets(fixture());
  expect(targets[0].pricing_99).toEqual({ already_99: false, candidate_cents: 2499, baseline_delta_cents: -200 });
  expect(targets[1].pricing_99).toEqual({ already_99: true, candidate_cents: null, baseline_delta_cents: null });
  expect(targets[2].pricing_99.candidate_cents).toBeNull();
});

test("only real presentation changes qualify for a product projection; price-only and unopened photos do not", () => {
  const ctx = fixture();
  const price = { operations: [{ entity: "items", kind: "update", id: "popular", before: { price_cents: 2500 }, values: { price_cents: 2499 } }] };
  const input = { opportunities: [{ kind: "menu_clarity", item_ids: ["popular"] }] };
  expect(presentationItemIds(ctx, [price]).size).toBe(0);
  expect(() => validateProductEstimate(ctx, input, [price])).toThrow("Preços ,99");
  const noChange = { operations: [{ entity: "items", kind: "update", id: "popular", before: { name: "Caseiro" }, values: { name: "Caseiro" } }] };
  expect(() => validateProductEstimate(ctx, input, [noChange])).toThrow();
  const copy = { operations: [{ entity: "items", kind: "update", id: "popular", before: { description: "Carne" }, values: { description: "Carne 180g" } }] };
  expect(() => validateProductEstimate(ctx, input, [copy])).not.toThrow();
  expect(presentationItemIds(ctx, [{ image_jobs: [{ target: "item", item_id: "popular" }, { target: "item", item_id: "second" }] }])).toEqual(new Set(["popular"]));
  const reorder = { operations: [{ entity: "categories", kind: "update", id: "cat", before: { position: 2 }, values: { position: 0 } }] };
  expect(presentationItemIds(ctx, [reorder])).toEqual(new Set(["popular", "second", "fractional"]));
  expect(() => validateProductEstimate(ctx, { opportunities: [{ kind: "menu_clarity", eligible_revenue_cents: 500000 }] }, [copy])).toThrow("quais produtos");
});
