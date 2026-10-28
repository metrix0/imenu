import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/database/sql";
import { isUuid } from "@/lib/promotions/automatic";
import { normalizeCustomerPhone } from "@/lib/services/crmRules";
import { savedCheckoutProfile, validCheckoutOrigin } from "@/lib/services/checkoutCustomer";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!validCheckoutOrigin(request))
    return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  try {
    const body = await request.json();
    const restaurantId = body.restaurantId;
    const phone = normalizeCustomerPhone(body.phone);
    if (!isUuid(restaurantId) || !phone)
      return NextResponse.json(
        { error: "Informe um celular válido." },
        { status: 400 },
      );

    const result = await query(
      `SELECT
        (SELECT name
         FROM customers
         WHERE phone=$1 AND NULLIF(BTRIM(name), '') IS NOT NULL
         ORDER BY updated_at DESC NULLS LAST
         LIMIT 1) AS name,
        (SELECT address
         FROM customers
         WHERE phone=$1 AND address IS NOT NULL AND address <> '{}'::jsonb
         ORDER BY updated_at DESC NULLS LAST
         LIMIT 1) AS address`,
      [phone],
    );
    const saved = savedCheckoutProfile(request, restaurantId);
    const snapshot = saved?.phone === phone ? saved.snapshot : null;
    const record = result.rows[0];
    const customer = record?.name || record?.address
      ? {
          name: record.name || snapshot?.name || null,
          address: record.address || snapshot?.address || null,
        }
      : snapshot || null;

    return NextResponse.json(
      { customer },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[CHECKOUT_CUSTOMER]", error);
    return NextResponse.json(
      { error: "Não foi possível recuperar seus dados." },
      { status: 500 },
    );
  }
}
