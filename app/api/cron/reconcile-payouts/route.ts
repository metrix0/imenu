import { NextResponse } from "next/server";

import { reconcileProcessingPayouts } from "@/lib/services/payouts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(request: Request): boolean {
    const cronSecret = process.env.CRON_SECRET?.trim();
    return Boolean(
        cronSecret &&
            request.headers.get("authorization") === "Bearer " + cronSecret
    );
}

export async function GET(request: Request) {
    if (!isAuthorized(request)) {
        return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    try {
        await reconcileProcessingPayouts();
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[PAYOUT_RECONCILIATION] Falha", error);
        return NextResponse.json(
            {
                success: false,
                error:
                    error instanceof Error ? error.message : "Erro interno.",
            },
            { status: 500 }
        );
    }
}
