import { NextRequest, NextResponse } from "next/server";
import {
  requireRestaurantOwner,
  RestaurantOwnerAuthError,
} from "@/lib/auth/restaurantOwner";
import { query } from "@/lib/database/sql";
import {
  AUTOMATION_KINDS,
  readAutomationSettings,
} from "@/lib/services/crmRules";
import { automationOffers } from "@/lib/services/crmAutomations";
export const dynamic = "force-dynamic";

const HISTORY_PAGE_SIZE = 10;
type HistoryRow = {
  id: string;
  kind: "cart" | "reactivation" | "habit";
  customer_name: string;
  phone: string | null;
  offer: string | null;
  status: "sent" | "failed";
  occurred_at: string;
  demo: boolean;
};

async function getAutomationHistory(restaurantId: string, email: string | undefined, page: number) {
  // Only an authenticated owner sees these examples. They are not inserted in
  // whatsapp_outbound_messages and cannot send messages or affect cooldowns.
  const demos: HistoryRow[] = email?.toLowerCase() === "joaovralmeida@hotmail.com" ? [
    { id: "example-cart-1", kind: "cart", customer_name: "Mariana Oliveira", phone: null, offer: null, status: "sent", occurred_at: new Date(Date.now() - 3600000).toISOString(), demo: true },
    { id: "example-habit-1", kind: "habit", customer_name: "Bruno Martins", phone: null, offer: "promotion:example", status: "sent", occurred_at: new Date(Date.now() - 18000000).toISOString(), demo: true },
    { id: "example-reactivation-1", kind: "reactivation", customer_name: "Camila Ferreira", phone: null, offer: "coupon:example", status: "sent", occurred_at: new Date(Date.now() - 86400000).toISOString(), demo: true },
    { id: "example-cart-2", kind: "cart", customer_name: "Diego Souza", phone: null, offer: null, status: "failed", occurred_at: new Date(Date.now() - 172800000).toISOString(), demo: true },
    { id: "example-reactivation-2", kind: "reactivation", customer_name: "Elisa Rocha", phone: null, offer: null, status: "sent", occurred_at: new Date(Date.now() - 345600000).toISOString(), demo: true },
    { id: "example-habit-2", kind: "habit", customer_name: "Felipe Lima", phone: null, offer: "coupon:example", status: "sent", occurred_at: new Date(Date.now() - 604800000).toISOString(), demo: true },
  ] : [];
  const offset = page * HISTORY_PAGE_SIZE;
  const examples = demos.slice(offset, offset + HISTORY_PAGE_SIZE);
  const [real, total] = await Promise.all([
    query<HistoryRow>(
      `SELECT h.dedupe_key AS id, h.automation_type AS kind,
         COALESCE(NULLIF(c.name, ''), 'Cliente') AS customer_name,
         h.customer_phone AS phone, h.context->>'offer' AS offer,
         h.status, COALESCE(h.sent_at, h.created_at) AS occurred_at, false AS demo
       FROM whatsapp_outbound_messages h
       LEFT JOIN customers c ON c.restaurant_id = h.restaurant_id AND c.phone = h.customer_phone
       WHERE h.restaurant_id = $1
         AND h.automation_type IN ('cart', 'reactivation', 'habit')
         AND h.status IN ('sent', 'failed')
       ORDER BY h.created_at DESC, h.dedupe_key DESC
       LIMIT $2 OFFSET $3`,
      [restaurantId, HISTORY_PAGE_SIZE - examples.length, Math.max(0, offset - demos.length)],
    ),
    query<{ total: number }>(
      `SELECT COUNT(*)::int AS total FROM whatsapp_outbound_messages
       WHERE restaurant_id = $1 AND automation_type IN ('cart', 'reactivation', 'habit')
         AND status IN ('sent', 'failed')`,
      [restaurantId],
    ),
  ]);
  return NextResponse.json(
    { history: [...examples, ...real.rows], total: demos.length + Number(total.rows[0]?.total || 0) },
    { headers: { "Cache-Control": "no-store" } },
  );
}

async function handle(request: NextRequest, save: boolean) {
  try {
    const id = request.nextUrl.searchParams.get("restaurantId") || "";
    const { user } = await requireRestaurantOwner(request, id);
    if (!save && request.nextUrl.searchParams.get("history") === "1") {
      const requested = Number(request.nextUrl.searchParams.get("page") || 0);
      const page = Number.isFinite(requested) ? Math.min(1000, Math.max(0, Math.floor(requested))) : 0;
      return getAutomationHistory(id, user.email, page);
    }
    if (save) {
      const body = await request.json();
      const settings = readAutomationSettings(body);
      const offers = await automationOffers(id);
      for (const kind of AUTOMATION_KINDS)
        if (
          settings[kind].enabled &&
          settings[kind].offer &&
          !offers.some((x) => x.value === settings[kind].offer)
        )
          return NextResponse.json(
            { error: "Selecione uma oferta ativa e disponível." },
            { status: 400 },
          );
      await query(
        `INSERT INTO whatsapp_bot_settings(restaurant_id,automations) VALUES($1,$2::jsonb) ON CONFLICT(restaurant_id) DO UPDATE SET automations=EXCLUDED.automations,updated_at=now()`,
        [id, JSON.stringify(settings)],
      );
      return NextResponse.json({ settings });
    }
    const [settings, offers, connection] = await Promise.all([
      query(
        "SELECT automations FROM whatsapp_bot_settings WHERE restaurant_id=$1",
        [id],
      ),
      automationOffers(id),
      query(
        "SELECT w.status, r.name FROM restaurants r LEFT JOIN whatsapp_connections w ON w.restaurant_id=r.id WHERE r.id=$1",
        [id],
      ),
    ]);
    return NextResponse.json(
      {
        settings: readAutomationSettings(settings.rows[0]?.automations),
        offers: offers.map(({ value, label }) => ({ value, label })),
        connected: connection.rows[0]?.status === "WORKING",
        restaurantName: connection.rows[0]?.name || "Restaurante",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[CRM_SETTINGS]", error);
    return NextResponse.json(
      {
        error:
          error instanceof RestaurantOwnerAuthError
            ? error.message
            : "Não foi possível salvar as automações.",
      },
      {
        status: error instanceof RestaurantOwnerAuthError ? error.status : 500,
      },
    );
  }
}
export const GET = (r: NextRequest) => handle(r, false);
export const PUT = (r: NextRequest) => handle(r, true);
