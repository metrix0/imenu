import type { PoolClient } from "pg";
import { query, withTransaction } from "@/lib/database/sql";
import { createSupabaseServerClient } from "@/lib/database/supabaseServerClient";
import { FIELDS } from "./fields";
import { fields, key, scope } from "./catalog";
import { SalesError, type Data } from "./types";
export function imageUrl(path: string | null, bucket = "menu-images") {
  if (!path) return null;
  if (/^https:\/\//.test(path)) return path;
  if (path.includes("://")) return null;
  return createSupabaseServerClient().storage.from(bucket).getPublicUrl(path)
    .data.publicUrl;
}
export async function readData(
  restaurant: string,
  entity: string,
  offset = 0,
  complete = false,
  client?: PoolClient,
) {
  const cols = [...new Set([key(entity), ...Object.keys(fields(entity))])],
    order =
      {
        categories: "t.position,t.id",
        items:
          "(SELECT c.position FROM public.categories c WHERE c.id=t.category_id),t.position,t.id",
        item_subcategories: "t.item_id,t.position,t.id",
        subitems: "t.item_subcategory_id,t.position,t.id",
        upsell: "t.position,t.id",
      }[entity] || `t.${key(entity)}`;
  if (!Number.isInteger(offset) || offset < 0 || offset > 10000)
    throw new SalesError("Página inválida.");
  const execute = client
    ? (sql: string, params: any[]) => client.query(sql, params)
    : query;
  const rows = (
    await execute(
      `SELECT ${cols.map((k) => `t.${k}`).join(",")} FROM public.${entity} t WHERE ${scope(entity)} ORDER BY ${order} ${complete ? "" : "LIMIT 51 OFFSET $2"}`,
      complete ? [restaurant] : [restaurant, offset],
    )
  ).rows;
  return {
    rows: rows
      .slice(0, complete ? rows.length : 50)
      .map((r) =>
        entity === "items" ? { ...r, image_url: imageUrl(r.image_path) } : r,
      ),
    has_more: !complete && rows.length > 50,
    next_offset: offset + 50,
  };
}
export const window28 = () => ({
  start: new Date(Date.now() - 28 * 86400000).toISOString(),
  end: new Date().toISOString(),
});
export async function metrics(
  restaurant: string,
  start: string,
  end: string,
  client?: PoolClient,
  complete = false,
): Promise<Data> {
  const days = (Date.parse(end) - Date.parse(start)) / 86400000;
  if (!Number.isFinite(days) || days <= 0 || days > 366)
    throw new SalesError("Use um período de até 366 dias.");
  const execute = client
    ? (sql: string, params: any[]) => client.query(sql, params)
    : query;
  const result = await execute(
    `WITH selected AS (
    SELECT id,greatest(total_cents-delivery_cents,0) revenue,customer_phone,is_delivery,table_id FROM public.orders WHERE restaurant_id=$1 AND status='done' AND created_at >= $2 AND created_at < $3
  ), lines AS (
    SELECT oi.*, (coalesce(c.name,'')||' '||oi.name ~* 'bebida|refrigerante|suco|cerveja|água|agua|coca|guaran[aá]|drink') beverage,
      (coalesce(c.name,'')||' '||oi.name ~* 'combo|combinado|kit |barca') combo
    FROM public.order_items oi JOIN selected s ON s.id=oi.order_id LEFT JOIN public.items i ON i.id=oi.item_id LEFT JOIN public.categories c ON c.id=i.category_id
  ), customers AS (SELECT count(*) n FROM selected WHERE nullif(customer_phone,'') IS NOT NULL GROUP BY customer_phone)
  SELECT (SELECT count(*)::int FROM selected) orders,
    (SELECT coalesce(sum(revenue),0)::float FROM selected) revenue_cents,
    (SELECT coalesce(sum(quantity),0)::int FROM lines) units,
    (SELECT count(DISTINCT order_id)::int FROM lines WHERE beverage) beverage_orders,
    (SELECT count(DISTINCT order_id)::int FROM lines WHERE combo) combo_orders,
    (SELECT count(*)::int FROM customers) identified_customers,
    (SELECT count(*)::int FROM customers WHERE n>=2) repeat_customers,
    (SELECT count(*)::int FROM selected WHERE table_id IS NOT NULL) table_orders,
    (SELECT count(*)::int FROM selected WHERE table_id IS NULL AND lower(coalesce(is_delivery,'')) IN ('entrega','delivery','true')) delivery_orders,
    (SELECT coalesce(jsonb_agg(p),'[]'::jsonb) FROM (SELECT item_id,max(name) name,sum(quantity)::int units,count(DISTINCT order_id)::int orders,sum(total_cents)::float gross_cents,count(DISTINCT order_id) FILTER(WHERE order_id IN (SELECT order_id FROM lines WHERE beverage))::int with_beverage FROM lines GROUP BY item_id ORDER BY sum(total_cents) DESC ${complete ? "" : "LIMIT 100"}) p) products`,
    [restaurant, start, end],
  );
  const r = result.rows[0];
  return {
    ...r,
    start,
    end,
    days,
    ticket_cents: r.orders ? r.revenue_cents / r.orders : 0,
    units_per_order: r.orders ? r.units / r.orders : 0,
    beverage_rate: r.orders ? r.beverage_orders / r.orders : 0,
    combo_rate: r.orders ? r.combo_orders / r.orders : 0,
    retention: r.identified_customers
      ? r.repeat_customers / r.identified_customers
      : 0,
    method:
      "Pedidos concluídos; receita líquida de entrega após descontos. Produtos: receita bruta. Bebidas/combos classificados por nomes; conferir ambiguidades. Retenção entre clientes identificados no período.",
  };
}
export async function context(restaurant: string, deep = false) {
  if (deep) return analysisContext(restaurant);
  const w = window28();
  const [r, items, categories, sales, memory, actions, last] =
    await Promise.all([
      readData(restaurant, "restaurants"),
      readData(restaurant, "items"),
      readData(restaurant, "categories"),
      metrics(restaurant, w.start, w.end),
      query(
        "SELECT instructions FROM public.ia_vendas_memory WHERE restaurant_id=$1",
        [restaurant],
      ),
      query(
        "SELECT id,title,reason,status,operations,applied_at,undone_at FROM public.ia_vendas_actions WHERE restaurant_id=$1 AND NOT EXISTS(SELECT 1 FROM public.ia_vendas_runs r WHERE r.restaurant_id=$1 AND r.id=ia_vendas_actions.run_id AND r.result->>'detached_at' IS NOT NULL) ORDER BY created_at DESC LIMIT 25",
        [restaurant],
      ),
      query(
        "SELECT result,finished_at FROM public.ia_vendas_runs WHERE restaurant_id=$1 AND kind='analysis' AND result->>'detached_at' IS NULL AND status='completed' ORDER BY finished_at DESC LIMIT 1",
        [restaurant],
      ),
    ]);
  return {
    restaurant: r.rows[0],
    items,
    categories,
    sales,
    instructions: memory.rows[0]?.instructions || "",
    actions: actions.rows,
    last_analysis: last.rows[0] || null,
  };
}
export async function measure(restaurant: string) {
  const actions = (
    await query(
      "SELECT id,title,applied_at FROM public.ia_vendas_actions WHERE restaurant_id=$1 AND NOT EXISTS(SELECT 1 FROM public.ia_vendas_runs r WHERE r.restaurant_id=$1 AND r.id=ia_vendas_actions.run_id AND r.result->>'detached_at' IS NOT NULL) AND status='applied' AND applied_at<now()-interval '1 day' ORDER BY applied_at DESC LIMIT 8",
      [restaurant],
    )
  ).rows;
  const results = [];
  for (const a of actions) {
    const t = Date.parse(a.applied_at),
      duration = Math.min(Date.now() - t, 28 * 86400000);
    const [before, after] = await Promise.all([
      metrics(
        restaurant,
        new Date(t - duration).toISOString(),
        new Date(t).toISOString(),
      ),
      metrics(
        restaurant,
        new Date(t).toISOString(),
        new Date(t + duration).toISOString(),
      ),
    ]);
    delete before.products;
    delete after.products;
    results.push({ id: a.id, title: a.title, before, after });
  }
  return {
    results,
    note: "Comparamos períodos de mesma duração antes e depois. Outras mudanças, visitas e épocas do ano também podem afetar as vendas.",
  };
}

function shortText(value: unknown, max = 180) {
  const text = typeof value === "string" ? value.trim() : "";
  return text.length > max ? text.slice(0, max - 1) + "…" : text || null;
}

export function analysisModelContext(ctx: Data): Data {
  const entities = ctx.entities || {};
  const rows = (entity: string): Data[] => entities[entity]?.rows || [];
  const products: Data[] = ctx.sales?.products || [];
  const sold = new Map(products.map((p) => [p.item_id, p]));
  const items = [...rows("items")].sort(
    (a, b) =>
      Number(sold.get(b.id)?.gross_cents || 0) -
        Number(sold.get(a.id)?.gross_cents || 0) ||
      Number(sold.get(b.id)?.units || 0) - Number(sold.get(a.id)?.units || 0),
  );
  const focusItems = [
    ...items.filter((item) => sold.has(item.id)),
    ...items.filter((item) => !sold.has(item.id)),
  ].slice(0, 30);
  const names = new Map<string, Data[]>();
  for (const item of items) {
    const normalized = String(item.name || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
    if (!normalized) continue;
    names.set(normalized, [...(names.get(normalized) || []), item]);
  }
  const duplicates = [...names.values()]
    .filter((group) => group.length > 1)
    .slice(0, 12)
    .map((group) => group.map((item) => ({ id: item.id, name: item.name })));
  const trimRows = (entity: string, limit: number, map?: (row: Data) => Data) => {
    const source = rows(entity);
    return {
      rows: source.slice(0, limit).map((row) => (map ? map(row) : row)),
      total: source.length,
      truncated: source.length > limit,
    };
  };
  const compactReport = (entry: Data) => ({
    id: entry.id,
    finished_at: entry.finished_at,
    headline: entry.report?.headline,
    summary: entry.report?.summary,
    opportunities: (entry.report?.opportunities || []).slice(0, 5).map((o: Data) => ({
      title: o.title,
      explanation: o.explanation,
      action_ids: o.action_ids,
    })),
  });
  const imageReview = ctx.image_review || {};
  return {
    restaurant: ctx.restaurant,
    coverage: ctx.coverage,
    sales: { ...ctx.sales, products: products.slice(0, 30) },
    catalog: {
      entity_counts: Object.fromEntries(
        Object.keys(entities).map((entity) => [entity, rows(entity).length]),
      ),
      categories: trimRows("categories", 30),
      focus_items: {
        total: items.length,
        rows: focusItems.map((item) => ({
          id: item.id,
          category_id: item.category_id,
          name: item.name,
          description: shortText(item.description),
          price_cents: item.price_cents,
          image: !!item.image_path,
          is_available: item.is_available,
          position: item.position,
          sales: sold.get(item.id) || null,
        })),
        truncated: items.length > focusItems.length,
      },
      missing_images: items
        .filter((item) => !item.image_path)
        .slice(0, 20)
        .map((item) => ({ id: item.id, name: item.name, sales: sold.get(item.id) || null })),
      missing_descriptions: items
        .filter((item) => !shortText(item.description))
        .slice(0, 20)
        .map((item) => ({ id: item.id, name: item.name, sales: sold.get(item.id) || null })),
      duplicate_names: duplicates,
      selection_rules: trimRows("item_subcategories", 60, (row) => ({
        id: row.id,
        item_id: row.item_id,
        name: row.name,
        position: row.position,
        min_select: row.min_select,
        max_select: row.max_select,
        allow_multiple_units: row.allow_multiple_units,
      })),
      subitems: trimRows("subitems", 60, (row) => ({
        id: row.id,
        item_subcategory_id: row.item_subcategory_id,
        name: row.name,
        price_cents: row.price_cents,
        is_available: row.is_available,
        position: row.position,
      })),
      upsells: trimRows("upsell", 20),
      promotions: trimRows("promotions", 20),
      coupons: trimRows("coupons", 12),
      loyalty_programs: trimRows("loyalty_programs", 8),
      menu: trimRows("menu", 8),
      restaurant_tables: { total: rows("restaurant_tables").length },
      tracking_integrations: trimRows("tracking_integrations", 6),
    },
    instructions: ctx.instructions,
    actions: (ctx.actions || []).slice(0, 15).map((action: Data) => ({
      id: action.id,
      title: action.title,
      reason: shortText(action.reason),
      status: action.status,
      applied_at: action.applied_at,
      undone_at: action.undone_at,
    })),
    prior_analyses: (ctx.prior_analyses || []).slice(0, 1).map(compactReport),
    peers: ctx.peers,
    traffic: ctx.traffic,
    measurement: ctx.measurement,
    image_review: {
      loaded: imageReview.loaded || 0,
      unavailable: imageReview.unavailable || 0,
      missing: imageReview.missing || 0,
      not_reviewed: imageReview.not_reviewed || 0,
      photos: (imageReview.photos || [])
        .filter((photo: Data) => photo.status === "loaded" || photo.status === "unavailable")
        .slice(0, 8),
    },
  };
}

/** One consistent, tenant-scoped snapshot; no model-driven pagination or row caps. */
async function analysisContext(restaurant: string): Promise<Data> {
  return withTransaction(async (c) => {
    await c.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const entities: Data = {},
      coverage: Data = {};
    for (const entity of Object.keys(FIELDS)) {
      const data = await readData(restaurant, entity, 0, true, c);
      entities[entity] = data;
      coverage[entity] = {
        loaded: data.rows.length,
        total: data.rows.length,
        complete: true,
      };
    }
    const w = window28();
    const sales = await metrics(restaurant, w.start, w.end, c, true);
    const memory = await c.query(
      "SELECT instructions FROM public.ia_vendas_memory WHERE restaurant_id=$1",
      [restaurant],
    );
    const actions = await c.query(
      "SELECT id,title,reason,status,operations,applied_at,undone_at FROM public.ia_vendas_actions WHERE restaurant_id=$1 AND NOT EXISTS(SELECT 1 FROM public.ia_vendas_runs r WHERE r.restaurant_id=$1 AND r.id=ia_vendas_actions.run_id AND r.result->>'detached_at' IS NOT NULL) ORDER BY created_at DESC",
      [restaurant],
    );
    const prior = await c.query(
      "SELECT id,result->'report' report,finished_at FROM public.ia_vendas_runs WHERE restaurant_id=$1 AND kind='analysis' AND result->>'detached_at' IS NULL AND result->'report' IS NOT NULL ORDER BY created_at DESC LIMIT 3",
      [restaurant],
    );
    return {
      restaurant: entities.restaurants.rows[0],
      items: entities.items,
      categories: entities.categories,
      entities,
      coverage,
      sales,
      instructions: memory.rows[0]?.instructions || "",
      actions: actions.rows,
      prior_analyses: prior.rows,
      last_analysis: null,
    };
  });
}
