import type { PoolClient } from "pg";
import { query, withTransaction } from "@/lib/database/sql";
import { getWahaSession, stopWahaSession } from "@/lib/services/wahaClient";

const PAIRING_MAX_AGE_MS = 5 * 24 * 60 * 60 * 1000;

const AUTOMATIC_RESTART_DELAYS_MS = [
    60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000,
    6 * 60 * 60_000, 12 * 60 * 60_000,
] as const;

// Persisted exponential backoff prevents repeated FAILED status events
// from restarting the same WAHA session continuously.
export function shouldAutomaticallyRestartWahaSession(
    lastRestartAt: string | null | undefined,
    automaticRestartAttempts: number,
    now = Date.now()
): boolean {
    if (!lastRestartAt) return true;
    const previous = Date.parse(lastRestartAt);
    if (!Number.isFinite(previous)) return false;
    const attempts = Math.max(0, Math.floor(automaticRestartAttempts || 0));
    const delay = AUTOMATIC_RESTART_DELAYS_MS[
        Math.min(attempts, AUTOMATIC_RESTART_DELAYS_MS.length - 1)
    ];
    return now - previous >= delay;
}
const CLEANUP_BUDGET_MS = 30_000;
const MAX_SESSIONS_PER_RUN = 25;

// This nullable column is set by explicit Connect/reconnect and first QR events,
// preserved by automatic retries, and cleared after successful pairing.
export function pairingStartedAtForStatus(
    status: string,
    current: string | null | undefined,
    now: string
): string | null {
    if (status === "WORKING") return null;
    if (["SCAN_QR_CODE", "PASSKEY_REQUIRED", "PASSKEY_CONFIRMATION_REQUIRED"].includes(status)) {
        return current || now;
    }
    return current || null;
}

export function isWhatsAppPairingExpired(
    startedAt: string | Date | null,
    now = Date.now()
): boolean {
    if (!startedAt) return false;
    const timestamp = typeof startedAt === "string"
        ? Date.parse(startedAt)
        : startedAt.getTime();
    return Number.isFinite(timestamp) && now - timestamp >= PAIRING_MAX_AGE_MS;
}

// Shared across cleanup, owner requests and status webhooks, including separate
// app processes. Re-read the row after acquiring this lock.
export async function withWhatsAppPairingLock<T>(
    restaurantId: string,
    callback: (client: PoolClient) => Promise<T>
): Promise<T> {
    return withTransaction(async (client) => {
        await client.query(
            "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
            ["whatsapp-pairing:" + restaurantId.toLowerCase()]
        );
        return callback(client);
    });
}

type PairingRow = {
    restaurant_id: string;
    session_name: string;
    desired_state: string;
    status: string;
    pairing_started_at: string | Date | null;
    last_disconnected_at: string | Date | null;
    updated_at: string | Date;
};

export function shouldCleanupStaleWhatsAppConnection(
    connection: PairingRow,
    now = Date.now()
): boolean {
    if (connection.desired_state === "connected") {
        return connection.status !== "WORKING" &&
            isWhatsAppPairingExpired(
                connection.pairing_started_at ?? connection.last_disconnected_at, now
            );
    }
    const updated = typeof connection.updated_at === "string"
        ? Date.parse(connection.updated_at)
        : connection.updated_at.getTime();
    return connection.desired_state === "disconnected" &&
        Number.isFinite(updated) && now - updated > 15 * 60_000;
}

