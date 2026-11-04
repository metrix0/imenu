import { NextResponse } from "next/server";
import { authorize } from "@/lib/dev/authorize";
import { getMessageHistory } from "@/lib/dev/messageHistory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    const denied = await authorize(request);
    if (denied) return denied;
    try {
        const result = await getMessageHistory(new URL(request.url).searchParams);
        return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
        console.error("[DEV_MESSAGES] history_failed", error);
        return NextResponse.json({ error: "Erro ao carregar mensagens." }, { status: 500 });
    }
}
