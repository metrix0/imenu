import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/database/supabaseServerClient";
import { query } from "@/lib/database/sql";
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

function extractSelectedRowId(payload: Record<string, any>): string {
    return firstNonEmptyString([
        payload.selectedRowId,
        payload.selectedRowID,
        payload.listResponse?.singleSelectReply?.selectedRowId,
        payload.listResponse?.singleSelectReply?.selectedRowID,
        payload._data?.selectedRowId,
        payload._data?.selectedRowID,
        payload._data?.Info?.SelectedRowID,
    ]);
}

function extractCustomerName(payload: Record<string, any>): string | null {
    const name = firstNonEmptyString([
        payload.notifyName,
        payload.pushName,
        payload.senderName,
        payload._data?.notifyName,
        payload._data?.pushName,
        payload._data?.Info?.PushName,
        payload._data?.info?.pushName,
    ]);

    return name || null;
}

function getStableMessageId(event: WahaEvent, rawBody: string): string {
    const payload = event.payload || {};
    const candidate = firstNonEmptyString([
        payload.id,
        payload._data?.id,
        payload._data?.key?.id,
        payload._data?.Info?.ID,
        payload._data?.info?.id,
        event.id,
    ]);

    return candidate || createHash("sha256").update(rawBody).digest("hex");
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

async function claimEvent(eventId: string): Promise<boolean> {
    const result = await query(
        `
            INSERT INTO whatsapp_webhook_events (
                event_id,
                status,
                attempt_count,
                updated_at
            )
            VALUES ($1, 'processing', 1, NOW())
            ON CONFLICT (event_id)
            DO UPDATE SET
                status = 'processing',
                attempt_count = whatsapp_webhook_events.attempt_count + 1,
                last_error = NULL,
                updated_at = NOW()
            WHERE whatsapp_webhook_events.status = 'failed'
            RETURNING event_id
        `,
        [eventId]
    );

    if (Math.random() < 0.02) {
        void query(
            `DELETE FROM whatsapp_webhook_events
             WHERE received_at < NOW() - INTERVAL '7 days'`
        ).catch((error) =>
            console.warn("[WAHA_WEBHOOK] Failed to clean old event claims:", error)
        );
    }

    return result.rowCount > 0;
}

async function finishEvent(
    eventId: string,
    status: "processed" | "failed",
    error?: unknown
): Promise<void> {
    await query(
        `
            UPDATE whatsapp_webhook_events
            SET status = $2,
                processed_at = CASE WHEN $2 = 'processed' THEN NOW() ELSE processed_at END,
                last_error = $3,
                updated_at = NOW()
            WHERE event_id = $1
        `,
        [
            eventId,
            status,
            status === "failed"
                ? error instanceof Error
                    ? error.message.slice(0, 500)
                    : "Falha desconhecida"
                : null,
        ]
    );
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
            if (payload.fromMe !== true || payload.source === "api") {
                return NextResponse.json({ ok: true });
            }

            const messageId = getStableMessageId(event, rawBody);
            claimedEventId = `owner:${sessionName}:${messageId}`;
            if (!(await claimEvent(claimedEventId))) {
                return NextResponse.json({ ok: true, duplicate: true });
            }

            await markOwnerTookOverConversation({
                restaurantId: connection.restaurant_id,
                chatId,
            });
            await finishEvent(claimedEventId, "processed");
            return NextResponse.json({ ok: true });
        }

        if (eventName === "message" && payload.fromMe !== true) {
            const selectedRowId = extractSelectedRowId(payload);
            const incomingBody =
                selectedRowId === "menu"
                    ? "menu_link"
                    : selectedRowId || extractIncomingBody(payload);
            if (isGeneratedOrderMessage(incomingBody)) {
                return NextResponse.json({ ok: true, ignored: "order_message" });
            }

            const messageId = getStableMessageId(event, rawBody);
            claimedEventId = `inbound:${sessionName}:${messageId}`;
            if (!(await claimEvent(claimedEventId))) {
                return NextResponse.json({ ok: true, duplicate: true });
            }

            await processIncomingWhatsAppMessage({
                restaurantId: connection.restaurant_id,
                sessionName,
                chatId,
                body: incomingBody,
                hasMedia: payload.hasMedia === true,
                messageId,
                customerName: extractCustomerName(payload),
            });
            await finishEvent(claimedEventId, "processed");
        }

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("[WAHA_WEBHOOK]", error);

        if (claimedEventId) {
            try {
                await finishEvent(claimedEventId, "failed", error);
            } catch (finishError) {
                console.error(
                    "[WAHA_WEBHOOK] Failed to mark event as failed:",
                    finishError
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
