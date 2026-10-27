import { randomInt, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { query, withTransaction } from "@/lib/database/sql";
import { isUuid } from "@/lib/promotions/automatic";
import { normalizeCustomerPhone } from "@/lib/services/crmRules";
import {
  checkoutSignature,
  sameSignature,
  trustedPhone,
  savedCheckoutProfile,
  trustCustomer,
  readCookie,
  otpCookie,
  cookieOptions,
  validCheckoutOrigin,
} from "@/lib/services/checkoutCustomer";
import { sendWahaText } from "@/lib/services/wahaClient";
export const dynamic = "force-dynamic";
export async function POST(request: NextRequest) {
  if (!validCheckoutOrigin(request))
    return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  try {
    const b = await request.json(),
      id = b.restaurantId,
      phone = normalizeCustomerPhone(b.phone);
    if (!isUuid(id) || !phone)
      return NextResponse.json(
        { error: "Informe um celular válido." },
        { status: 400 },
      );
    if (b.action === "send_code") {
      const connection = (
        await query(
          "SELECT session_name FROM whatsapp_connections WHERE restaurant_id=$1 AND status='WORKING' AND desired_state='connected'",
          [id],
        )
      ).rows[0];
      if (!connection)
        return NextResponse.json(
          { error: "Preencha seus dados manualmente neste momento." },
          { status: 409 },
        );
      const key = `crm:otp:${randomUUID()}`,
        code = String(randomInt(100000, 1000000));
      const claimed = await withTransaction(async (client) => {
        await client.query(
          "SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
          [`crm-otp:${id}`],
        );
        return client.query(
          `INSERT INTO whatsapp_outbound_messages(dedupe_key,restaurant_id,chat_id,message_type,status,automation_type,customer_phone,context)
                 SELECT $1,$2,$3,'text','sending','checkout_otp',$4,jsonb_build_object('hash',$5::text,'attempts',0)
                 WHERE (SELECT count(*) FROM whatsapp_outbound_messages WHERE restaurant_id=$2 AND automation_type='checkout_otp' AND created_at>now()-interval '1 hour')<30
                 AND (SELECT count(*) FROM whatsapp_outbound_messages WHERE restaurant_id=$2 AND automation_type='checkout_otp' AND customer_phone=$4 AND created_at>now()-interval '1 hour')<3 RETURNING dedupe_key`,
          [
            key,
            id,
            `${phone}@c.us`,
            phone,
            checkoutSignature(`${key}:${phone}:${code}`),
          ],
        );
      });
      if (!claimed.rowCount)
        return NextResponse.json(
          { error: "Aguarde antes de pedir outro código." },
          { status: 429 },
        );
      try {
        await sendWahaText(
          connection.session_name,
          `${phone}@c.us`,
          `Seu código para preencher os dados no iMenu é ${code}. Válido por 10 minutos. Não compartilhe este código.`,
        );
      } catch {
        await query(
          "UPDATE whatsapp_outbound_messages SET status='failed' WHERE dedupe_key=$1",
          [key],
        );
        return NextResponse.json(
          {
            error:
              "Não foi possível enviar o código. Você pode preencher os dados manualmente.",
          },
          { status: 502 },
        );
      }
      await query(
        "UPDATE whatsapp_outbound_messages SET status='sent',sent_at=now(),updated_at=now() WHERE dedupe_key=$1",
        [key],
      );
      const response = NextResponse.json({ sent: true });
      response.cookies.set(otpCookie(id), key, {
        ...cookieOptions,
        maxAge: 600,
      });
      return response;
    }
    const saved = savedCheckoutProfile(request, id);
    if (
      !b.action &&
      saved?.phone === phone &&
      !saved.verified &&
      saved.snapshot
    )
      return NextResponse.json(
        { customer: saved.snapshot },
        { headers: { "Cache-Control": "no-store" } },
      );
    let verified = trustedPhone(request, id) === phone;
    if (b.action === "verify") {
      const key = readCookie(request, otpCookie(id));
      const row = await query(
        `UPDATE whatsapp_outbound_messages SET context=jsonb_set(context,'{attempts}',to_jsonb(coalesce((context->>'attempts')::int,0)+1)) WHERE dedupe_key=$1 AND restaurant_id=$2 AND customer_phone=$3 AND automation_type='checkout_otp' AND status='sent' AND sent_at>now()-interval '10 minutes' AND coalesce((context->>'attempts')::int,0)<5 AND NOT(context ? 'verified') RETURNING context`,
        [key, id, phone],
      );
      verified = Boolean(
        row.rows[0] &&
          sameSignature(
            row.rows[0].context.hash,
            checkoutSignature(`${key}:${phone}:${String(b.code || "")}`),
          ),
      );
      if (!verified)
        return NextResponse.json(
          { error: "Código inválido ou expirado." },
          { status: 400 },
        );
      await query(
        "UPDATE whatsapp_outbound_messages SET context=context || '{\"verified\":true}'::jsonb WHERE dedupe_key=$1",
        [key],
      );
    }
    if (!verified)
      return NextResponse.json(
        { needsVerification: true },
        { headers: { "Cache-Control": "no-store" } },
      );
    const result = await query(
      "SELECT name,address FROM customers WHERE restaurant_id=$1 AND phone=$2",
      [id, phone],
    );
    const response = NextResponse.json(
      { customer: result.rows[0] || null },
      { headers: { "Cache-Control": "no-store" } },
    );
    return trustCustomer(response, id, phone);
  } catch (error) {
    console.error("[CHECKOUT_CUSTOMER]", error);
    return NextResponse.json(
      { error: "Não foi possível recuperar seus dados." },
      { status: 500 },
    );
  }
}
