import { LIMITS, MODELS } from "./config";
import type { CreditRates } from "./creditMath";
import type { PoolClient } from "pg";
import { query } from "@/lib/database/sql";
import { aiAccess } from "./access";

// Rates from https://developers.openai.com/api/docs/pricing (USD, standard API).
// Keep model prices in one place; an unknown configured model must not show an incorrect price.
const CHAT_RATES: Record<string, { input: number; output: number }> = {
  "gpt-5.6-luna": { input: 0.20, output: 1.20 },
  "gpt-5.6-terra": { input: 2.00, output: 12.00 },
  "gpt-5.6-sol": { input: 4.00, output: 20.00 },
};

// Estimate per 1024px low-quality output. Actual costs vary with dimensions,
// input images and prompt tokens (image edits may cost more).
// https://developers.openai.com/api/docs/guides/image-generation
const IMAGE_RATES: Record<string, number> = {
  "gpt-image-2": 0.006,
  "gpt-image-2-2026-04-21": 0.006,
  "gpt-image-2.5-sunburst": 0.00588,
  "gpt-image-2.5-flare": 0.00588,
};

export function getCreditRates(): CreditRates | null {
  const chat = CHAT_RATES[MODELS.chat];
  const image = IMAGE_RATES[MODELS.image];
  if (!chat || image == null) return null;
  return {
    chatModel: MODELS.chat,
    imageModel: MODELS.image,
    inputUsdPerMillion: chat.input,
    outputUsdPerMillion: chat.output,
    imageUsdEstimate: image,
    outputRatio: LIMITS.monthlyChatOutput / LIMITS.monthlyChatInput,
    maxInputTokens: LIMITS.monthlyChatInput,
    maxImages: LIMITS.images,
    inputStep: 100_000,
  };
}

/** Cached official-reference exchange rate; failures fail closed (no stale billing). */
export async function getUsdBrlRate(): Promise<number> {
  const response = await fetch("https://api.frankfurter.dev/v2/rate/USD/BRL", {
    next: { revalidate: 3600 },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error("Não foi possível consultar a cotação.");
  const payload = await response.json() as { base?: string; quote?: string; rate?: number; date?: string };
  const date = payload.date && Date.parse(payload.date + "T00:00:00Z");
  if (payload.base !== "USD" || payload.quote !== "BRL" ||
      !Number.isFinite(payload.rate) || Number(payload.rate) <= 0 ||
      !date || Date.now() - date > 6 * 24 * 3600_000 || date > Date.now() + 86_400_000) {
    throw new Error("Cotação indisponível.");
  }
  return Number(payload.rate);
}

/**
 * Limits each new purchase to the capacity not already available to the restaurant.
 * Both included and purchased credits count; pending Pix charges also reserve capacity.
 * Output tokens never exceed their own headroom, even if input tokens are selected.
 */
export async function getAvailableCreditRechargeRates(
  restaurantId: string,
  client?: Pick<PoolClient, "query">,
): Promise<CreditRates> {
  const rates = getCreditRates();
  if (!rates) throw new Error("Preços indisponíveis para o modelo atual.");

  const access = await aiAccess(restaurantId, client);
  const includedInput = access.plus
    ? Math.max(0, LIMITS.monthlyChatInput - Number(access.usage?.tokens.input ?? 0))
    : Math.max(0, Number(access.base_tokens_remaining ?? 0));
  const includedOutput = access.plus
    ? Math.max(0, LIMITS.monthlyChatOutput - Number(access.usage?.tokens.output ?? 0))
    : Math.max(0, Number(access.base_tokens_remaining ?? 0));
  const includedImages = Math.max(0, Number(access.base_images_remaining ?? 0));
  const execute = (sql: string, params: unknown[]) =>
    client ? client.query(sql, params) : query(sql, params);
  const pending = (await execute(
    `SELECT coalesce(sum(input_tokens),0)::float input,
            coalesce(sum(output_tokens),0)::float output,
            coalesce(sum(image_count),0)::float images
     FROM public.ia_vendas_credit_purchases
     WHERE restaurant_id=$1 AND status='pending'`,
    [restaurantId],
  )).rows[0];

  const purchased = access.purchased_credits;
  const availableInput = includedInput + Math.max(0, purchased.input) + Number(pending?.input || 0);
  const availableOutput = includedOutput + Math.max(0, purchased.output) + Number(pending?.output || 0);
  const availableImages = includedImages + Math.max(0, purchased.images) + Number(pending?.images || 0);
  return {
    ...rates,
    maxInputTokens: Math.max(
      0, Math.floor((LIMITS.monthlyChatInput - availableInput) / rates.inputStep) * rates.inputStep,
    ),
    maxOutputTokens: Math.max(0, Math.floor(LIMITS.monthlyChatOutput - availableOutput)),
    maxImages: Math.max(0, Math.floor(LIMITS.images - availableImages)),
  };
}

export async function quoteCreditPurchase(
  inputTokens: number, images: number, restaurantId: string,
  client?: Pick<PoolClient, "query">,
) {
  const rates = await getAvailableCreditRechargeRates(restaurantId, client);
  const { calculateCreditQuote, convertCreditCostToBrlCents } = await import("./creditMath");
  const quote = calculateCreditQuote(rates, inputTokens, images);
  const rate = await getUsdBrlRate();
  return { rates, quote, rate, priceCents: convertCreditCostToBrlCents(quote.totalUsd, rate) };
}
