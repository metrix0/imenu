import { NextResponse } from "next/server";
import { processSupportBlastQueue } from "@/lib/services/supportBlast";
import { processSupportFollowups } from "@/lib/services/supportFollowups";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
    const secret = process.env.CRON_SECRET?.trim();
    if (!secret || request.headers.get("authorization") !== "Bearer " + secret) {
        return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }
    try {
        const [blasts, followup] = await Promise.allSettled([
            processSupportBlastQueue(),
            processSupportFollowups(),
        ]);
        if (followup.status === "rejected") {
            console.error("[SUPPORT_FOLLOWUP] Worker failed:", followup.reason);
        }
        if (blasts.status === "rejected") throw blasts.reason;
        return NextResponse.json({
            ...blasts.value,
            followups: followup.status === "fulfilled" ? followup.value : 0,
        }, {
            headers: { "Cache-Control": "no-store" },
        });
    } catch (error) {
        console.error("[SUPPORT_BLAST] Worker failed:", error);
        return NextResponse.json({ error: "Erro no processamento do envio." }, { status: 500 });
    }
}
