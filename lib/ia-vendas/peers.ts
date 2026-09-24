import OpenAI from "openai";
import { query } from "@/lib/database/sql";
import { metrics, window28 } from "./data";
import { SalesError, type Data } from "./types";
export function cosine(a: number[], b: number[]) {
  const aa = Math.sqrt(a.reduce((s, x) => s + x * x, 0)),
    bb = Math.sqrt(b.reduce((s, x) => s + x * x, 0));
  return aa && bb
    ? a.reduce((s, x, i) => s + x * (b[i] || 0), 0) / (aa * bb)
    : 0;
}
export function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const i = Math.floor(sorted.length / 2);
  return sorted.length
    ? sorted.length % 2
      ? sorted[i]
      : (sorted[i - 1] + sorted[i]) / 2
    : 0;
}
export async function benchmark(restaurant: string, ai: OpenAI) {
  const w = window28();
  const rows = (
    await query(
      `WITH volumes AS (SELECT restaurant_id,count(*)::int orders,avg((table_id IS NOT NULL)::int)::float table_mix,avg((lower(coalesce(is_delivery,'')) IN ('entrega','delivery','true'))::int)::float delivery_mix FROM public.orders WHERE status='done' AND created_at>=$2 AND created_at<$3 GROUP BY restaurant_id), menus AS (SELECT i.restaurant_id,left(string_agg(coalesce(c.name,'')||' '||i.name,' ' ORDER BY i.id),8000) menu FROM public.items i LEFT JOIN public.categories c ON c.id=i.category_id GROUP BY i.restaurant_id) SELECT r.id,r.name,r.url_slug,lower(coalesce(r.address->>'city',r.address->>'cidade','')) city,lower(coalesce(r.address->>'state',r.address->>'estado','')) state,v.*,m.menu,md5(m.menu) signature,e.signature cached_signature,e.vector FROM public.restaurants r JOIN volumes v ON v.restaurant_id=r.id JOIN menus m ON m.restaurant_id=r.id LEFT JOIN public.ia_vendas_embeddings e ON e.restaurant_id=r.id WHERE v.orders>=20 ORDER BY (r.id=$1) DESC,v.orders DESC LIMIT 100`,
      [restaurant, w.start, w.end],
    )
  ).rows;
  const own = rows.find((r) => r.id === restaurant);
  if (!own)
    return {
      available: false,
      reason:
        "Volume insuficiente para comparação: mínimo de 20 pedidos concluídos.",
    };
  const missing = rows.filter(
    (r) => r.signature !== r.cached_signature || !r.vector,
  );
  if (missing.length) {
    const response = await ai.embeddings.create({
      model: "text-embedding-3-small",
      dimensions: 256,
      input: missing.map((r) => r.menu),
    });
    for (let i = 0; i < missing.length; i++) {
      missing[i].vector = response.data[i].embedding;
      await query(
        "INSERT INTO public.ia_vendas_embeddings (restaurant_id,signature,vector) VALUES ($1,$2,$3::jsonb) ON CONFLICT(restaurant_id) DO UPDATE SET signature=excluded.signature,vector=excluded.vector,updated_at=now()",
        [
          missing[i].id,
          missing[i].signature,
          JSON.stringify(missing[i].vector),
        ],
      );
    }
  }
  const peers = rows
    .filter((r) => r.id !== restaurant)
    .map((r) => {
      const semantic = cosine(own.vector, r.vector),
        volume =
          Math.min(own.orders, r.orders) / Math.max(own.orders, r.orders),
        mix =
          1 -
          (Math.abs(own.table_mix - r.table_mix) +
            Math.abs(own.delivery_mix - r.delivery_mix)) /
            2,
        region =
          own.city && own.city === r.city
            ? 1
            : own.state && own.state === r.state
              ? 0.5
              : 0;
      return {
        ...r,
        semantic,
        volume,
        mix,
        score: 0.6 * semantic + 0.2 * volume + 0.15 * mix + 0.05 * region,
      };
    })
    .filter((r) => r.semantic >= 0.65 && r.volume >= 0.2 && r.mix >= 0.65)
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);
  if (peers.length < 5)
    return {
      available: false,
      reason:
        "Não há pelo menos cinco restaurantes suficientemente semelhantes para um benchmark anônimo.",
    };
  const data: Data[] = [];
  for (const peer of peers) data.push(await metrics(peer.id, w.start, w.end));
  return {
    available: true,
    count: peers.length,
    method:
      "Semelhança semântica do cardápio/nicho (60%), volume (20%), mix entrega/retirada/mesa (15%) e região (5%). Ticket não seleciona pares. Amostra de até 100 restaurantes ativos; medianas anônimas.",
    medians: Object.fromEntries(
      [
        "beverage_rate",
        "combo_rate",
        "units_per_order",
        "retention",
        "ticket_cents",
      ].map((k) => [k, median(data.map((r) => r[k]))]),
    ),
    public_menus: peers
      .filter((p) => p.url_slug)
      .slice(0, 3)
      .map((p) => ({
        name: p.name,
        url: `https://imenuapp.com.br/${encodeURIComponent(p.url_slug)}`,
      })),
  };
}
export function potential(sales: Data, input: Data) {
  const affected = Number(input.eligible_orders),
    adoption = Number(input.adoption_rate),
    lift = Number(input.extra_cents);
  if (sales.orders < 30)
    return {
      available: false,
      reason:
        "Ainda não há pedidos suficientes para uma estimativa responsável.",
    };
  if (
    ![affected, adoption, lift].every(Number.isFinite) ||
    affected < 0 ||
    affected > sales.orders ||
    adoption < 0 ||
    adoption > 0.25 ||
    lift < 0 ||
    lift > sales.ticket_cents
  )
    throw new SalesError(
      "Use hipóteses conservadoras: pedidos elegíveis observados, adesão até 25% e acréscimo até o ticket atual.",
    );
  const cents = Math.round(
    Math.min(
      (affected * adoption * lift * 28) / sales.days,
      (sales.revenue_cents * 0.15 * 28) / sales.days,
    ),
  );
  return {
    available: true,
    cents,
    formula: `${affected} pedidos elegíveis × ${(adoption * 100).toFixed(1)}% de adesão × R$ ${(lift / 100).toFixed(2)} adicionais × 28/${sales.days.toFixed(1)} dias. Teto de 15% da receita.`,
    assumptions: String(input.assumptions || "").slice(0, 2000),
    note: "Cenário estimado, sem garantia. Uma projeção conjunta para evitar dupla contagem; lucro depende dos custos informados.",
  };
}
