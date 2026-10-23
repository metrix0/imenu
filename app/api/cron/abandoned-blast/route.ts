import { createHash } from "node:crypto";
import { NextResponse } from "next/server";

import { ABANDONED_BLAST_MESSAGE, SINGLE_ORDER_DAY_RECOVERY_MESSAGE, NO_FIRST_ORDER_RECOVERY_MESSAGE } from "@/lib/dev/abandonedBlast";
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

function dailyCampaignId(day: string, kind: "abandoned" | "single_day" | "no_first_order" = "abandoned"): string {
    const key = kind === "abandoned" ? "imenu:abandoned-blast:" + day
        : "imenu:abandoned-blast:" + kind + ":" + day;
    const hash = createHash("sha256").update(key).digest("hex");
    return [hash.slice(0, 8), hash.slice(8, 12), "4" + hash.slice(13, 16), "8" + hash.slice(17, 20), hash.slice(20, 32)].join("-");
}

export async function GET(request: Request) {
    const secret = process.env.CRON_SECRET?.trim();
    if (!secret || request.headers.get("authorization") !== "Bearer " + secret) {
        return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    // Daily 20:00 São Paulo snapshot. No backfill for step-4 completion.
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

        const [singleDayCandidates, noOrderCandidates] = await Promise.all([
            query<NewlyAbandoned>(`WITH clock AS (
    SELECT (date_trunc('day', NOW() AT TIME ZONE 'America/Sao_Paulo')
        + INTERVAL '20 hours') AT TIME ZONE 'America/Sao_Paulo' AS as_of
), per_restaurant AS (
    SELECT
        COALESCE(r.user_id::text, r.id::text) AS account_id,
        COALESCE(NULLIF(BTRIM(r.name), ''), 'Restaurante') AS restaurant_name,
        COALESCE(
            NULLIF(regexp_replace(COALESCE(r.phone, ''), '[^0-9]', '', 'g'), ''),
            NULLIF(regexp_replace(COALESCE(u.raw_user_meta_data->>'phone', ''), '[^0-9]', '', 'g'), '')
        ) AS owner_phone,
        MAX(o.created_at) AS last_order_at
    FROM restaurants r
    JOIN orders o ON o.restaurant_id = r.id
    CROSS JOIN clock
    LEFT JOIN auth.users u ON u.id = r.user_id
    WHERE r.creation_step = 4 AND r.first_time = false
      AND o.table_id IS NULL
      AND o.created_at >= clock.as_of - INTERVAL '14 days'
      AND o.created_at < clock.as_of
    GROUP BY r.id, r.user_id, r.name, r.phone, u.raw_user_meta_data
    HAVING COUNT(DISTINCT (o.created_at AT TIME ZONE 'America/Sao_Paulo')::date) = 1
)
SELECT DISTINCT ON (account_id) account_id, restaurant_name, owner_phone
FROM per_restaurant
ORDER BY account_id, last_order_at DESC`),
            query<NewlyAbandoned>(`WITH clock AS (
    SELECT (date_trunc('day', NOW() AT TIME ZONE 'America/Sao_Paulo')
        + INTERVAL '20 hours') AT TIME ZONE 'America/Sao_Paulo' AS as_of
)
SELECT DISTINCT ON (COALESCE(r.user_id, r.id))
    COALESCE(r.user_id::text, r.id::text) AS account_id,
    COALESCE(NULLIF(BTRIM(r.name), ''), 'Restaurante') AS restaurant_name,
    COALESCE(
        NULLIF(regexp_replace(COALESCE(r.phone, ''), '[^0-9]', '', 'g'), ''),
        NULLIF(regexp_replace(COALESCE(u.raw_user_meta_data->>'phone', ''), '[^0-9]', '', 'g'), '')
    ) AS owner_phone
FROM restaurants r
CROSS JOIN clock
LEFT JOIN auth.users u ON u.id = r.user_id
WHERE r.creation_step = 4 AND r.first_time = false
  AND r.onboarding_completed_at >= clock.as_of - INTERVAL '48 hours'
  AND r.onboarding_completed_at < clock.as_of - INTERVAL '24 hours'
  AND NOT EXISTS (
      SELECT 1 FROM orders o
      JOIN restaurants other ON other.id = o.restaurant_id
      WHERE COALESCE(other.user_id, other.id) = COALESCE(r.user_id, r.id)
  )
ORDER BY COALESCE(r.user_id, r.id), r.onboarding_completed_at DESC`),
        ]);

        const plans = [
            { kind: "abandoned" as const, rows: candidates.rows, message: ABANDONED_BLAST_MESSAGE },
            { kind: "single_day" as const, rows: singleDayCandidates.rows, message: SINGLE_ORDER_DAY_RECOVERY_MESSAGE },
            { kind: "no_first_order" as const, rows: noOrderCandidates.rows, message: NO_FIRST_ORDER_RECOVERY_MESSAGE },
        ];
        const seenAccounts = new Set<string>();
        const uniquePhones = new Set<string>();
        const recipients = plans.flatMap((plan) => plan.rows.flatMap((row) => {
            const phone = normalizeBlastPhone(row.owner_phone || "");
            if (!phone || seenAccounts.has(row.account_id) || uniquePhones.has(phone)) return [];
            seenAccounts.add(row.account_id);
            uniquePhones.add(phone);
            return [{
                kind: plan.kind,
                phone,
                message: plan.message.replaceAll("{{Nome Restaurante}}", row.restaurant_name),
            }];
        }));
        const eligible = plans.reduce((total, plan) => total + plan.rows.length, 0);
        if (!recipients.length) {
            return NextResponse.json({ day, eligible, queued: 0 });
        }

        // Apply the 60-day cooldown to all previously sent blasts, including older campaigns.
        const existing = await query<{ phone: string }>(
            `SELECT DISTINCT phone FROM support_blast_recipients
             WHERE phone = ANY($1::text[])
               AND (
                   status IN ('pending', 'processing')
                   OR (status = 'sent' AND sent_at >= NOW() - INTERVAL '60 days')
               )
             UNION
             SELECT split_part(chat_id, '@', 1) AS phone
             FROM whatsapp_outbound_messages
             WHERE chat_id = ANY($2::text[])
               AND dedupe_key LIKE 'support:bulk:%'
               AND status = 'sent'
               AND updated_at >= NOW() - INTERVAL '60 days'`,
            [recipients.map((r) => r.phone), recipients.map((r) => r.phone + "@c.us")]
        );
        const blocked = new Set(existing.rows.map((row) => row.phone));
        const sendable = recipients.filter((recipient) => !blocked.has(recipient.phone));

        const campaigns: Array<{ kind: string; id: string }> = [];
        for (const plan of plans) {
            const selected = sendable.filter((recipient) => recipient.kind === plan.kind);
            if (!selected.length) continue;
            const id = await createSupportBlast({
                campaignId: dailyCampaignId(day, plan.kind),
                sender: "blast",
                message: plan.message,
                dailyLimit: null,
                skipRecent: true,
                recipients: selected.map(({ phone, message }) => ({ phone, message })),
            });
            campaigns.push({ kind: plan.kind, id });
        }

        return NextResponse.json({
            day,
            campaignId: campaigns.find((campaign) => campaign.kind === "abandoned")?.id || campaigns[0]?.id,
            campaignIds: campaigns.map((campaign) => campaign.id),
            eligible,
            queued: sendable.length,
            skipped: recipients.length - sendable.length,
        }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
        console.error("[ABANDONED_BLAST] Failed:", error);
        return NextResponse.json({ error: "Falha ao preparar envio automático." }, { status: 500 });
    }
}
