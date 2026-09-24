import type { PoolClient } from "pg";
import { query } from "@/lib/database/sql";
import { createSupabaseServerClient } from "@/lib/database/supabaseServerClient";
import { fields, key, scope } from "./catalog";
import { SalesError, type Data } from "./types";
export function imageUrl(path: string | null, bucket = "menu-images") {
  if (!path) return null;
  if (/^https:\/\//.test(path)) return path;
  if (path.includes("://")) return null;
  return createSupabaseServerClient().storage.from(bucket).getPublicUrl(path)
    .data.publicUrl;
}
export async function readData(restaurant: string, entity: string, offset = 0) {
  const cols = [...new Set([key(entity), ...Object.keys(fields(entity))])];
  if (!Number.isInteger(offset) || offset < 0 || offset > 10000)
    throw new SalesError("Página inválida.");
  const rows = (
    await query(
      `SELECT ${cols.map((k) => `t.${k}`).join(",")} FROM public.${entity} t WHERE ${scope(entity)} ORDER BY t.${key(entity)} LIMIT 51 OFFSET $2`,
      [restaurant, offset],
    )
  ).rows;
  return {
    rows: rows
      .slice(0, 50)
      .map((r) =>
        entity === "items" ? { ...r, image_url: imageUrl(r.image_path) } : r,
      ),
    has_more: rows.length > 50,
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
    (SELECT coalesce(jsonb_agg(p),'[]'::jsonb) FROM (SELECT item_id,max(name) name,sum(quantity)::int units,count(DISTINCT order_id)::int orders,sum(total_cents)::float gross_cents,count(DISTINCT order_id) FILTER(WHERE order_id IN (SELECT order_id FROM lines WHERE beverage))::int with_beverage FROM lines GROUP BY item_id ORDER BY sum(total_cents) DESC LIMIT 100) p) products`,
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
export async function context(restaurant: string) {
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
        "SELECT id,title,reason,status,operations,applied_at,undone_at FROM public.ia_vendas_actions WHERE restaurant_id=$1 ORDER BY created_at DESC LIMIT 25",
        [restaurant],
      ),
      query(
        "SELECT result,finished_at FROM public.ia_vendas_runs WHERE restaurant_id=$1 AND kind='analysis' AND status='completed' ORDER BY finished_at DESC LIMIT 1",
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
      "SELECT id,title,applied_at FROM public.ia_vendas_actions WHERE restaurant_id=$1 AND status='applied' AND applied_at<now()-interval '1 day' ORDER BY applied_at DESC LIMIT 8",
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
    note: "Comparação observacional em janelas iguais. Não é teste A/B nem atribuição causal; tráfego, sazonalidade e mudanças simultâneas influenciam os resultados.",
  };
}
