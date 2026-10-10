import { NextRequest, NextResponse } from "next/server";
import { acknowledgePushNotification, takeNextPushNotification, takePendingPushNotifications } from "@/lib/push/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    const deviceToken = request.nextUrl.searchParams.get("deviceToken")?.trim();
    if (!deviceToken || !/^[a-zA-Z0-9_-]{20,200}$/.test(deviceToken)) {
        return NextResponse.json({ error: "Invalid device token" }, { status: 400 });
    }
    try {
        const notification = request.nextUrl.searchParams.get("batch") === "1"
            ? { notifications: await takePendingPushNotifications(deviceToken) }
            : await takeNextPushNotification(deviceToken);
        return NextResponse.json(notification, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
        console.error("[PUSH_NEXT]", error);
        return NextResponse.json({ error: "Não foi possível carregar as notificações." }, { status: 500, headers: { "Cache-Control": "no-store" } });
    }
}

export async function POST(request: NextRequest) {
    try {
        const { deviceToken, notificationId } = await request.json();
        if (typeof deviceToken !== "string" || !/^[a-zA-Z0-9_-]{20,200}$/.test(deviceToken)
            || typeof notificationId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(notificationId)) {
            return NextResponse.json({ error: "Invalid notification acknowledgement" }, { status: 400 });
        }
        await acknowledgePushNotification(deviceToken, notificationId);
        return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
        console.error("[PUSH_ACK]", error);
        return NextResponse.json({ error: "Notification acknowledgement failed" }, { status: 500 });
    }
}
