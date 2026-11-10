import { NextRequest, NextResponse } from "next/server";

import { acknowledgeOwnerPush } from "@/lib/push/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The device token is a high-entropy capability already used by /api/push/next.
// Acknowledge only the notification belonging to that exact subscription.
export async function POST(request: NextRequest) {
    const origin = request.headers.get("origin");
    if (origin && origin !== request.nextUrl.origin) {
        return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
    }

    try {
        const { deviceToken, notificationId } = (await request.json()) as {
            deviceToken?: unknown;
            notificationId?: unknown;
        };
        if (
            typeof deviceToken !== "string" ||
            !/^[a-zA-Z0-9_-]{20,200}$/.test(deviceToken) ||
            typeof notificationId !== "string" ||
            !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(notificationId)
        ) {
            return NextResponse.json({ error: "Identificação inválida." }, { status: 400 });
        }

        const acknowledged = await acknowledgeOwnerPush(deviceToken, notificationId);
        return NextResponse.json(
            { ok: acknowledged },
            { status: acknowledged ? 200 : 404, headers: { "Cache-Control": "no-store" } }
        );
    } catch (error) {
        console.error("[PUSH_ACK]", error);
        return NextResponse.json({ error: "Não foi possível confirmar a notificação." }, { status: 500 });
    }
}
