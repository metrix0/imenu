import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/database/supabaseServerClient";
import {
    ensureWahaSession,
    extractWahaPhone,
    getWahaQrCode,
    getWahaWebhookHmacKey,
    logoutWahaSession,
    restartWahaSession,
} from "@/lib/services/wahaClient";
import {
    markOwnerTookOverConversation,
    processIncomingWhatsAppMessage,
} from "@/lib/services/whatsappAutomation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type WahaEvent = {
    id?: string;
    event?: string;
    session?: string;
    metadata?: Record<string, unknown> | null;
    me?: {
        id?: string | null;
        pushName?: string | null;
    } | null;
    payload?: Record<string, any> | null;
};

type ConnectionRow = {
    restaurant_id: string;
    session_name: string;
    desired_state: "connected" | "disconnected";
    last_restart_at: string | null;
    last_connected_at: string | null;
};

function verifyWebhook(rawBody: string, request: NextRequest): boolean {
    const received = request.headers.get("x-webhook-hmac")?.trim();
    const algorithm = request.headers
        .get("x-webhook-hmac-algorithm")
        ?.trim()
        .toLowerCase();

    if (!received || algorithm !== "sha512") return false;

    const expected = createHmac("sha512", getWahaWebhookHmacKey())
        .update(rawBody)
        .digest("hex");

    const receivedBuffer = Buffer.from(received, "utf8");
    const expectedBuffer = Buffer.from(expected, "utf8");

    return (
        receivedBuffer.length === expectedBuffer.length &&
        timingSafeEqual(receivedBuffer, expectedBuffer)
    );
}

function getCustomerChatId(payload: Record<string, any>): string | null {
    const candidate = payload.fromMe
        ? payload.to || payload.from
        : payload.from || payload.chatId;
    const value = String(candidate || "");

    if (
        !value ||
        value === "status@broadcast" ||
        value.endsWith("@g.us") ||
        value.endsWith("@newsletter") ||
        value.endsWith("@broadcast")
    ) {
        return null;
    }

    return value.replace("@s.whatsapp.net", "@c.us");
}

async function claimEvent(
    eventId: string,
    supabase: ReturnType<typeof createSupabaseServerClient>
): Promise<boolean> {
    const { data, error } = await supabase
        .from("whatsapp_webhook_events")
        .insert({ event_id: eventId })
        .select("event_id")
        .maybeSingle();

    if (error) {
        if (error.code === "23505") return false;
        throw error;
    }

    // Keep the idempotency table small without requiring a cron job.
    if (Math.random() < 0.02) {
        void supabase
            .from("whatsapp_webhook_events")
            .delete()
            .lt(
                "received_at",
                new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
            );
    }

    return Boolean(data);
}

async function getConnection(
    sessionName: string,
    supabase: ReturnType<typeof createSupabaseServerClient>
): Promise<ConnectionRow | null> {
    const { data, error } = await supabase
        .from("whatsapp_connections")
        .select(
            "restaurant_id, session_name, desired_state, last_restart_at, last_connected_at"
        )
        .eq("session_name", sessionName)
        .maybeSingle();

    if (error) throw error;
    return (data as ConnectionRow | null) || null;
}

