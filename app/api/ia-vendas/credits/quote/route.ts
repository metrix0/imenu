import { authorize, failure } from "@/lib/ia-vendas/http";

import { getCreditRates, getUsdBrlRate, getAvailableCreditRechargeRates, quoteCreditPurchase } from "@/lib/ia-vendas/creditPricing";
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
    const restaurantId = await authorize(request, new URL(request.url).searchParams.get("restaurant_id"));
    const rate = await getUsdBrlRate();
    return Response.json(
      { rates: await getAvailableCreditRechargeRates(restaurantId), rate },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return failure(error);
  }
}


export async function POST(request: Request) {
  try {
    const body = await request.json();
    const restaurantId = await authorize(request, body.restaurant_id);
    ratesOrUnavailable();
    let pricing;
    try {
      pricing = await quoteCreditPurchase(body.inputTokens, body.images, restaurantId);
    } catch (error) {
      if (error instanceof Error && error.message.includes("Quantidade")) {
        throw new SalesError(error.message, 400);
      }
      throw error;
    }
    const { quote, rate, priceCents } = pricing;
    if (!quote.inputTokens && !quote.images) {
      throw new SalesError("Selecione tokens ou imagens.", 400);
    }
    return Response.json({ quote, rate, priceCents }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return failure(error);
  }
}
