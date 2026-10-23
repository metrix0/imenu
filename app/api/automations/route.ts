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
async function handle(request: NextRequest, save: boolean) {
  try {
    const id = request.nextUrl.searchParams.get("restaurantId") || "";
    await requireRestaurantOwner(request, id);
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