export async function cleanupExpiredWhatsAppPairing() {
    const result = { checked: 0, stopped: 0, reconciled: 0, skipped: 0, errors: 0 };
    const started = Date.now();
    // A bounded, daily rotation checks all disconnected accounts without
    // repeatedly scanning just the first 25. Existing failed connections
    // without a pairing timestamp use their last disconnect timestamp.
    const candidates = await query<{ restaurant_id: string }>(
        `WITH expired AS (
            SELECT restaurant_id FROM whatsapp_connections
            WHERE desired_state = 'connected' AND status <> 'WORKING'
              AND COALESCE(pairing_started_at, last_disconnected_at)
                    <= NOW() - INTERVAL '5 days'
            ORDER BY COALESCE(pairing_started_at, last_disconnected_at), restaurant_id
            LIMIT 10
        ), disconnected AS (
            SELECT restaurant_id FROM whatsapp_connections
            WHERE desired_state = 'disconnected'
              AND updated_at <= NOW() - INTERVAL '15 minutes'
              AND ((hashtext(restaurant_id::text) & 2147483647) % 7) =
                  (FLOOR(EXTRACT(EPOCH FROM NOW()) / 86400)::integer % 7)
            ORDER BY restaurant_id LIMIT 15
        )
        SELECT restaurant_id FROM expired UNION ALL
        SELECT restaurant_id FROM disconnected`
    );

    for (const candidate of candidates.rows.slice(0, MAX_SESSIONS_PER_RUN)) {
        if (Date.now() - started > CLEANUP_BUDGET_MS - 10_000) break;
        result.checked += 1;
        try {
            const outcome = await withTransaction(async (client) => {
                const lock = await client.query<{ locked: boolean }>(
                    "SELECT pg_try_advisory_xact_lock(hashtextextended($1, 0)) AS locked",
                    ["whatsapp-pairing:" + candidate.restaurant_id.toLowerCase()]
                );
                if (!lock.rows[0]?.locked) return "skipped" as const;

                const rows = await client.query<PairingRow>(
                    `SELECT restaurant_id, session_name, desired_state, status,
                            pairing_started_at, last_disconnected_at, updated_at
                     FROM whatsapp_connections WHERE restaurant_id = $1`,
                    [candidate.restaurant_id]
                );
                const connection = rows.rows[0];
                if (!connection || !shouldCleanupStaleWhatsAppConnection(connection)) {
                    return "skipped" as const;
                }

                // Never stop a currently working session, even if Supabase
                // contains an outdated disconnected/failed state.
                const live = await getWahaSession(connection.session_name, 5_000);
                if (live?.status === "WORKING") {
                    if (connection.desired_state === "connected") {
                        await client.query(
                            `UPDATE whatsapp_connections SET status = 'WORKING',
                                pairing_started_at = NULL, last_connected_at = NOW(),
                                last_error = NULL, updated_at = NOW()
                             WHERE restaurant_id = $1`,
                            [connection.restaurant_id]
                        );
                        return "reconciled" as const;
                    }
                    console.warn("[whatsapp-pairing-cleanup] Disconnected account is WORKING; manual review required", {
                        restaurantId: connection.restaurant_id,
                    });
                    return "skipped" as const;
                }
                if (live && live.status !== "STOPPED") {
                    // STOP retains WhatsApp credentials. Never logout/delete
                    // on an unattended cleanup.
                    await stopWahaSession(connection.session_name);
                    const after = await getWahaSession(connection.session_name, 5_000);
                    if (after && after.status !== "STOPPED") {
                        throw new Error("WAHA did not confirm session stop");
                    }
                }

                if (connection.desired_state === "disconnected") {
                    return live && live.status !== "STOPPED" ? "stopped" as const : "skipped" as const;
                }
                await client.query(
                    `UPDATE whatsapp_connections SET desired_state = 'disconnected',
                        status = 'STOPPED', pairing_started_at = NULL,
                        qr_code_data = NULL, qr_updated_at = NULL,
                        last_disconnected_at = NOW(), last_event_at = NOW(),
                        updated_at = NOW(),
                        last_error = 'A conexão foi pausada após 5 dias sem reconectar. Clique em Conectar para tentar novamente.'
                     WHERE restaurant_id = $1`,
                    [connection.restaurant_id]
                );
                return "stopped" as const;
            });
            result[outcome] += 1;
        } catch (error) {
            result.errors += 1;
            console.warn("[whatsapp-pairing-cleanup] Could not reconcile session", {
                restaurantId: candidate.restaurant_id,
                error,
            });
        }
    }
    return result;
}
