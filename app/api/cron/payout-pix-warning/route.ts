import { NextResponse } from "next/server";
import { warnAboutUpcomingPayoutPix } from "@/lib/services/payouts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 900;

export async function GET(request: Request) {
    const secret = process.env.CRON_SECRET?.trim();
    if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
        return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }
    if (process.env.PAYOUT_CRON_ENABLED !== "true") {
        return NextResponse.json({ skipped: true });
    }

    try {
        const result = await warnAboutUpcomingPayoutPix();
        return NextResponse.json(result, {
            status: result.uncheckedKeys ? 503 : 200,
            headers: { "Cache-Control": "no-store" },
        });
    } catch {
        console.error("[PAYOUT_PIX_WARNING] Não foi possível verificar os próximos repasses.");
        return NextResponse.json({ error: "Falha ao verificar o Pix dos próximos repasses." }, { status: 500 });
    }
}
