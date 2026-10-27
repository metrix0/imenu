import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/database/sql";
import { isUuid } from "@/lib/promotions/automatic";
import { normalizeCustomerPhone } from "@/lib/services/crmRules";
import {
  readCookie,
  checkoutCookie,
  cookieOptions,
  validCheckoutOrigin,
} from "@/lib/services/checkoutCustomer";
export const dynamic = "force-dynamic";
export async function POST(request: NextRequest) {
  if (!validCheckoutOrigin(request))
    return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  try {
    if (Number(request.headers.get("content-length")) > 30000)
      return NextResponse.json(
        { error: "Carrinho muito grande." },
        { status: 413 },
      );
    const body = await request.json(),
      id = body.restaurantId;
    if (!isUuid(id) || !Array.isArray(body.items) || body.items.length > 100)
      return NextResponse.json(
        { error: "Carrinho inválido." },
        { status: 400 },
      );
    if (!(await query("SELECT 1 FROM restaurants WHERE id=$1", [id])).rowCount)
      return NextResponse.json(
        { error: "Restaurante indisponível." },
        { status: 404 },
      );
    const raw = readCookie(request, checkoutCookie(id));
    const existing = isUuid(raw)
      ? (
          await query(
            "SELECT id,completed_at FROM checkout_sessions WHERE id=$1 AND restaurant_id=$2",
            [raw, id],
          )
        ).rows[0]
      : null;
    const observedAt = Math.min(
      Date.now(),
      Math.max(Date.now() - 600000, Number(body.observedAt) || Date.now()),
    );
    if (
      (!body.items.length && !existing) ||
      (existing?.completed_at &&
        (!body.items.length ||
          new Date(existing.completed_at).getTime() >= observedAt))
    )
      return NextResponse.json({ ok: true });
    const session = existing && !existing.completed_at ? raw : randomUUID();
    const ids = body.items.map((x: any) => x.base_item_id).filter(isUuid);
    const valid = (
      await query(
        "SELECT id FROM items WHERE restaurant_id=$1 AND id=ANY($2::uuid[])",
        [id, ids],
      )
    ).rows;
    const allowed = new Set(valid.map((x) => x.id));
    const items = body.items
      .filter((x: any) => allowed.has(x.base_item_id))
      .map((x: any) => ({
        item_id: x.base_item_id,
        quantity: Math.max(1, Math.min(99, Math.floor(Number(x.qty) || 1))),
        unit_price_cents: Math.max(
          0,
          Math.min(10000000, Math.round(Number(x.unit_price_cents) || 0)),
        ),
      }));
    const phone = normalizeCustomerPhone(body.phone),
      consent = body.marketingConsent === true;
    if (
      phone &&
      (
        await query(
          "SELECT 1 FROM orders WHERE restaurant_id=$1 AND public.crm_phone(customer_phone)=$2 AND created_at>=to_timestamp($3/1000.0) AND status<>'canceled' LIMIT 1",
          [id, phone, observedAt],
        )
      ).rowCount
    )
      return NextResponse.json({ ok: true });
    await query(
      `INSERT INTO checkout_sessions(id,restaurant_id,phone,items,marketing_consent) VALUES($1,$2,$3,$4::jsonb,$5)
          ON CONFLICT(id) DO UPDATE SET phone=EXCLUDED.phone,items=EXCLUDED.items,marketing_consent=EXCLUDED.marketing_consent,updated_at=now(),expires_at=now()+interval '7 days'
          WHERE checkout_sessions.restaurant_id=EXCLUDED.restaurant_id AND checkout_sessions.completed_at IS NULL`,
      [session, id, phone, JSON.stringify(items), consent],
    );
    if (phone && consent)
      await query(
        "UPDATE customers SET marketing_consent=true,updated_at=now() WHERE restaurant_id=$1 AND phone=$2 AND opted_out_at IS NULL",
        [id, phone],
      );
    const response = NextResponse.json({ ok: true });
    response.cookies.set(checkoutCookie(id), session, {
      ...cookieOptions,
      maxAge: 7 * 86400,
    });
    return response;
  } catch (error) {
    console.error("[CHECKOUT_SESSION]", error);
    return NextResponse.json(
      { error: "Não foi possível salvar o carrinho." },
      { status: 500 },
    );
  }
}
