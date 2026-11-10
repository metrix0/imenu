import { NextResponse } from "next/server";

import { retryUnacknowledgedOwnerPush } from "@/lib/push/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
    const secret = process.env.CRON_SECRET?.trim();
    if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
        return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    try {
        const result = await retryUnacknowledgedOwnerPush();
        return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
        console.error("[OWNER_PUSH] Retry cron failed:", error);
        return NextResponse.json({ error: "Falha nas tentativas de notificação." }, { status: 500 });
    }
}
