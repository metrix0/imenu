import { NextResponse } from "next/server";
import { recoverRecentOrderPushes } from "@/lib/push/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(request: Request) {
    const secret = process.env.CRON_SECRET?.trim();
    if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    try {
        return NextResponse.json(await recoverRecentOrderPushes());
    } catch (error) {
        console.error("[OWNER_PUSH_RECOVERY]", error);
        return NextResponse.json({ error: "Push recovery failed" }, { status: 500 });
    }
}
