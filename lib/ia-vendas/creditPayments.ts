import { query, withTransaction } from "@/lib/database/sql";
import {
  createMercadoPagoPixCharge,
  getMercadoPagoPixPayment,
  isMercadoPagoPixFailureStatus,
  type MercadoPagoPixPayment,
} from "@/lib/payments/mercadoPagoPix";
import { quoteCreditPurchase } from "./creditPricing";
import { SalesError } from "./types";

type CreditPurchase = {
  id: string;
  restaurant_id: string;
  client_request_id: string;
  input_tokens: string | number;
  output_tokens: string | number;
  image_count: number;
  price_cents: number;
  provider_payment_id: string | null;
  status: string;
  credited_at: string | null;
  revoked_at: string | null;
};
const externalReference = (id: string) => "ia-credits:" + id + ":v1";
const expectedStatus = (status: string) => String(status || "").toLowerCase();

export async function reconcileCreditPayment(
  payment: MercadoPagoPixPayment,
  purchaseId: string,
): Promise<boolean> {
  return withTransaction(async (client) => {
    const result = await client.query<CreditPurchase>(
      "SELECT * FROM public.ia_vendas_credit_purchases WHERE id=$1 FOR UPDATE",
      [purchaseId],
    );
    const purchase = result.rows[0];
    if (!purchase) return false;
    if (!purchase.provider_payment_id) {
      throw new Error("A cobrança ainda não está vinculada à compra.");
    }
    if (purchase.provider_payment_id !== payment.id ||
        payment.externalReference !== externalReference(purchase.id) ||
        payment.paymentMethodId !== "pix" ||
        Math.round(payment.amount * 100) !== purchase.price_cents) {
      throw new Error("Cobrança de créditos divergente.");
    }
    const status = expectedStatus(payment.status);
    if (status === "approved") {
      if (!purchase.credited_at && !purchase.revoked_at) {
        await client.query(
          `INSERT INTO public.ia_vendas_credit_balances
             (restaurant_id,input_tokens,output_tokens,images)
           VALUES ($1,$2,$3,$4)
           ON CONFLICT (restaurant_id) DO UPDATE SET
             input_tokens=ia_vendas_credit_balances.input_tokens+EXCLUDED.input_tokens,
             output_tokens=ia_vendas_credit_balances.output_tokens+EXCLUDED.output_tokens,
             images=ia_vendas_credit_balances.images+EXCLUDED.images,
             updated_at=NOW()`,
          [purchase.restaurant_id, purchase.input_tokens, purchase.output_tokens, purchase.image_count],
        );
      }
      await client.query(
        "UPDATE public.ia_vendas_credit_purchases SET status='approved',credited_at=COALESCE(credited_at,NOW()),updated_at=NOW() WHERE id=$1 AND revoked_at IS NULL",
        [purchaseId],
      );
      return !purchase.revoked_at;
    }
    if (isMercadoPagoPixFailureStatus(status)) {
      const reversed = ["refunded","charged_back","cancelled","canceled"].includes(status);
      if (reversed && purchase.credited_at && !purchase.revoked_at) {
        // Negative balances represent chargeback debt and prevent double spending.
        await client.query(
          `UPDATE public.ia_vendas_credit_balances
            SET input_tokens=input_tokens-$2, output_tokens=output_tokens-$3,
                images=images-$4, updated_at=NOW()
            WHERE restaurant_id=$1`,
          [purchase.restaurant_id, purchase.input_tokens, purchase.output_tokens, purchase.image_count],
        );
      }
      await client.query(
        `UPDATE public.ia_vendas_credit_purchases
         SET status=$2,
             revoked_at=CASE WHEN $3 AND credited_at IS NOT NULL THEN COALESCE(revoked_at,NOW()) ELSE revoked_at END,
             updated_at=NOW() WHERE id=$1`,
        [purchaseId, reversed ? "refunded" : "failed", reversed],
      );
    }
    return false;
  });
}

