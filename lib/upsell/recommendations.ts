export type UpsellPair = { source: string; target: string; orders: number };
export type AutomaticUpsellRecommendations = {
  items?: UpsellPair[];
  categories?: UpsellPair[];
  popular?: { target: string; orders: number }[];
};

// Uses precomputed historical associations; never queries orders during checkout.
export function rankAutomaticUpsells(
  recommendations: AutomaticUpsellRecommendations | null,
  cartProductIds: readonly string[],
  cartCategoryIds: readonly string[],
  availableIds: ReadonlySet<string>,
  limit = 5
): string[] {
  if (!recommendations) return [];
  const cartProducts = new Set(cartProductIds);
  const cartCategories = new Set(cartCategoryIds);
  const candidates = new Map<string, { priority: number; count: number }>();
  const add = (id: string, count: number, priority: number) => {
    if (!id || cartProducts.has(id) || !availableIds.has(id) || !Number.isFinite(count) || count < 1) return;
    const old = candidates.get(id);
    if (old && old.priority > priority) return;
    candidates.set(id, {
      priority,
      count: count + (old?.priority === priority ? old.count : 0),
    });
  };
  for (const match of recommendations.items ?? []) {
    if (cartProducts.has(match.source)) add(match.target, Number(match.orders), 3);
  }
  for (const match of recommendations.categories ?? []) {
    if (cartCategories.has(match.source)) add(match.target, Number(match.orders), 2);
  }
  for (const match of recommendations.popular ?? []) add(match.target, Number(match.orders), 1);
  return [...candidates.entries()].sort(([aid, a], [bid, b]) =>
    b.priority - a.priority || b.count - a.count || aid.localeCompare(bid))
    .slice(0, Math.max(0, limit)).map(([id]) => id);
}
