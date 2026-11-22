import { NextResponse } from "next/server";

import { remindUnopenedOrderPush, retryUnacknowledgedOwnerPush } from "@/lib/push/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
    const secret = process.env.CRON_SECRET?.trim();
    if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
        return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    try {
        const retries = await retryUnacknowledgedOwnerPush();
        const reminders = await remindUnopenedOrderPush();
        return NextResponse.json({ ...retries, reminders }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
        console.error("[OWNER_PUSH] Retry cron failed:", error);
        return NextResponse.json({ error: "Falha nas tentativas de notificação." }, { status: 500 });
    }
}
