import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/database/supabaseServerClient";
import {
    extractWahaPhone,
    getWahaQrCode,
    getWahaWebhookHmacKey,
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
    timestamp?: number | string;
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
    status: string;
    last_restart_at: string | null;
    last_connected_at: string | null;
    last_event_at: string | null;
};

function parseConnectionRow(value: unknown): ConnectionRow {
    if (!value || typeof value !== "object") {
        throw new Error("Invalid WhatsApp connection response");
    }

    return value as ConnectionRow;
}

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

function normalizeDirectChatId(candidate: unknown): string | null {
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

function getCustomerChatId(payload: Record<string, any>): string | null {
    const candidate = payload.fromMe
        ? payload.to || payload.from
        : payload.from ||
          payload.chatId ||
          payload._data?.Info?.Chat ||
          payload._data?.key?.remoteJid;

    return normalizeDirectChatId(candidate);
}

function firstNonEmptyString(values: unknown[]): string {
    for (const value of values) {
        if (typeof value === "string" && value.trim()) return value.trim();
    }
    return "";
}

function extractIncomingBody(payload: Record<string, any>): string {
    return firstNonEmptyString([
        payload.body,
        payload.selectedRowId,
        payload.selectedRowID,
        payload.listResponse?.singleSelectReply?.selectedRowId,
        payload.listResponse?.singleSelectReply?.selectedRowID,
        payload.listResponseMessage?.singleSelectReply?.selectedRowId,
        payload.listResponseMessage?.singleSelectReply?.selectedRowID,
        payload._data?.selectedRowId,
        payload._data?.selectedRowID,
        payload._data?.listResponse?.singleSelectReply?.selectedRowId,
        payload._data?.listResponse?.singleSelectReply?.selectedRowID,
        payload._data?.listResponseMessage?.singleSelectReply?.selectedRowId,
        payload._data?.listResponseMessage?.singleSelectReply?.selectedRowID,
        payload._data?.message?.listResponseMessage?.singleSelectReply
            ?.selectedRowId,
        payload._data?.message?.listResponseMessage?.singleSelectReply
            ?.selectedRowID,
        payload._data?.Message?.ListResponseMessage?.SingleSelectReply
            ?.SelectedRowID,
        payload._data?.Message?.ListResponseMessage?.SingleSelectReply
            ?.SelectedRowId,
    ]);
}

function isGeneratedOrderMessage(body: string): boolean {
    const lines = body
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

    return (
        /^🧾\s*\*?PEDIDO\s+#.+\*?$/i.test(lines[0] || "") &&
        lines.some((line) => /^🕐\s*Hora:/i.test(line)) &&
        lines.some((line) => /^📦\s*Tipo:/i.test(line))
    );
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

    if (Math.random() < 0.02) {
        const { error: cleanupError } = await supabase
            .from("whatsapp_webhook_events")
            .delete()
            .lt(
                "received_at",
                new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
            );

        if (cleanupError) {
            console.warn(
                "[WAHA_WEBHOOK] Failed to clean old event claims:",
                cleanupError
            );
        }
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
            "restaurant_id,session_name,desired_state,status,last_restart_at,last_connected_at,last_event_at"
        )
        .eq("session_name", sessionName)
        .maybeSingle();

    if (error) throw error;
    return data ? parseConnectionRow(data) : null;
}

function getSourceEventTime(event: WahaEvent): number | null {
    const raw = event.timestamp ?? event.payload?.timestamp;
    const numeric = Number(raw);
    if (!Number.isFinite(numeric)) return null;

    return numeric < 10_000_000_000 ? numeric * 1000 : numeric;
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
    const sourceEventTime = getSourceEventTime(event);

    // WAHA retries can deliver an older QR/status event after a newer WORKING
    // event. Do not let that regress the UI back to QR mode.
    if (sourceEventTime && connection.last_event_at) {
        const lastEventTime = new Date(connection.last_event_at).getTime();
        if (Number.isFinite(lastEventTime) && sourceEventTime + 5_000 < lastEventTime) {
            return;
        }
    }

    const now = new Date().toISOString();
    const update: Record<string, unknown> = {
        status,
        status_data: payload.data || null,
        last_event_at: now,
        updated_at: now,
    };

    if (event.me?.id) update.phone = extractWahaPhone(event.me.id);
    if (event.me?.pushName) update.push_name = event.me.pushName;

    if (status === "SCAN_QR_CODE") {
        const qrCode = await getWahaQrCode(connection.session_name);
        update.qr_code_data = qrCode;
        update.qr_updated_at = qrCode ? now : null;
        update.last_error = null;
    } else {
        update.qr_code_data = null;
        update.qr_updated_at = null;

        if (status === "WORKING") {
            update.last_connected_at = now;
            update.last_error = null;
        } else if (status === "FAILED" || status === "STOPPED") {
            update.last_disconnected_at = now;
            update.last_error =
                status === "FAILED"
                    ? "A sessão não conseguiu se reconectar."
                    : null;
        }
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

        if (Date.now() - lastRestart > 60_000) {
            await supabase
                .from("whatsapp_connections")
                .update({
                    status: "STARTING",
                    last_restart_at: now,
                    updated_at: now,
                })
                .eq("restaurant_id", connection.restaurant_id);

            try {
                await restartWahaSession(connection.session_name);
            } catch (restartError) {
                // Never logout automatically here. Logout deletes saved WhatsApp
                // authorization and was causing healthy linked devices to return
                // to QR mode after a transient restart failure.
                console.warn("[WAHA_WEBHOOK] Session restart failed:", restartError);

                await supabase
                    .from("whatsapp_connections")
                    .update({
                        status,
                        last_error:
                            "A reconexão automática falhou. Tente novamente sem gerar um novo QR.",
                        updated_at: new Date().toISOString(),
                    })
                    .eq("restaurant_id", connection.restaurant_id);
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
        // Message events can trigger replies or transfer a conversation, so they
        // must remain idempotent. Session status updates are already idempotent
        // and arrive very frequently while QR codes rotate or sessions retry;
        // storing a permanent claim for each one only creates database churn.
        if (eventName === "message" || eventName === "message.any") {
            const baseEventId =
                event.id ||
                request.headers.get("x-webhook-request-id") ||
                payload.id ||
                payload.timestamp ||
                rawBody.length;
            const eventId = `${eventName}:${sessionName}:${String(baseEventId)}`;

            if (!(await claimEvent(eventId, supabase))) {
                return NextResponse.json({ ok: true, duplicate: true });
            }

            claimedEventId = eventId;
            claimedSupabase = supabase;
        }

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
            const incomingBody = extractIncomingBody(payload);
            if (isGeneratedOrderMessage(incomingBody)) {
                return NextResponse.json({ ok: true, ignored: "order_message" });
            }

            await processIncomingWhatsAppMessage({
                restaurantId: connection.restaurant_id,
                sessionName,
                chatId,
                body: incomingBody,
                hasMedia: payload.hasMedia === true,
            });
        }

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("[WAHA_WEBHOOK]", error);

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

        return NextResponse.json(
            {
                error:
                    error instanceof Error ? error.message : "Webhook failed",
            },
            { status: 500 }
        );
    }
}
