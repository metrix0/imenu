import { NextResponse } from "next/server";
import { processSupportBlastQueue } from "@/lib/services/supportBlast";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
    const secret = process.env.CRON_SECRET?.trim();
    if (!secret || request.headers.get("authorization") !== "Bearer " + secret) {
        return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }
    try {
        return NextResponse.json(await processSupportBlastQueue(), {
            headers: { "Cache-Control": "no-store" },
        });
    } catch (error) {
        console.error("[SUPPORT_BLAST] Worker failed:", error);
        return NextResponse.json({ error: "Erro no processamento do envio." }, { status: 500 });
    }
}