async function updateSessionStatus({
    event,
    connection,
    supabase,
}: {
    event: WahaEvent;
    connection: ConnectionRow;
    supabase: ReturnType<typeof createSupabaseServerClient>;
}) {
    const payload = event.payload || {};
    const status = String(payload.status || "FAILED");
    const now = new Date().toISOString();
    const update: Record<string, unknown> = {
        status,
        status_data: payload.data || null,
        last_event_at: now,
        updated_at: now,
    };

    if (event.me?.id) {
        update.phone = extractWahaPhone(event.me.id);
    }
    if (event.me?.pushName) {
        update.push_name = event.me.pushName;
    }

    if (status === "SCAN_QR_CODE") {
        const qrCode = await getWahaQrCode(connection.session_name);
        update.qr_code_data = qrCode;
        update.qr_updated_at = qrCode ? now : null;
        update.last_error = null;
    } else if (status === "WORKING") {
        update.qr_code_data = null;
        update.qr_updated_at = null;
        update.last_connected_at = now;
        update.last_error = null;
    } else if (status === "FAILED" || status === "STOPPED") {
        update.qr_code_data = null;
        update.qr_updated_at = null;
        update.last_disconnected_at = now;
        update.last_error =
            status === "FAILED"
                ? "A sessão não conseguiu se reconectar."
                : null;
    } else if (status === "PASSKEY_REQUIRED") {
        update.qr_code_data = null;
        update.qr_updated_at = null;
    }

    const { error } = await supabase
        .from("whatsapp_connections")
        .update(update)
        .eq("restaurant_id", connection.restaurant_id);

    if (error) throw error;

    if (
        (status === "FAILED" || status === "STOPPED") &&
        connection.desired_state === "connected"
    ) {
        const lastRestart = connection.last_restart_at
            ? new Date(connection.last_restart_at).getTime()
            : 0;
        const canRestart = Date.now() - lastRestart > 60_000;

        if (canRestart) {
            await supabase
                .from("whatsapp_connections")
                .update({
                    status: "STARTING",
                    last_restart_at: now,
                    updated_at: now,
                })
                .eq("restaurant_id", connection.restaurant_id);

            try {
                const restarted = await restartWahaSession(
                    connection.session_name
                );

                if (restarted.status === "FAILED") {
                    throw new Error("WAHA remained in FAILED after restart");
                }
            } catch (restartError) {
                console.warn(
                    "[WAHA_WEBHOOK] Restart failed, recreating session:",
                    restartError
                );

                try {
                    await logoutWahaSession(connection.session_name);
                } catch {
                    // The failed session may already have been removed.
                }

                await ensureWahaSession(
                    connection.restaurant_id,
                    connection.session_name
                );
            }
        }
    }
}

export async function POST(request: NextRequest) {
    const rawBody = await request.text();
    let claimedEventId: string | null = null;
    let claimedSupabase: ReturnType<
        typeof createSupabaseServerClient
    > | null = null;

    try {
        if (!verifyWebhook(rawBody, request)) {
            return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
        }

        const event = JSON.parse(rawBody) as WahaEvent;
        const sessionName = String(event.session || "");
        const eventName = String(event.event || "");
        const payload = event.payload || {};

        if (!sessionName || !eventName) {
            return NextResponse.json({ ok: true });
        }

        const supabase = createSupabaseServerClient();
        const eventId =
            event.id ||
            request.headers.get("x-webhook-request-id") ||
            `${eventName}:${sessionName}:${String(
                payload.id || payload.timestamp || rawBody.length
            )}`;

        if (!(await claimEvent(eventId, supabase))) {
            return NextResponse.json({ ok: true, duplicate: true });
        }

        claimedEventId = eventId;
        claimedSupabase = supabase;

        const connection = await getConnection(sessionName, supabase);
        if (!connection) {
            return NextResponse.json({ ok: true, ignored: "unknown_session" });
        }

        if (eventName === "session.status") {
            await updateSessionStatus({ event, connection, supabase });
            return NextResponse.json({ ok: true });
        }

        const chatId = getCustomerChatId(payload);
        if (!chatId) {
            return NextResponse.json({ ok: true, ignored: "unsupported_chat" });
        }

        if (eventName === "message.any") {
            if (payload.fromMe === true && payload.source !== "api") {
                await markOwnerTookOverConversation({
                    restaurantId: connection.restaurant_id,
                    chatId,
                });
            }

            return NextResponse.json({ ok: true });
        }

        if (eventName === "message" && payload.fromMe !== true) {
            await processIncomingWhatsAppMessage({
                restaurantId: connection.restaurant_id,
                sessionName,
                chatId,
                body: String(payload.body || ""),
                hasMedia: payload.hasMedia === true,
            });
        }

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("[WAHA_WEBHOOK]", error);

        // Release the idempotency claim so WAHA's retry can process the event.
        if (claimedEventId && claimedSupabase) {
            try {
                await claimedSupabase
                    .from("whatsapp_webhook_events")
                    .delete()
                    .eq("event_id", claimedEventId);
            } catch (releaseError) {
                console.error(
                    "[WAHA_WEBHOOK] Failed to release event claim:",
                    releaseError
                );
            }
        }

        // Return 500 so WAHA's configured retry policy retries transient errors.
        return NextResponse.json(
            {
                error:
                    error instanceof Error ? error.message : "Webhook failed",
            },
            { status: 500 }
        );
    }
}
