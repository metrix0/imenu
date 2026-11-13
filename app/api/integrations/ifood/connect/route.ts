import { NextResponse } from "next/server";
import { requireRestaurantOwner, RestaurantOwnerAuthError } from "@/lib/auth/restaurantOwner";
import { finishIfoodConnection, IfoodConnectionError, startIfoodConnection, updateIfood } from "@/lib/delivery/ifoodConnection";
import { emptyDeliveryConfig } from "@/lib/delivery/providers";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const restaurantId = String(body.restaurantId || "");
        await requireRestaurantOwner(request, restaurantId);
        if (body.action === "start") return NextResponse.json({ pending: await startIfoodConnection(restaurantId) }, { headers: { "Cache-Control": "no-store" } });
        if (body.action !== "finish" && body.action !== "select") throw new IfoodConnectionError("Ação inválida.", 400);
        if (body.action === "select" && (typeof body.merchantId !== "string" || !/^[a-f0-9-]{36}$/i.test(body.merchantId)))
            throw new IfoodConnectionError("Selecione uma loja autorizada.", 400);
        const ifood = await finishIfoodConnection(restaurantId, typeof body.authorizationCode === "string" ? body.authorizationCode.trim() : "",
            body.action === "select" ? body.merchantId : undefined);
        return NextResponse.json({ ifood }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) { return failure(error); }
}
export async function DELETE(request: Request) {
    try {
        const body = await request.json();
        const restaurantId = String(body.restaurantId || "");
        await requireRestaurantOwner(request, restaurantId);
        await updateIfood(restaurantId, async config => { config.ifood = structuredClone(emptyDeliveryConfig.ifood); });
        return NextResponse.json({ ok: true });
    } catch (error) { return failure(error); }
}
function failure(error: unknown) {
    const known = error instanceof RestaurantOwnerAuthError || error instanceof IfoodConnectionError;
    return NextResponse.json({ error: known ? error.message : "Não foi possível conectar ao iFood. Tente novamente." }, { status: known ? error.status : 503 });
}
