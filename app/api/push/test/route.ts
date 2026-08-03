import { NextRequest, NextResponse } from "next/server";

import { requireOwnedRestaurant } from "@/lib/push/auth";
import { sendTestPush } from "@/lib/push/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
    try {
        const body = (await request.json()) as {
            restaurantId?: unknown;
            deviceToken?: unknown;
        };
        const restaurantId = String(body.restaurantId || "").trim();
        const deviceToken = String(body.deviceToken || "").trim();

        if (!restaurantId || !deviceToken) {
            return NextResponse.json(
                { error: "restaurantId and deviceToken are required" },
                { status: 400 }
            );
        }

        const { userId } = await requireOwnedRestaurant(request, restaurantId);
        const sent = await sendTestPush({
            restaurantId,
            userId,
            deviceToken,
        });

        if (!sent) {
            return NextResponse.json(
                { error: "Este aparelho ainda não está inscrito." },
                { status: 404 }
            );
        }

        return NextResponse.json({ ok: true });
    } catch (error) {
        if (error instanceof Response) {
            return NextResponse.json(
                { error: error.statusText || "Request failed" },
                { status: error.status }
            );
        }

        console.error("[PUSH_TEST]", error);
        return NextResponse.json(
            { error: "Não foi possível enviar a notificação de teste." },
            { status: 500 }
        );
    }
}
