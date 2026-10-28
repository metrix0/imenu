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
      "SELECT name,address FROM customers WHERE restaurant_id=$1 AND phone=$2",
      [restaurantId, phone],
    );
    const saved = savedCheckoutProfile(request, restaurantId);
    const snapshot = saved?.phone === phone ? saved.snapshot : null;
    const record = result.rows[0];
    const customer = record
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
