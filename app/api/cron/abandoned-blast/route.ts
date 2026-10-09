import { createHash } from "node:crypto";
import { NextResponse } from "next/server";

import { ABANDONED_BLAST_MESSAGE } from "@/lib/dev/abandonedBlast";
import { query } from "@/lib/database/sql";
import { createSupportBlast, normalizeBlastPhone } from "@/lib/services/supportBlast";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type NewlyAbandoned = {
    account_id: string;
    restaurant_name: string;
    owner_phone: string | null;
};

function brazilClock(date: Date): { day: string; hour: number } {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Sao_Paulo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        hourCycle: "h23",
    }).formatToParts(date);
    const part = (name: string) => parts.find((item) => item.type === name)?.value || "";
    return { day: [part("year"), part("month"), part("day")].join("-"), hour: Number(part("hour")) };
}

function dailyCampaignId(day: string): string {
    const hash = createHash("sha256").update("imenu:abandoned-blast:" + day).digest("hex");
    return [hash.slice(0, 8), hash.slice(8, 12), "4" + hash.slice(13, 16), "8" + hash.slice(17, 20), hash.slice(20, 32)].join("-");
}

export async function GET(request: Request) {
    const secret = process.env.CRON_SECRET?.trim();
    if (!secret || request.headers.get("authorization") !== "Bearer " + secret) {
        return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    // No backfill: only newly abandoned restaurants at the 20:00 São Paulo snapshot.
    const { day, hour } = brazilClock(new Date());
    if (hour !== 20) {
        return NextResponse.json({ skipped: "outside_sending_hour", day });
    }

    try {
        const candidates = await query<NewlyAbandoned>(
            `WITH clock AS (
                SELECT (
                    date_trunc('day', NOW() AT TIME ZONE 'America/Sao_Paulo')
                    + INTERVAL '20 hours'
                ) AT TIME ZONE 'America/Sao_Paulo' AS as_of
            ),
            completed AS (
                SELECT
                    COALESCE(r.user_id::text, r.id::text) AS account_id,
                    r.id AS restaurant_id,
                    o.created_at
                FROM orders o
                JOIN restaurants r ON r.id = o.restaurant_id
                CROSS JOIN clock
                WHERE o.table_id IS NULL
                  AND o.status = 'done'
                  AND o.created_at >= clock.as_of - INTERVAL '30 days'
                  AND o.created_at < clock.as_of
            ),
            qualified AS (
                SELECT account_id, MAX(created_at) AS last_done_at
                FROM completed
                GROUP BY account_id
                HAVING COUNT(DISTINCT (created_at AT TIME ZONE 'America/Sao_Paulo')::date) >= 2
                   AND MAX(created_at) >= (SELECT as_of - INTERVAL '15 days' FROM clock)
                   AND MAX(created_at) < (SELECT as_of - INTERVAL '14 days' FROM clock)
            ),
            activity AS (
                SELECT account_id, restaurant_id, MAX(created_at) AS last_restaurant_order
                FROM completed
                GROUP BY account_id, restaurant_id
            )
            SELECT DISTINCT ON (q.account_id)
                q.account_id,
                COALESCE(NULLIF(BTRIM(r.name), ''), 'Restaurante') AS restaurant_name,
                COALESCE(
                    NULLIF(regexp_replace(COALESCE(r.phone, ''), '[^0-9]', '', 'g'), ''),
                    NULLIF(regexp_replace(COALESCE(u.raw_user_meta_data->>'phone', ''), '[^0-9]', '', 'g'), '')
                ) AS owner_phone
            FROM qualified q
            JOIN activity a ON a.account_id = q.account_id
            JOIN restaurants r ON r.id = a.restaurant_id
            LEFT JOIN auth.users u ON u.id = r.user_id
            ORDER BY q.account_id, a.last_restaurant_order DESC, r.created_at DESC`
        );

        const uniquePhones = new Set<string>();
        const recipients = candidates.rows.flatMap((row) => {
            const phone = normalizeBlastPhone(row.owner_phone || "");
            if (!phone || uniquePhones.has(phone)) return [];
            uniquePhones.add(phone);
            return [{
                phone,
                message: ABANDONED_BLAST_MESSAGE.replaceAll("{{Nome Restaurante}}", row.restaurant_name),
            }];
        });

        if (!recipients.length) {
            return NextResponse.json({ day, eligible: candidates.rows.length, queued: 0 });
        }

        // Exclude contacts blasted in the last 30 days and those already queued
        // (including manual and cadenced campaigns).
        const existing = await query<{ phone: string }>(
            `SELECT DISTINCT phone FROM support_blast_recipients
             WHERE phone = ANY($1::text[])
               AND (
                   status IN ('pending', 'processing')
                   OR (status = 'sent' AND sent_at >= NOW() - INTERVAL '30 days')
               )
             UNION
             SELECT split_part(chat_id, '@', 1) AS phone
             FROM whatsapp_outbound_messages
             WHERE chat_id = ANY($2::text[])
               AND dedupe_key LIKE 'support:bulk:%'
               AND status = 'sent'
               AND updated_at >= NOW() - INTERVAL '30 days'`,
            [recipients.map((r) => r.phone), recipients.map((r) => r.phone + "@c.us")]
        );
        const blocked = new Set(existing.rows.map((row) => row.phone));
        const sendable = recipients.filter((recipient) => !blocked.has(recipient.phone));

        if (!sendable.length) {
            return NextResponse.json({
                day, eligible: candidates.rows.length, queued: 0, skipped: recipients.length,
            });
        }

        // Daily stable campaign ID ensures retries cannot duplicate an existing campaign.
        const campaignId = await createSupportBlast({
            campaignId: dailyCampaignId(day),
            sender: "blast",
            message: ABANDONED_BLAST_MESSAGE,
            dailyLimit: null,
            skipRecent: true,
            recipients: sendable,
        });

        return NextResponse.json({
            day,
            campaignId,
            eligible: candidates.rows.length,
            queued: sendable.length,
            skipped: recipients.length - sendable.length,
        }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
        console.error("[ABANDONED_BLAST] Failed:", error);
        return NextResponse.json({ error: "Falha ao preparar envio automático." }, { status: 500 });
    }
}
