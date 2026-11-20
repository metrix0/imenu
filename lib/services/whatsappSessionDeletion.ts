import { query } from "@/lib/database/sql";
import { deleteWahaSession } from "@/lib/services/wahaClient";

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
