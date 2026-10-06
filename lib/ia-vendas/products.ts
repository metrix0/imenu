import { LIMITS } from "./config";
import { SalesError, type Data } from "./types";

export const PRODUCT_DIMENSIONS = [
  "name", "description", "image", "position", "pricing",
] as const;

export function isSellableItem(item: Data) {
  return item.is_available !== false &&
    (!item.stock_enabled || Number(item.stock_quantity) > 0);
}

// The same frozen targets feed the prompt, report coverage and Batch checkpoints.
export function productReviewTargets(ctx: Data): Data[] {
  const items: Data[] = ctx.entities?.items?.rows || ctx.items?.rows || [];
  const categories: Data[] = ctx.entities?.categories?.rows || ctx.categories?.rows || [];
  const sales = new Map<string, Data>(
    (ctx.sales?.products || []).map((p: Data) => [p.item_id, p]),
  );
  const photos = new Map<string, Data>(
    (ctx.image_review?.photos || []).map((p: Data) => [p.item_id, p]),
  );
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const available = items.filter((i) => isSellableItem(i) && String(i.name || "").trim());
  const sorted = [...available].sort((a, b) =>
    Number(sales.get(b.id)?.gross_cents || 0) - Number(sales.get(a.id)?.gross_cents || 0) ||
    Number(sales.get(b.id)?.units || 0) - Number(sales.get(a.id)?.units || 0) ||
    Number(categoryById.get(a.category_id)?.position || 0) - Number(categoryById.get(b.category_id)?.position || 0) ||
    Number(a.position || 0) - Number(b.position || 0) || String(a.id).localeCompare(String(b.id)),
  );
  return sorted.slice(0, LIMITS.analysisProductReviews).map((item, index) => {
    const sold = sales.get(item.id), category = categoryById.get(item.category_id);
    const peers = available.filter((i) => i.category_id === item.category_id).sort((a, b) =>
      Number(a.position || 0) - Number(b.position || 0) || String(a.id).localeCompare(String(b.id)),
    );
    const price = Number(item.price_cents);
    const candidate = Number.isSafeInteger(price) && price >= 100 && price % 100 === 0 ? price - 1 : null;
    return {
      item_id: item.id,
      rank: index + 1,
      name: item.name,
      // Keep the complete recipe for these few products, not the truncated catalogue text.
      description: item.description || null,
      price_cents: item.price_cents,
      category_id: item.category_id,
      category_name: category?.name || null,
      category_position: category?.position ?? null,
      position: item.position,
      visible_position: peers.findIndex((i) => i.id === item.id) + 1,
      sales: sold || null,
      image_status: photos.get(item.id)?.status || (item.image_path ? "not_reviewed" : "missing"),
      selections: (ctx.entities?.item_subcategories?.rows || [])
        .filter((g: Data) => g.item_id === item.id)
        .map((g: Data) => ({ id: g.id, name: g.name, min_select: g.min_select, max_select: g.max_select })),
      pricing_99: {
        already_99: Number.isSafeInteger(price) && price % 100 === 99,
        candidate_cents: candidate,
        // A one-cent reduction at the observed volume; this is not a sales-lift forecast.
        baseline_delta_cents: candidate === null ? null : -Number(sold?.units || 0),
      },
    };
  });
}

export function presentationItemIds(ctx: Data, actions: Data[]): Set<string> {
  const affected = new Set<string>();
  const items: Data[] = ctx.entities?.items?.rows || [];
  for (const action of actions) {
    for (const op of action.operations || []) {
      if (op.kind !== "update") continue;
      if (op.entity === "items" && ["name", "description", "position", "image_path"].some((k) =>
        Object.hasOwn(op.values || {}, k) && op.values[k] !== op.before?.[k],
      )) affected.add(op.id);
      if (op.entity === "categories" && Object.hasOwn(op.values || {}, "position") &&
          op.values.position !== op.before?.position)
        items.filter((i) => i.category_id === op.id).forEach((i) => affected.add(i.id));
    }
    for (const job of action.image_jobs || [])
      if (job.target === "item" && ctx.image_review?.photos?.some((p: Data) =>
        p.item_id === job.item_id && p.status === "loaded",
      )) affected.add(job.item_id);
  }
  return affected;
}

export function validateProductEstimate(ctx: Data, input: Data, actions: Data[]) {
  const affected = presentationItemIds(ctx, actions);
  for (const opportunity of input.opportunities || []) {
    if (opportunity.kind === "cart_addon") continue;
    if (!Array.isArray(opportunity.item_ids) || !opportunity.item_ids.length)
      throw new SalesError("Informe quais produtos entram na melhoria de apresentação ou dos combos.");
    if (opportunity.item_ids.some((id: string) => !affected.has(id)))
      throw new SalesError("Estime somente produtos com propostas de nome, descrição, foto ou posição. Preços ,99 não têm ganho separado.");
  }
}
