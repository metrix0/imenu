import { authorize, failure } from "@/lib/ia-vendas/http";
import { checkCreditPurchase } from "@/lib/ia-vendas/creditPayments";
import { SalesError } from "@/lib/ia-vendas/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const restaurantId = await authorize(request, body.restaurant_id);
    const purchaseId = String(body.purchaseId || "");
    if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(purchaseId))
      throw new SalesError("Compra inválida.", 400);
    const payment = await checkCreditPurchase({ restaurantId, purchaseId });
    return Response.json(payment, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return failure(error);
  }
}
