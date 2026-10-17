import type { PoolClient } from "pg";
import { query, withTransaction } from "@/lib/database/sql";
import { getWahaSession, stopWahaSession } from "@/lib/services/wahaClient";

const PAIRING_MAX_AGE_MS = 5 * 24 * 60 * 60 * 1000;
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
};

export async function cleanupExpiredWhatsAppPairing() {
    const result = { checked: 0, stopped: 0, skipped: 0, errors: 0 };
    const started = Date.now();
    const candidates = await query<{ restaurant_id: string }>(
        `SELECT restaurant_id FROM whatsapp_connections
         WHERE desired_state = 'connected' AND status <> 'WORKING'
           AND pairing_started_at <= NOW() - INTERVAL '5 days'
         ORDER BY pairing_started_at, restaurant_id LIMIT $1`,
        [MAX_SESSIONS_PER_RUN]
    );

    for (const candidate of candidates.rows) {
        // Each session uses at most two five-second WAHA requests.
        if (Date.now() - started > CLEANUP_BUDGET_MS - 10_000) break;
        result.checked += 1;
        try {
            const stopped = await withTransaction(async (client) => {
                const lock = await client.query<{ locked: boolean }>(
                    "SELECT pg_try_advisory_xact_lock(hashtextextended($1, 0)) AS locked",
                    ["whatsapp-pairing:" + candidate.restaurant_id.toLowerCase()]
                );
                if (!lock.rows[0]?.locked) return false;
                const rows = await client.query<PairingRow>(
                    `SELECT restaurant_id, session_name, desired_state, status, pairing_started_at
                     FROM whatsapp_connections WHERE restaurant_id = $1`,
                    [candidate.restaurant_id]
                );
                const connection = rows.rows[0];
                if (!connection || connection.desired_state !== "connected" ||
                    connection.status === "WORKING" ||
                    !isWhatsAppPairingExpired(connection.pairing_started_at)) return false;

                // The provider is authoritative: a just-paired session must survive
                // even if its WORKING webhook has not reached the database yet.
                const live = await getWahaSession(connection.session_name, 5_000);
                if (live?.status === "WORKING") {
                    await client.query(
                        "UPDATE whatsapp_connections SET pairing_started_at = NULL WHERE restaurant_id = $1",
                        [connection.restaurant_id]
                    );
                    return false;
                }

                if (live && live.status !== "STOPPED") {
                    await stopWahaSession(connection.session_name);
                }

                // Stop, never logout/delete. Clear the desired state so subsequent
                // STOPPED webhooks cannot automatically restart this attempt.
                await client.query(
                    `UPDATE whatsapp_connections
                     SET desired_state = 'disconnected', status = 'STOPPED',
                         pairing_started_at = NULL, qr_code_data = NULL, qr_updated_at = NULL,
                         last_disconnected_at = NOW(), last_event_at = NOW(), updated_at = NOW(),
                         last_error = 'A conexão foi pausada após 5 dias sem concluir o pareamento. Clique em Conectar para tentar novamente.'
                     WHERE restaurant_id = $1`,
                    [connection.restaurant_id]
                );
                return true;
            });
            if (stopped) result.stopped += 1;
            else result.skipped += 1;
        } catch (error) {
            result.errors += 1;
            console.warn("[whatsapp-pairing-cleanup] Could not stop expired pairing", {
                restaurantId: candidate.restaurant_id,
                error,
            });
        }
    }
    return result;
}
