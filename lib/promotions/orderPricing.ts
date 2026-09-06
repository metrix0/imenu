import type { PoolClient } from "pg";
import {
  evaluateAutomaticPromotions,
  parseAutomaticPromotions,
  promotionAvailable,
  promotionCartSubtotal,
  type PromotionCartItem,
  type PromotionProduct,
  type AutomaticPromotion,
  type PromotionResult,
} from "./automatic";

export class PromotionPricingError extends Error {}

// Read current catalog prices on the server before qualifying automatic offers.
// The original checkout remains untouched when the restaurant has no applicable offer.
export async function automaticOrderPricing(
  client: Pick<PoolClient, "query">,
  input: {
    restaurantId: string;
    promotions: AutomaticPromotion[];
    items: any[];
    subtotal_cents: number;
    delivery_cents: number;
    coupon_discount_cents: number;
    coupon_type?: string | null;
    channel: "delivery" | "mesa";
    pickup: boolean;
    at: Date;
  },
): Promise<{ result: PromotionResult; items: any[]; subtotal_cents: number }> {
  const applicable = parseAutomaticPromotions(input.promotions).filter((p) =>
    promotionAvailable(p, input.channel, input.at),
  );
  const original = evaluateAutomaticPromotions([], { ...input, products: [] });
  if (!applicable.length)
    return {
      result: original,
      items: input.items,
      subtotal_cents: input.subtotal_cents,
    };
  const productIds = [
    ...new Set([
      ...input.items.map((i) => String(i.item_id || i.base_item_id || "")),
      ...applicable.flatMap((p) =>
        [...p.rules, ...p.benefits].flatMap((r) =>
          r.type === "product" ? [r.item_id] : [],
        ),
      ),
    ]),
  ];
  const subitemIds = [
    ...new Set(
      input.items.flatMap((i) =>
        (Array.isArray(i.selectedSubitems) ? i.selectedSubitems : []).map(
          (s: any) => String(s.subitemId || ""),
        ),
      ),
    ),
  ];
  const productRows = await client.query(
    `SELECT i.id, i.name, i.price_cents, i.is_available,
        CASE WHEN p.id IS NOT NULL THEN jsonb_build_object('type', p.type, 'value', p.value) ELSE NULL END AS promotion
        FROM items i LEFT JOIN promotions p ON p.item_id = i.id AND p.starts_at <= $3 AND (p.ends_at >= $3 OR p.ends_at IS NULL)
        WHERE i.restaurant_id = $1 AND i.id = ANY($2::uuid[])`,
    [input.restaurantId, productIds, new Date()],
  );
  const products = productRows.rows as PromotionProduct[];
  const subitemsResult = subitemIds.length
    ? await client.query(
        `SELECT s.id, s.name, s.price_cents, s.is_available, g.item_id
        FROM subitems s JOIN item_subcategories g ON g.id = s.item_subcategory_id
        JOIN items i ON i.id = g.item_id WHERE i.restaurant_id = $1 AND s.id = ANY($2::uuid[])`,
        [input.restaurantId, subitemIds],
      )
    : { rows: [] };
  const pricedItems = input.items.map((item) => {
    const product = products.find(
      (p) => p.id === String(item.item_id || item.base_item_id),
    );
    if (!product || !product.is_available)
      throw new PromotionPricingError(
        "Um produto não está mais disponível. Atualize a sacola.",
      );
    if (!Number.isInteger(item.qty) || item.qty <= 0)
      throw new PromotionPricingError("Quantidade inválida.");
    // Loyalty redemption is validated by the existing order transaction.
    if (item.is_reward) return item;
    let extras = 0;
    const selectedSubitems = (
      Array.isArray(item.selectedSubitems) ? item.selectedSubitems : []
    ).map((selected: any) => {
      const subitem = subitemsResult.rows.find(
        (s) => s.id === selected.subitemId && s.item_id === product.id,
      );
      if (!subitem || !subitem.is_available)
        throw new PromotionPricingError(
          "Um complemento não está mais disponível. Atualize a sacola.",
        );
      const quantity = Math.max(
        1,
        Math.min(99, Math.round(Number(selected.quantity) || 1)),
      );
      extras += Number(subitem.price_cents) * quantity;
      return {
        ...selected,
        price_cents: Number(subitem.price_cents),
        subitemName: subitem.name,
        quantity,
      };
    });
    const unit = Number(product.price_cents) + extras;
    return {
      ...item,
      name: product.name,
      unit_price_cents: unit,
      total_cents: unit * item.qty,
      promotion: item.promotion ? product.promotion || undefined : undefined,
      selectedSubitems,
    };
  });
  const subtotal = promotionCartSubtotal(pricedItems as PromotionCartItem[]);
  const result = evaluateAutomaticPromotions(applicable, {
    ...input,
    items: pricedItems,
    products,
    subtotal_cents: subtotal,
  });
  if (!result.promotion)
    return {
      result: original,
      items: input.items,
      subtotal_cents: input.subtotal_cents,
    };

  if (result.free_products?.length) {
    throw new PromotionPricingError(
      "A promoção adicionou um item grátis. Confira a sacola antes de confirmar novamente.",
    );
  }

  const finalItems = pricedItems.map((item, index) => {
    if (!item.automatic_promotion_id) return item;
    const freeItem = result.free_items?.find((entry) => entry.cart_index === index);
    if (
      item.automatic_promotion_id !== result.promotion?.id ||
      !freeItem ||
      freeItem.quantity !== item.qty
    ) {
      throw new PromotionPricingError(
        "A promoção mudou. Atualize a sacola e confira os itens antes de confirmar novamente.",
      );
    }
    return {
      ...item,
      unit_price_cents: 0,
      total_cents: 0,
      promotion: undefined,
    };
  });

  return {
    result,
    items: finalItems,
    subtotal_cents: promotionCartSubtotal(finalItems as PromotionCartItem[]),
  };
}
