import { authorize, failure } from "@/lib/ia-vendas/http";
import { calculateCreditQuote } from "@/lib/ia-vendas/creditMath";
import { getCreditRates } from "@/lib/ia-vendas/creditPricing";
import { SalesError } from "@/lib/ia-vendas/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function ratesOrUnavailable() {
  const rates = getCreditRates();
  if (!rates) throw new SalesError("Preços indisponíveis para o modelo configurado.", 503);
  return rates;
}

export async function GET(request: Request) {
  try {
    await authorize(request, new URL(request.url).searchParams.get("restaurant_id"));
    return Response.json(
      { rates: ratesOrUnavailable(), purchaseAvailable: false },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return failure(error);
  }
}

// Recalculate on the server: never trust quantities or prices supplied by the browser.
// This endpoint returns a quote only and does not create a charge or grant credits.
export async function POST(request: Request) {
  try {
    const body = await request.json();
    await authorize(request, body.restaurant_id);
    const rates = ratesOrUnavailable();
    let quote;
    try {
      quote = calculateCreditQuote(rates, body.inputTokens, body.images);
    } catch {
      throw new SalesError("Quantidade de créditos inválida.", 400);
    }
    if (!quote.inputTokens && !quote.images) {
      throw new SalesError("Selecione tokens ou imagens.", 400);
    }
    return Response.json({ quote, purchaseAvailable: false }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return failure(error);
  }
}
