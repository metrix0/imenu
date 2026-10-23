import { createHash } from "node:crypto";
import { query, withTransaction } from "@/lib/database/sql";
import { createSupabaseServerClient } from "@/lib/database/supabaseServerClient";
import {
  getIMenuPublicUrl,
  sendWahaText,
  sendWahaList,
  sendWahaImage,
  type WahaListRow,
} from "./wahaClient";
import {
  parseAutomaticPromotions,
  promotionAvailable,
  promotionDescription,
} from "@/lib/promotions/automatic";
import {
  AUTOMATION_KINDS,
  readAutomationSettings,
  habitDue,
  normalizeCustomerPhone,
  type AutomationKind,
  type AutomationRule,
} from "./crmRules";
import { PURCHASE_SQL } from "./crm";

export type Offer = {
  value: string;
  label: string;
  text: string;
  link: string;
};
export async function automationOffers(
  restaurantId: string,
  at = new Date(),
): Promise<Offer[]> {
  const [restaurant, coupons, promotions, products, categories] =
    await Promise.all([
      query(
        "SELECT url_slug,automatic_promotions FROM restaurants WHERE id=$1",
        [restaurantId],
      ),
      query(
        `SELECT * FROM coupons WHERE restaurant_id=$1 AND active=true AND (start_date IS NULL OR start_date <= ($2::timestamptz AT TIME ZONE 'America/Sao_Paulo')::date) AND (end_date IS NULL OR end_date >= ($2::timestamptz AT TIME ZONE 'America/Sao_Paulo')::date) AND (unlimited_quantity OR coalesce(usage_count,0)<quantity)`,
        [restaurantId, at.toISOString()],
      ),
      query(
        `SELECT p.*,i.name FROM promotions p JOIN items i ON i.id=p.item_id AND i.restaurant_id=p.restaurant_id WHERE p.restaurant_id=$1 AND p.active=true AND (p.starts_at IS NULL OR p.starts_at<=$2) AND (p.ends_at IS NULL OR p.ends_at>=$2) AND i.is_available=true`,
        [restaurantId, at.toISOString()],
      ),
      query("SELECT id,name FROM items WHERE restaurant_id=$1", [restaurantId]),
      query("SELECT id,name FROM categories WHERE restaurant_id=$1", [
        restaurantId,
      ]),
    ]);
  const row = restaurant.rows[0];
  if (!row) return [];
  const menu = `${getIMenuPublicUrl()}/${encodeURIComponent(row.url_slug)}`;
  const money = (c: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(c / 100);
  const local = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Sao_Paulo",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  const hour =
    local.find((x) => x.type === "hour")!.value +
    ":" +
    local.find((x) => x.type === "minute")!.value;
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
    local.find((x) => x.type === "weekday")!.value,
  );
  return [
    ...coupons.rows
      .filter(
        (c) =>
          (!c.available_days?.length ||
            c.available_days.map(Number).includes(day)) &&
          (!c.start_time || hour >= String(c.start_time).slice(0, 5)) &&
          (!c.end_time || hour <= String(c.end_time).slice(0, 5)),
      )
      .map((c) => ({
        value: `coupon:${c.id}`,
        label: `Cupom: ${c.code}`,
        text: [
          `Cupom ${c.code}: ${c.discount_type === "percent" ? `${Number(c.discount_value) * 100}% de desconto` : c.discount_type === "delivery" ? "desconto na entrega" : `${money(Number(c.discount_value) * 100)} de desconto`}.`,
          c.min_order_value
            ? `Pedido mínimo: ${money(Number(c.min_order_value) * 100)}.`
            : "",
          c.max_discount_value
            ? `Desconto máximo: ${money(Number(c.max_discount_value) * 100)}.`
            : "",
          c.end_date
            ? `Válido até ${new Date(c.end_date).toLocaleDateString("pt-BR", { timeZone: "UTC" })}.`
            : "",
          "Sujeito às condições do cupom no checkout.",
        ]
          .filter(Boolean)
          .join("\n"),
        link: `${menu}?c=${encodeURIComponent(c.code)}`,
      })),
    ...promotions.rows.map((p) => ({
      value: `promotion:${p.id}`,
      label: `Promoção: ${p.name}`,
      text: `${p.name}: ${p.type === "percent" ? `${p.value}% de desconto` : `${money(Number(p.value))} de desconto`}.${p.ends_at ? ` Válida até ${new Date(p.ends_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}.` : ""}`,
      link: `${menu}?p=${encodeURIComponent(p.item_id)}`,
    })),
    ...parseAutomaticPromotions(row.automatic_promotions)
      .filter((p) => promotionAvailable(p, "delivery", at))
      .map((p) => {
        const d = promotionDescription(p, products.rows, categories.rows);
        return {
          value: `automatic:${p.id}`,
          label: `Promoção: ${p.name}`,
          text: `${p.name}\n${d.benefits}\nCondições: ${d.conditions}.`,
          link: menu,
        };
      }),
  ];
}
export async function getCrmReply(
  restaurantId: string,
  phoneValue: string | null,
  body: string,
): Promise<{ text?: string; rows: WahaListRow[] } | null> {
  const phone = normalizeCustomerPhone(phoneValue);
  if (!phone) return null;
  const normalized = body
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (["sair", "parar", "cancelar ofertas", "stop"].includes(normalized)) {
    await query(
      `INSERT INTO customers (restaurant_id,phone,opted_out_at,marketing_consent) VALUES ($1,$2,now(),false) ON CONFLICT (restaurant_id,phone) DO UPDATE SET opted_out_at=now(),marketing_consent=false,updated_at=now()`,
      [restaurantId, phone],
    );
    await query(
      "UPDATE checkout_sessions SET marketing_consent=false WHERE restaurant_id=$1 AND phone=$2",
      [restaurantId, phone],
    );
    return {
      text: "Tudo certo! Você não receberá mais ofertas automáticas. O cardápio continua disponível quando quiser.",
      rows: [{ title: "Ver cardápio", rowId: "menu_link" }],
    };
  }
  const last = await query(
    "SELECT context FROM whatsapp_outbound_messages WHERE restaurant_id=$1 AND customer_phone=$2 AND automation_type IN ('cart','reactivation','habit') AND status='sent' AND created_at>now()-interval '7 days' ORDER BY created_at DESC LIMIT 1",
    [restaurantId, phone],
  );
  if (!last.rows[0]) return null;
  const offer = String(last.rows[0].context?.offer || "");
  if (
    normalized === "crm_offer" ||
    normalized === "quero a promocao" ||
    normalized === "receber promocao"
  ) {
    const current = (await automationOffers(restaurantId)).find(
      (x) => x.value === offer,
    );
    const restaurant = await query(
      "SELECT url_slug FROM restaurants WHERE id=$1",
      [restaurantId],
    );
    const link = `${getIMenuPublicUrl()}/${encodeURIComponent(restaurant.rows[0]?.url_slug || "")}`;
    return {
      text: current
        ? `${current.text}\n\n${current.link}`
        : `Essa oferta não está disponível agora. Confira o cardápio atualizado:\n${link}`,
      rows: [{ title: "Ver cardápio", rowId: "menu_link" }],
    };
  }
  if (
    [
      "menu_link",
      "cardapio",
      "ver cardapio",
      "ver o cardapio",
      "fazer pedido",
    ].includes(normalized)
  )
    return null;
  // Operational flows (tracking, delivery, human handoff) keep their existing menu behavior.
  if (
    [
      "order_status",
      "delivery",
      "payment",
      "handoff",
      "1",
      "2",
      "3",
      "4",
      "5",
    ].includes(normalized) ||
    normalized.includes("codigo imenu")
  )
    return null;
  return {
    rows: [
      {
        title: offer ? "Quero a promoção" : "Ver cardápio",
        rowId: offer ? "crm_offer" : "menu_link",
      },
    ],
  };
}

type Candidate = {
  phone: string;
  name: string | null;
  identity: string;
  session_id?: string;
  image_path?: string | null;
  last_purchase?: string;
  dates?: string[];
};
async function candidates(
  id: string,
  kind: AutomationKind,
  rule: AutomationRule,
): Promise<Candidate[]> {
  const eligible = `AND NOT EXISTS(SELECT 1 FROM whatsapp_outbound_messages h WHERE h.restaurant_id=$1 AND h.customer_phone=c.phone AND h.automation_type=$3 AND h.created_at>now()-($2::int*interval '1 day'))`;
  if (kind === "cart")
    return (
      await query<Candidate>(
        `
        SELECT DISTINCT ON(s.phone) s.phone,coalesce(c.name,'Cliente') name,s.id::text identity,s.id session_id,
          i.image_path
        FROM checkout_sessions s LEFT JOIN customers c ON c.restaurant_id=s.restaurant_id AND c.phone=s.phone
        LEFT JOIN LATERAL (SELECT it.image_path FROM jsonb_array_elements(s.items) x JOIN items it ON it.id=(x->>'item_id')::uuid AND it.restaurant_id=s.restaurant_id ORDER BY (x->>'unit_price_cents')::numeric DESC LIMIT 1) i ON true
        WHERE s.restaurant_id=$1 AND s.phone IS NOT NULL AND s.marketing_consent AND s.completed_at IS NULL
          AND s.updated_at<now()-interval '30 minutes' AND s.expires_at>now() AND jsonb_array_length(s.items)>0
          AND c.opted_out_at IS NULL
          AND NOT EXISTS(SELECT 1 FROM whatsapp_outbound_messages h WHERE h.restaurant_id=$1 AND h.customer_phone=s.phone AND h.automation_type='cart' AND h.created_at>now()-($2::int*interval '1 day'))
          AND NOT EXISTS(SELECT 1 FROM orders o WHERE o.restaurant_id=$1 AND public.crm_phone(o.customer_phone)=s.phone AND o.created_at>=s.created_at AND o.status<>'canceled')
          AND NOT EXISTS(SELECT 1 FROM checkout_sessions newer WHERE newer.restaurant_id=$1 AND newer.phone=s.phone AND newer.updated_at>s.updated_at AND newer.completed_at IS NULL)
        ORDER BY s.phone,s.updated_at DESC LIMIT 100`,
        [id, rule.cooldownDays],
      )
    ).rows;
  const rows = (
    await query<Candidate>(
      `
        SELECT c.phone,c.name,max(o.created_at)::text last_purchase,
         max(o.created_at)::text identity,
         array_agg(o.created_at::text ORDER BY o.created_at DESC) FILTER(WHERE o.created_at>now()-interval '90 days') dates
        FROM customers c JOIN orders o ON o.restaurant_id=c.restaurant_id AND public.crm_phone(o.customer_phone)=c.phone AND o.${PURCHASE_SQL}
        WHERE c.restaurant_id=$1 AND c.marketing_consent AND c.opted_out_at IS NULL ${eligible}
        GROUP BY c.phone,c.name ${kind === "reactivation" ? "HAVING max(o.created_at)<now()-($4::int*interval '1 day')" : "HAVING max(o.created_at)>now()-interval '30 days'"}
        ORDER BY max(o.created_at) LIMIT 500`,
      [
        id,
        rule.cooldownDays,
        kind,
        ...(kind === "reactivation" ? [rule.days] : []),
      ],
    )
  ).rows;
  if (kind !== "habit")
    return rows.map((r) => ({
      ...r,
      identity: `${r.identity}:${Math.floor(Date.now() / (rule.cooldownDays * 86400000))}`,
    }));
  return rows.flatMap((r) => {
    const due = habitDue(r.dates || []);
    return due ? [{ ...r, identity: due }] : [];
  });
}
async function claim(
  id: string,
  kind: AutomationKind,
  rule: AutomationRule,
  c: Candidate,
  offer: string,
): Promise<string | null> {
  return withTransaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      `crm:${id}`,
    ]);
    const key = `crm:${kind}:${id}:${createHash("sha256")
      .update(c.phone + ":" + c.identity)
      .digest("hex")
      .slice(0, 32)}`;
    const result = await client.query(
      `
         INSERT INTO whatsapp_outbound_messages(dedupe_key,restaurant_id,chat_id,message_type,status,automation_type,customer_phone,checkout_session_id,context)
         SELECT $1,$2,$3,'text','sending',$4,$5,$6,jsonb_build_object('offer',$7::text)
         WHERE (SELECT count(*) FROM whatsapp_outbound_messages WHERE restaurant_id=$2 AND automation_type=$4 AND status IN ('sent','sending','failed') AND created_at>=date_trunc('day',now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo')<$8
         AND NOT EXISTS(SELECT 1 FROM whatsapp_outbound_messages WHERE restaurant_id=$2 AND customer_phone=$5 AND automation_type=$4 AND status IN ('sent','sending','failed') AND created_at>now()-($9::int*interval '1 day'))
         AND NOT EXISTS(SELECT 1 FROM whatsapp_outbound_messages WHERE restaurant_id=$2 AND customer_phone=$5 AND automation_type IN ('cart','habit','reactivation') AND status IN ('sent','sending','failed') AND created_at>now()-interval '24 hours')
         AND NOT EXISTS(SELECT 1 FROM whatsapp_conversations WHERE restaurant_id=$2 AND chat_id=$3 AND (mode='storm' OR (mode='human' AND (human_until IS NULL OR human_until>now()))))
         AND NOT EXISTS(SELECT 1 FROM customers WHERE restaurant_id=$2 AND phone=$5 AND (opted_out_at IS NOT NULL OR NOT marketing_consent))
         AND ($4<>'cart' OR EXISTS(SELECT 1 FROM checkout_sessions s WHERE s.id=$6 AND s.restaurant_id=$2 AND s.phone=$5 AND s.marketing_consent AND s.completed_at IS NULL AND s.updated_at<now()-interval '30 minutes' AND s.expires_at>now() AND jsonb_array_length(s.items)>0
           AND NOT EXISTS(SELECT 1 FROM orders o WHERE o.restaurant_id=$2 AND public.crm_phone(o.customer_phone)=$5 AND o.created_at>=s.created_at AND o.status<>'canceled')
           AND NOT EXISTS(SELECT 1 FROM checkout_sessions newer WHERE newer.restaurant_id=$2 AND newer.phone=$5 AND newer.updated_at>s.updated_at AND newer.completed_at IS NULL)))
         AND ($4 NOT IN ('reactivation','habit') OR EXISTS(SELECT 1 FROM customers c WHERE c.restaurant_id=$2 AND c.phone=$5 AND c.marketing_consent AND c.opted_out_at IS NULL))
         AND ($4<>'reactivation' OR NOT EXISTS(SELECT 1 FROM orders o WHERE o.restaurant_id=$2 AND public.crm_phone(o.customer_phone)=$5 AND o.status NOT IN ('canceled','pending_online_payment') AND o.created_at>now()-($10::int*interval '1 day')))
         AND ($4<>'habit' OR NOT EXISTS(SELECT 1 FROM orders o WHERE o.restaurant_id=$2 AND public.crm_phone(o.customer_phone)=$5 AND o.status<>'canceled' AND o.created_at>now()-interval '24 hours'))
         ON CONFLICT DO NOTHING RETURNING dedupe_key`,
      [
        key,
        id,
        `${c.phone}@c.us`,
        kind,
        c.phone,
        c.session_id || null,
        offer,
        rule.dailyLimit,
        rule.cooldownDays,
        rule.days,
      ],
    );
    return result.rows[0]?.dedupe_key || null;
  });
}
export async function processCustomerAutomations() {
  const restaurants = await query(
    `SELECT s.restaurant_id,s.automations,r.name,r.url_slug,w.session_name FROM whatsapp_bot_settings s JOIN restaurants r ON r.id=s.restaurant_id JOIN whatsapp_connections w ON w.restaurant_id=s.restaurant_id WHERE w.status='WORKING' AND w.desired_state='connected' AND (s.automations->'cart'->>'enabled'='true' OR s.automations->'habit'->>'enabled'='true' OR s.automations->'reactivation'->>'enabled'='true') ORDER BY s.restaurant_id`,
  );
  let sent = 0,
    failed = 0;
  const started = Date.now();
  for (const r of restaurants.rows) {
    const settings = readAutomationSettings(r.automations);
    for (const kind of AUTOMATION_KINDS) {
      const rule = settings[kind];
      if (!rule.enabled) continue;
      const budget = await query(
        "SELECT count(*)::int n FROM whatsapp_outbound_messages WHERE restaurant_id=$1 AND automation_type=$2 AND status IN ('sent','sending','failed') AND created_at>=date_trunc('day',now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo'",
        [r.restaurant_id, kind],
      );
      if (Number(budget.rows[0]?.n) >= rule.dailyLimit) continue;
      const offers = rule.offer ? await automationOffers(r.restaurant_id) : [];
      if (rule.offer && !offers.some((o) => o.value === rule.offer)) continue;
      for (const c of await candidates(r.restaurant_id, kind, rule)) {
        if (Date.now() - started > 45000) return { sent, failed };
        const key = await claim(r.restaurant_id, kind, rule, c, rule.offer);
        if (!key) continue;
        const chat = `${c.phone}@c.us`;
        let delivered = false;
        try {
          const text =
            rule.message
              .replaceAll("{{nome}}", c.name || "Cliente")
              .replaceAll("{{restaurante}}", r.name) +
            "\n\nPara não receber mais ofertas, responda SAIR.";
          if (kind === "cart" && c.image_path) {
            const { data } = createSupabaseServerClient()
              .storage.from("menu-images")
              .getPublicUrl(c.image_path);
            await sendWahaImage(r.session_name, chat, data.publicUrl, text);
          } else await sendWahaText(r.session_name, chat, text);
          delivered = true;
          await query(
            "UPDATE whatsapp_outbound_messages SET status='sent',sent_at=now(),updated_at=now() WHERE dedupe_key=$1",
            [key],
          );
          await sendWahaList(
            r.session_name,
            chat,
            [
              {
                title: rule.offer ? "Quero a promoção" : "Ver cardápio",
                rowId: rule.offer ? "crm_offer" : "menu_link",
              },
            ],
            { button: rule.offer ? "Quero a promoção" : "Ver cardápio" },
          );
          sent++;
        } catch (error) {
          failed++;
          await query(
            "UPDATE whatsapp_outbound_messages SET status=$2,last_error=$3,updated_at=now() WHERE dedupe_key=$1",
            [
              key,
              delivered ? "sent" : "failed",
              error instanceof Error
                ? error.message.slice(0, 300)
                : "Falha no envio",
            ],
          );
        }
        // A bounded worker; daily caps are persisted and enforced across concurrent calls.
        if (sent + failed >= 20) return { sent, failed };
      }
    }
  }
  return { sent, failed };
}
