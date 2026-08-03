import { NextResponse } from "next/server";

import { getVapidPublicKey } from "@/lib/push/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
    try {
        return NextResponse.json({
            configured: true,
            publicKey: getVapidPublicKey(),
        });
    } catch (error) {
        console.error("[PUSH_CONFIG]", error);
        return NextResponse.json(
            {
                configured: false,
                error: "As chaves de notificação ainda não foram configuradas.",
            },
            { status: 503 }
        );
    }
}
