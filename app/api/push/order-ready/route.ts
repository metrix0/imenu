import { NextResponse } from "next/server";

import { notifyOrderReady } from "@/lib/push/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
    try {
        const body = (await request.json()) as { orderId?: unknown };
        const orderId = String(body.orderId || "").trim();

        if (!orderId) {
            return NextResponse.json(
                { error: "orderId is required" },
                { status: 400 }
            );
        }

        await notifyOrderReady(orderId);
        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("[PUSH_ORDER_READY]", error);
        // The customer order page must never fail because notifications failed.
        return NextResponse.json({ ok: false }, { status: 200 });
    }
}
