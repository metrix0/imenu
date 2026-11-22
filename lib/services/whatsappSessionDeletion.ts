import { query, withTransaction } from "@/lib/database/sql";
import { deleteWahaSession, getWahaSession, stopWahaSession } from "@/lib/services/wahaClient";

export async function processRestaurantWhatsappSessionDeletions(): Promise<void> {
    try {
        // Reserve a batch for five minutes. A failed or interrupted attempt becomes eligible again.
        const { rows } = await query<{ session_name: string }>(
            `UPDATE public.restaurant_whatsapp_session_deletions AS cleanup
             SET next_attempt_at = NOW() + INTERVAL '5 minutes'
             FROM (
                 SELECT session_name
                 FROM public.restaurant_whatsapp_session_deletions
                 WHERE next_attempt_at <= NOW()
                 ORDER BY next_attempt_at, session_name
                 LIMIT 4
                 FOR UPDATE SKIP LOCKED
             ) AS batch
             WHERE cleanup.session_name = batch.session_name
             RETURNING cleanup.session_name`,
        );

        await Promise.all(rows.map(async ({ session_name }) => {
            try {
                await deleteWahaSession(session_name);
                await query(
                    "DELETE FROM public.restaurant_whatsapp_session_deletions WHERE session_name = $1",
                    [session_name],
                );
            } catch (error) {
                console.error("[RESTAURANT_DELETION] WhatsApp cleanup attempt failed:", error);
            }
        }));
    } catch (error) {
        console.error("[RESTAURANT_DELETION] Could not claim WhatsApp cleanups:", error);
    }
}


/**
 * Daily removal of WAHA sessions for restaurants with no iMenu orders for 60 days.
 * An active AI bot is protected. The restaurant, bot settings and conversation rows
 * remain intact; deleting the connection row lets a returning owner pair anew.
 */
export async function cleanupInactiveRestaurantWhatsappSessions(): Promise<{
    checked: number; deleted: number; skipped: number; errors: number;
}> {
    const result = { checked: 0, deleted: 0, skipped: 0, errors: 0 };
    const { rows } = await query<{ restaurant_id: string }>(
        `SELECT w.restaurant_id
         FROM public.whatsapp_connections AS w
         JOIN public.restaurants AS r ON r.id = w.restaurant_id
         WHERE r.created_at < NOW() - INTERVAL '60 days'
           AND w.created_at < NOW() - INTERVAL '60 days'
           AND NOT EXISTS (
               SELECT 1 FROM public.orders AS o
               WHERE o.restaurant_id = r.id
                 AND o.created_at >= NOW() - INTERVAL '60 days'
           )
           AND NOT EXISTS (
               SELECT 1 FROM public.whatsapp_bot_settings AS b
               WHERE b.restaurant_id = r.id
                 AND b.automations->>'ai_enabled' = 'true'
           )
         ORDER BY w.created_at, w.restaurant_id
         LIMIT 24`
    );

    for (let offset = 0; offset < rows.length; offset += 4) {
        await Promise.all(rows.slice(offset, offset + 4).map(async ({ restaurant_id }) => {
            result.checked++;
            try {
                const outcome = await withTransaction(async (client) => {
                    // Use the same pairing lock as connect/reconnect, without blocking the owner.
                    const lock = await client.query<{ locked: boolean }>(
                        "SELECT pg_try_advisory_xact_lock(hashtextextended($1, 0)) AS locked",
                        ["whatsapp-pairing:" + restaurant_id.toLowerCase()]
                    );
                    if (!lock.rows[0]?.locked) return "skipped" as const;

                    // Lock the parent row: concurrent order and bot-setting inserts must wait.
                    const restaurant = await client.query(
                        "SELECT id FROM public.restaurants WHERE id = $1 FOR UPDATE",
                        [restaurant_id]
                    );
                    if (!restaurant.rowCount) return "skipped" as const;

                    // Lock existing bot settings so enabling the AI bot cannot race deletion.
                    const botSettings = await client.query<{ automations: { ai_enabled?: boolean } | null }>(
                        "SELECT automations FROM public.whatsapp_bot_settings WHERE restaurant_id = $1 FOR SHARE",
                        [restaurant_id]
                    );
                    if (botSettings.rows[0]?.automations?.ai_enabled === true) {
                        return "skipped" as const;
                    }

                    // Re-evaluate after acquiring locks; never delete on stale daily counts.
                    const candidates = await client.query<{ session_name: string }>(
                        `SELECT w.session_name FROM public.whatsapp_connections AS w
                         JOIN public.restaurants AS r ON r.id = w.restaurant_id
                         WHERE w.restaurant_id = $1
                           AND r.created_at < NOW() - INTERVAL '60 days'
                           AND w.created_at < NOW() - INTERVAL '60 days'
                           AND NOT EXISTS (
                               SELECT 1 FROM public.orders AS o
                               WHERE o.restaurant_id = r.id
                                 AND o.created_at >= NOW() - INTERVAL '60 days'
                           )
                           AND NOT EXISTS (
                               SELECT 1 FROM public.whatsapp_bot_settings AS b
                               WHERE b.restaurant_id = r.id
                                 AND b.automations->>'ai_enabled' = 'true'
                           )
                         FOR UPDATE OF w`,
                        [restaurant_id]
                    );
                    const sessionName = candidates.rows[0]?.session_name;
                    // The official support/other sessions must never be included.
                    if (sessionName !== "imenu-" + restaurant_id.toLowerCase()) {
                        return "skipped" as const;
                    }

                    const session = await getWahaSession(sessionName, 5_000);
                    if (session && session.name !== sessionName) {
                        throw new Error("WAHA returned a mismatched session");
                    }
                    if (session && session.status !== "STOPPED") {
                        await stopWahaSession(sessionName);
                    }
                    await deleteWahaSession(sessionName);
                    if (await getWahaSession(sessionName, 5_000)) {
                        throw new Error("WAHA session still exists after deletion");
                    }
                    const removed = await client.query(
                        "DELETE FROM public.whatsapp_connections WHERE restaurant_id = $1 AND session_name = $2",
                        [restaurant_id, sessionName]
                    );
                    if (removed.rowCount !== 1) {
                        throw new Error("WhatsApp connection row was not removed");
                    }
                    return "deleted" as const;
                });
                result[outcome]++;
            } catch (error) {
                result.errors++;
                console.warn("[waha-inactive-cleanup] Session deletion failed", {
                    restaurantId: restaurant_id, error,
                });
            }
        }));
    }

    return result;
}
