import { NextRequest, NextResponse } from "next/server";

import { takeNextPushNotification } from "@/lib/push/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    const deviceToken = request.nextUrl.searchParams.get("deviceToken")?.trim();
    if (!deviceToken || !/^[a-zA-Z0-9_-]{20,200}$/.test(deviceToken)) {
        return NextResponse.json(
            { error: "Invalid device token" },
            { status: 400 }
        );
    }

    try {
        const notification = await takeNextPushNotification(deviceToken);
        return NextResponse.json(
            notification || {
                title: "Novo aviso do iMenu",
                body: "Abra o aplicativo para conferir as novidades.",
                url: "/painel",
                tag: "imenu-generic",
            },
            {
                headers: {
                    "Cache-Control": "no-store",
                },
            }
        );
    } catch (error) {
        console.error("[PUSH_NEXT]", error);
        return NextResponse.json(
            {
                title: "Novo aviso do iMenu",
                body: "Abra o aplicativo para conferir as novidades.",
                url: "/painel",
                tag: "imenu-generic",
            },
            { status: 200 }
        );
    }
}
