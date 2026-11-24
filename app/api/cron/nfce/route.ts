import { NextResponse } from "next/server";
import { processNote } from "@/lib/nfce/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
    const secret = process.env.CRON_SECRET?.trim();
    if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
        return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }
    let processed = 0;
    const deadline = Date.now() + 30_000;
    while (processed < 10 && Date.now() < deadline && await processNote()) processed++;
    return NextResponse.json({ processed }, { headers: { "Cache-Control": "no-store" } });
}
