import { NextRequest, NextResponse } from "next/server";
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

    // Never disclose historical profiles based solely on a supplied phone.
    // Signed snapshots remain available only on the original device/store.
    const saved = savedCheckoutProfile(request, restaurantId);
    const customer = saved?.phone === phone ? saved.snapshot || null : null;

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
