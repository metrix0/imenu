import OpenAI from "openai";
import { query } from "@/lib/database/sql";
import { metrics, window28 } from "./data";
import { SalesError, type Data } from "./types";
import { isSellableItem } from "./products";
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
        "Não encontramos pelo menos cinco restaurantes parecidos o suficiente para uma comparação útil.",
    };
  const data: Data[] = [];
  for (const peer of peers) data.push(await metrics(peer.id, w.start, w.end));
  return {
    available: true,
    count: peers.length,
    method:
      "Comparação com restaurantes do iMenu que vendem produtos parecidos e têm volume e tipo de atendimento semelhantes ao seu. Quando possível, consideramos também a região. Os números mostram o valor típico desse grupo.",
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
export function potential(sales: Data, input: Data, items?: Data[]) {
  const days = input.days === undefined ? 28 : Number(input.days);
  if (sales.orders < 30)
    return {
      available: false,
      reason:
        "Ainda não há pedidos suficientes para uma estimativa responsável.",
    };
  if (!Number.isInteger(days) || ![7, 28].includes(days))
    throw new SalesError("Use uma projeção de 7 ou 28 dias.");
  if (!Array.isArray(input.opportunities)) {
    const affected = Number(input.eligible_orders),
      adoption = Number(input.adoption_rate),
      lift = Number(input.extra_cents);
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
    const baselineCents = (sales.revenue_cents * days) / sales.days,
      cents = Math.round(
        Math.min(
          (affected * adoption * lift * days) / sales.days,
          baselineCents * 0.15,
        ),
      );
    return {
      available: true,
      cents,
      days,
      percent: baselineCents > 0 ? cents / baselineCents : 0,
      formula: `Consideramos ${affected} pedidos em que a mudança pode ajudar, ${adoption.toLocaleString("pt-BR", { style: "percent", maximumFractionDigits: 1 })} deles aderindo e ${(lift / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} extras por adesão, projetados para ${days} dias. Para ser conservador, limitamos o cenário a 15% da receita atual.`,
      assumptions: String(input.assumptions || "").slice(0, 2000),
      note: "É uma estimativa, não uma garantia. O lucro depende dos custos do restaurante.",
    };
  }
  if (!input.opportunities.length || input.opportunities.length > 5)
    throw new SalesError("Inclua de uma a cinco oportunidades na estimativa.");

  const profiles: Record<
      string,
      { low: number; high: number; basis: "orders" | "revenue" }
    > = {
      cart_addon: { low: 0.1, high: 0.2, basis: "orders" },
      menu_clarity: { low: 0.02, high: 0.05, basis: "revenue" },
      proven_combo_visibility: {
        low: 0.03,
        high: 0.08,
        basis: "revenue",
      },
    },
    scale = days / Number(sales.days || 0),
    baselineCents = Number(sales.revenue_cents) * scale;

  if (!Number.isFinite(scale) || scale <= 0 || !Number.isFinite(baselineCents))
    throw new SalesError("Os dados do período não permitem estimar o potencial.");

  const groups = new Map<string, { min: number; max: number }>(),
    breakdown: Data[] = [];

  const observed = new Map<string, Data>((sales.products || []).map((p: Data) => [p.item_id, p]));
  const menu = items ? new Map(items.map((item) => [item.id, item])) : null;
  const owner = new Map<string, { index: number; high: number }>();
  const productSets = input.opportunities.map((opportunity: Data, index: number) => {
    if (opportunity.item_ids === undefined) return null;
    if (!profiles[opportunity.kind] || profiles[opportunity.kind].basis !== "revenue" ||
        !Array.isArray(opportunity.item_ids) || !opportunity.item_ids.length || opportunity.item_ids.length > 100)
      throw new SalesError("Informe os produtos observados para melhorias de apresentação ou combos.");
    const ids = [...new Set<string>(opportunity.item_ids)];
    for (const id of ids) {
      const product = observed.get(id), item = menu?.get(id);
      if (typeof id !== "string" || !product || !Number.isFinite(Number(product.gross_cents)) ||
          Number(product.gross_cents) < 0 || (menu && (!item || !isSellableItem(item))))
        throw new SalesError("Use somente produtos disponíveis com vendas observadas no período.");
      // A product gets one presentation lift, even across different labels/groups.
      // Combo visibility retains its existing profile instead of adding another clarity lift.
      const current = owner.get(id), high = profiles[opportunity.kind].high;
      if (!current || high > current.high) owner.set(id, { index, high });
    }
    return ids;
  });

  for (const [index, raw] of input.opportunities.entries()) {
    const opportunity = raw as Data,
      label = String(opportunity.label || `Oportunidade ${index + 1}`).slice(
        0,
        120,
      ),
      kind = String(opportunity.kind || ""),
      profile = profiles[kind],
      overlapGroup = String(
        opportunity.overlap_group || `opportunity-${index}`,
      ).slice(0, 80);

    if (!profile)
      throw new SalesError("Tipo de oportunidade inválido para estimativa.");

    let min = 0,
      max = 0,
      basis = "";

    if (profile.basis === "orders") {
      const eligibleOrders = Number(opportunity.eligible_orders),
        extraCents = Number(opportunity.extra_cents);
      if (
        ![eligibleOrders, extraCents].every(Number.isFinite) ||
        eligibleOrders < 0 ||
        eligibleOrders > sales.orders ||
        extraCents < 0 ||
        extraCents > sales.ticket_cents
      )
        throw new SalesError(
          "Use somente pedidos elegíveis e valores observados no restaurante.",
        );
      min = eligibleOrders * profile.low * extraCents * scale;
      max = eligibleOrders * profile.high * extraCents * scale;
      basis = `${eligibleOrders} pedidos em que a mudança pode ajudar, com ${(profile.low * 100).toFixed(0)}%–${(profile.high * 100).toFixed(0)}% deles acrescentando ${(extraCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} por pedido.`;
    } else {
      const ids = productSets[index];
      const counted = ids?.filter((id: string) => owner.get(id)?.index === index);
      const eligibleRevenue = counted
        ? counted.reduce((sum: number, id: string) => sum + Number(observed.get(id)!.gross_cents), 0)
        : Number(opportunity.eligible_revenue_cents);
      if (
        !Number.isFinite(eligibleRevenue) ||
        eligibleRevenue < 0 ||
        eligibleRevenue > sales.revenue_cents
      )
        throw new SalesError(
          "Use somente a receita observada dos produtos afetados.",
        );
      min = eligibleRevenue * profile.low * scale;
      max = eligibleRevenue * profile.high * scale;
      basis = `${(eligibleRevenue / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} em vendas dos produtos envolvidos, supondo ${(profile.low * 100).toFixed(0)}%–${(profile.high * 100).toFixed(0)}% de melhora.`;
      if (ids?.length && !counted?.length)
        basis = "Os produtos desta mudança já foram considerados em outra melhoria; seu ganho não foi somado novamente.";
    }

    breakdown.push({
      label,
      kind,
      min_cents: Math.round(min),
      max_cents: Math.round(max),
      basis,
    });

    const current = groups.get(overlapGroup);
    groups.set(
      overlapGroup,
      current
        ? { min: Math.max(current.min, min), max: Math.max(current.max, max) }
        : { min, max },
    );
  }

  const rawMin = [...groups.values()].reduce((sum, group) => sum + group.min, 0),
    rawMax = [...groups.values()].reduce((sum, group) => sum + group.max, 0),
    cap = baselineCents * 0.15,
    minCents = Math.round(Math.min(rawMin, cap)),
    maxCents = Math.round(Math.min(Math.max(rawMax, rawMin), cap)),
    minPercent = baselineCents > 0 ? minCents / baselineCents : 0,
    maxPercent = baselineCents > 0 ? maxCents / baselineCents : 0;

  return {
    available: true,
    min_cents: minCents,
    max_cents: maxCents,
    min_percent: minPercent,
    max_percent: maxPercent,
    cents: minCents,
    percent: minPercent,
    days,
    breakdown,
    formula:
      "A faixa combina cenários conservador e de maior adesão para cada mudança. O mesmo grupo de pedidos não é somado duas vezes e o total fica limitado a 15% da receita atual.",
    assumptions: String(input.assumptions || "").slice(0, 2000),
    note: "É uma estimativa, não uma garantia. O lucro depende dos custos do restaurante.",
  };
}
