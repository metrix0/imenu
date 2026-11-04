import { authorize, failure } from "@/lib/ia-vendas/http";
import { createCreditPurchasePayment } from "@/lib/ia-vendas/creditPayments";
import { SalesError } from "@/lib/ia-vendas/types";
import { requireRestaurantOwner } from "@/lib/auth/restaurantOwner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const restaurantId = await authorize(request, body.restaurant_id);
    if (body.paymentMethod !== "pix") {
      throw new SalesError("Forma de pagamento inválida.", 400);
    }
    const owner = await requireRestaurantOwner(request, restaurantId);
    const payment = await createCreditPurchasePayment({
      restaurantId,
      requestId: String(body.requestId || ""),
      inputTokens: body.inputTokens,
      images: body.images,
      priceCents: body.priceCents,
      payerEmail: owner.user.email ?? null,
      payerName: owner.restaurant.name,
      origin: process.env.NEXT_PUBLIC_BASE_URL || new URL(request.url).origin,
    });
    return Response.json(payment, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return failure(error);
  }
}