export async function createCreditPurchasePayment(input: {
  restaurantId: string;
  requestId: string;
  inputTokens: number;
  images: number;
  priceCents: number;
  payerEmail: string | null;
  payerName: string | null;
  origin: string;
}) {
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(input.requestId)) {
    throw new SalesError("Identificador da compra inválido.", 400);
  }
  if (!Number.isSafeInteger(input.priceCents)) throw new SalesError("Preço inválido.", 400);

  let purchase = (await query<CreditPurchase>(
    "SELECT * FROM public.ia_vendas_credit_purchases WHERE restaurant_id=$1 AND client_request_id=$2 LIMIT 1",
    [input.restaurantId, input.requestId],
  )).rows[0];

  if (!purchase) {
    let pricing;
    try {
      pricing = await quoteCreditPurchase(input.inputTokens, input.images);
    } catch (error) {
      if (error instanceof Error && error.message.includes("Quantidade")) {
        throw new SalesError(error.message, 400);
      }
      throw error;
    }
    if (!pricing.quote.inputTokens && !pricing.quote.images)
      throw new SalesError("Selecione tokens ou imagens.", 400);
    if (pricing.priceCents !== input.priceCents)
      throw new SalesError("O preço foi atualizado. Revise o valor antes de pagar.", 409);
    await query(
      `INSERT INTO public.ia_vendas_credit_purchases
         (restaurant_id,client_request_id,input_tokens,output_tokens,image_count,price_cents,usd_brl_rate)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (restaurant_id,client_request_id) DO NOTHING`,
      [input.restaurantId, input.requestId, pricing.quote.inputTokens, pricing.quote.outputTokens,
       pricing.quote.images, pricing.priceCents, pricing.rate],
    );
    purchase = (await query<CreditPurchase>(
      "SELECT * FROM public.ia_vendas_credit_purchases WHERE restaurant_id=$1 AND client_request_id=$2 LIMIT 1",
      [input.restaurantId, input.requestId],
    )).rows[0];
  }

  if (!purchase ||
      Number(purchase.input_tokens) !== input.inputTokens ||
      Number(purchase.image_count) !== input.images ||
      purchase.price_cents !== input.priceCents) {
    throw new SalesError("Esta compra já foi iniciada com outros valores.", 409);
  }

  if (purchase.status === "approved" && purchase.credited_at) {
    return { active: true, recurring: false, paymentMethod: "pix" as const,
      paymentStatus: "approved", transactionId: purchase.provider_payment_id };
  }
  if (purchase.revoked_at) throw new SalesError("Compra cancelada.", 409);

  let payment = purchase.provider_payment_id
    ? await getMercadoPagoPixPayment({ id: purchase.provider_payment_id })
    : null;
  if (!payment) {
    payment = await createMercadoPagoPixCharge({
      amount: purchase.price_cents / 100,
      notificationUrl: input.origin + "/api/webhooks/mercadopago",
      externalReference: externalReference(purchase.id),
      idempotencyKey: externalReference(purchase.id),
      payerEmail: input.payerEmail,
      payerName: input.payerName,
    });
    await query(
      `UPDATE public.ia_vendas_credit_purchases
       SET provider_payment_id=COALESCE(provider_payment_id,$2), updated_at=NOW()
       WHERE id=$1 AND (provider_payment_id IS NULL OR provider_payment_id=$2)`,
      [purchase.id, payment.id],
    );
  }

  const active = await reconcileCreditPayment(payment, purchase.id);
  return {
    active,
    recurring: false,
    paymentMethod: "pix" as const,
    paymentStatus: payment.status,
    transactionId: purchase.id,
    qrCodeText: payment.qrCodeText,
    qrCodeBase64: payment.qrCodeBase64,
    qrCodeUrl: payment.qrCodeUrl,
  };
}

export async function checkCreditPurchase(input: {
  restaurantId: string;
  purchaseId: string;
}) {
  const purchase = (await query<CreditPurchase>(
    "SELECT * FROM public.ia_vendas_credit_purchases WHERE id=$1 AND restaurant_id=$2 LIMIT 1",
    [input.purchaseId, input.restaurantId],
  )).rows[0];
  if (!purchase) throw new SalesError("Compra não encontrada.", 404);
  if (purchase.credited_at && !purchase.revoked_at)
    return { active: true, paymentStatus: "approved" };
  if (!purchase.provider_payment_id)
    return { active: false, paymentStatus: purchase.status };
  const payment = await getMercadoPagoPixPayment({ id: purchase.provider_payment_id });
  if (!payment) return { active: false, paymentStatus: "pending" };
  const active = await reconcileCreditPayment(payment, purchase.id);
  return { active, paymentStatus: payment.status };
}
