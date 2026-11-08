import { createHash } from "node:crypto";
import { NextResponse } from "next/server";

import { ABANDONED_BLAST_MESSAGE, PLUS_ABANDONED_BLAST_MESSAGE, SINGLE_ORDER_DAY_RECOVERY_MESSAGE, NO_FIRST_ORDER_RECOVERY_MESSAGE, RECOVERY_DAILY_LIMIT } from "@/lib/dev/abandonedBlast";
import { PLUS_FIRST_MONTH_FEEDBACK_MESSAGE, PLUS_FEEDBACK_DAILY_LIMIT } from "@/lib/dev/plusFeedbackBlast";
import { query } from "@/lib/database/sql";
import { createSupportBlast, normalizeBlastPhone } from "@/lib/services/supportBlast";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type NewlyAbandoned = {
    account_id: string;
    restaurant_name: string;
    owner_phone: string | null;
    has_plus?: boolean;
};

type FirstMonthCandidate = {
    addon_id: string;
    account_id: string;
    restaurant_name: string;
    owner_phone: string | null;
    pix_first: boolean;
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

function dailyCampaignId(day: string, kind: "abandoned" | "abandoned_plus" | "abandoned_imenu" | "single_day" | "no_first_order" | "plus_feedback" = "abandoned"): string {
    const key = kind === "abandoned" ? "imenu:abandoned-blast:" + day
        : "imenu:abandoned-blast:" + kind + ":" + day;
    const hash = createHash("sha256").update(key).digest("hex");
    return [hash.slice(0, 8), hash.slice(8, 12), "4" + hash.slice(13, 16), "8" + hash.slice(17, 20), hash.slice(20, 32)].join("-");
}


async function queueFirstMonthFeedback(day: string): Promise<{ queued: number; phones: Set<string> }> {
    const campaignId = dailyCampaignId(day, "plus_feedback");
    const [prior, candidates] = await Promise.all([
        query<{ total: number | string }>(
            "SELECT COUNT(*)::int AS total FROM support_blast_recipients WHERE campaign_id = $1",
            [campaignId]
        ),
        query<FirstMonthCandidate>(`
            WITH first_month AS (
                SELECT DISTINCT ON (COALESCE(r.user_id, r.id))
                    a.id::text AS addon_id,
                    COALESCE(r.user_id, r.id)::text AS account_id,
                    COALESCE(NULLIF(BTRIM(r.name), ''), 'Restaurante') AS restaurant_name,
                    COALESCE(
                        NULLIF(regexp_replace(COALESCE(r.phone, ''), '[^0-9]', '', 'g'), ''),
                        NULLIF(regexp_replace(COALESCE(u.raw_user_meta_data->>'phone', ''), '[^0-9]', '', 'g'), '')
                    ) AS owner_phone,
                    (UPPER(COALESCE(NULLIF(first_paid.billing_type, ''), NULLIF(a.payzu_payment_method, ''), '')) = 'PIX'
                        OR a.payment_provider = 'mercadopago') AS pix_first,
                    a.activated_at,
                    a.current_period_ends_at
                FROM public.restaurant_addons a
                JOIN public.restaurants r ON r.id = a.restaurant_id
                LEFT JOIN auth.users u ON u.id = r.user_id
                JOIN LATERAL (
                    SELECT payment.billing_type
                    FROM public.restaurant_addon_payments payment
                    WHERE payment.addon_id = a.id
                      AND payment.paid_at IS NOT NULL
                      AND payment.amount_cents > 0
                      AND UPPER(payment.status) IN ('CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH', 'PAID', 'COMPLETED', 'APPROVED')
                    ORDER BY payment.paid_at, payment.id
                    LIMIT 1
                ) first_paid ON TRUE
                WHERE a.product_key = 'ia_plus'
                  AND a.activated_at IS NOT NULL
                  AND a.current_period_ends_at IS NOT NULL
                  AND a.current_period_ends_at > NOW()
                  AND a.current_period_ends_at <= a.activated_at + INTERVAL '35 days'
                  AND (a.current_period_ends_at AT TIME ZONE 'America/Sao_Paulo')::date =
                      (NOW() AT TIME ZONE 'America/Sao_Paulo')::date + 7
                  AND (a.status = 'active' OR
                       (a.status IN ('canceled', 'past_due') AND a.current_period_ends_at > NOW()))
                ORDER BY COALESCE(r.user_id, r.id), pix_first DESC, a.activated_at, a.id
            )
            SELECT addon_id, account_id, restaurant_name, owner_phone, pix_first
            FROM first_month
            ORDER BY pix_first DESC, current_period_ends_at, activated_at, addon_id
        `),
    ]);
    const remaining = Math.max(0, PLUS_FEEDBACK_DAILY_LIMIT - Number(prior.rows[0]?.total || 0));
    if (!remaining || !candidates.rows.length) return { queued: 0, phones: new Set() };

    const unique = new Set<string>();
    const eligible = candidates.rows.flatMap(row => {
        const phone = normalizeBlastPhone(row.owner_phone || "");
        if (!phone || unique.has(phone)) return [];
        unique.add(phone);
        return [{ phone, message: PLUS_FIRST_MONTH_FEEDBACK_MESSAGE.replaceAll("{{Nome Restaurante}}", row.restaurant_name) }];
    });
    if (!eligible.length) return { queued: 0, phones: new Set() };
    // Never request first-month feedback twice, even if the period end date changes.
    const priorFeedback = await query<{ phone: string }>(
        `SELECT DISTINCT recipient.phone
         FROM support_blast_recipients recipient
         JOIN support_blast_campaigns campaign ON campaign.id = recipient.campaign_id
         WHERE campaign.message = $1 AND recipient.phone = ANY($2::text[])`,
        [PLUS_FIRST_MONTH_FEEDBACK_MESSAGE, eligible.map(row => row.phone)]
    );
    const alreadyContacted = new Set(priorFeedback.rows.map(row => row.phone));
    const selected = eligible.filter(row => !alreadyContacted.has(row.phone)).slice(0, remaining);
    if (!selected.length) return { queued: 0, phones: new Set() };
    await createSupportBlast({
        campaignId,
        sender: "support",
        message: PLUS_FIRST_MONTH_FEEDBACK_MESSAGE,
        dailyLimit: PLUS_FEEDBACK_DAILY_LIMIT,
        skipRecent: true,
        recipients: selected,
    });
    return { queued: selected.length, phones: new Set(selected.map(row => row.phone)) };
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
        let feedback = { queued: 0, phones: new Set<string>() };
        let feedbackError = false;
        try {
            feedback = await queueFirstMonthFeedback(day);
        } catch (error) {
            feedbackError = true;
            console.error("[PLUS_FIRST_MONTH_FEEDBACK] Failed to queue:", error);
        }
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
                EXISTS (
                    SELECT 1 FROM public.restaurant_addons addon
                    JOIN public.restaurants owned ON owned.id = addon.restaurant_id
                    WHERE COALESCE(owned.user_id, owned.id)::text = q.account_id
                      AND addon.product_key = 'ia_plus'
                      AND (addon.status = 'active' OR
                           (addon.status IN ('canceled', 'past_due') AND addon.current_period_ends_at > NOW()))
                ) AS has_plus,
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
        EXISTS (
            SELECT 1 FROM public.restaurant_addons addon
            JOIN public.restaurants owned ON owned.id = addon.restaurant_id
            WHERE COALESCE(owned.user_id, owned.id) = COALESCE(r.user_id, r.id)
              AND addon.product_key = 'ia_plus'
              AND (addon.status = 'active' OR
                   (addon.status IN ('canceled', 'past_due') AND addon.current_period_ends_at > NOW()))
        ) AS has_plus,
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
SELECT DISTINCT ON (account_id) account_id, restaurant_name, owner_phone, has_plus
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
            { kind: "abandoned_plus" as const, rows: candidates.rows.filter(row => row.has_plus), message: PLUS_ABANDONED_BLAST_MESSAGE },
            { kind: "abandoned_imenu" as const, rows: candidates.rows.filter(row => !row.has_plus), message: ABANDONED_BLAST_MESSAGE },
            { kind: "single_day" as const, rows: singleDayCandidates.rows, message: SINGLE_ORDER_DAY_RECOVERY_MESSAGE },
            { kind: "no_first_order" as const, rows: noOrderCandidates.rows, message: NO_FIRST_ORDER_RECOVERY_MESSAGE },
        ];
        const eligible = plans.reduce((total, plan) => total + plan.rows.length, 0);
        const accounts = [...new Set(plans.flatMap(plan => plan.rows.map(row => row.account_id)))];
        const gmv = accounts.length ? await query<{ account_id: string; gmv_cents: number | string }>(
            `SELECT COALESCE(restaurant.user_id, restaurant.id)::text AS account_id,
                    COALESCE(SUM(GREATEST(COALESCE(orders.subtotal_cents, 0), 0)), 0)::bigint AS gmv_cents
             FROM public.orders orders
             JOIN public.restaurants restaurant ON restaurant.id = orders.restaurant_id
             WHERE COALESCE(restaurant.user_id, restaurant.id)::text = ANY($1::text[])
               AND orders.status = 'done' AND orders.table_id IS NULL
               AND orders.created_at >= NOW() - INTERVAL '30 days'
             GROUP BY 1`, [accounts]
        ) : { rows: [] };
        const gmvByAccount = new Map(gmv.rows.map(row => [row.account_id, Number(row.gmv_cents)]));
        const ranked = plans.flatMap((plan, priority) => plan.rows.map(row => ({
            ...row, kind: plan.kind, priority, template: plan.message,
            gmv: gmvByAccount.get(row.account_id) || 0,
        }))).sort((a, b) => b.gmv - a.gmv || a.priority - b.priority || a.account_id.localeCompare(b.account_id));
        const seenAccounts = new Set<string>();
        const uniquePhones = new Set<string>();
        const recipients = ranked.flatMap(row => {
            const phone = normalizeBlastPhone(row.owner_phone || "");
            if (!phone || seenAccounts.has(row.account_id) || uniquePhones.has(phone) || feedback.phones.has(phone)) return [];
            seenAccounts.add(row.account_id);
            uniquePhones.add(phone);
            return [{ kind: row.kind, phone, message: row.template.replaceAll("{{Nome Restaurante}}", row.restaurant_name) }];
        });
        if (!recipients.length) {
            return NextResponse.json({ day, eligible, queued: 0, feedbackQueued: feedback.queued, feedbackError });
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
        // Shared daily quota across Plus abandonment, iMenu abandonment and activation.
        // Include legacy campaign IDs so a mid-day release cannot double the quota.
        const campaignIds = [...plans.map(plan => dailyCampaignId(day, plan.kind)), dailyCampaignId(day, "abandoned")];
        const prior = await query<{ total: number | string }>(
            "SELECT COUNT(*)::int AS total FROM support_blast_recipients WHERE campaign_id = ANY($1::uuid[])",
            [campaignIds]
        );
        const remaining = Math.max(0, RECOVERY_DAILY_LIMIT - Number(prior.rows[0]?.total || 0));
        const sendable = recipients.filter(recipient => !blocked.has(recipient.phone)).slice(0, remaining);

        const campaigns: Array<{ kind: string; id: string }> = [];
        for (const plan of plans) {
            const selected = sendable.filter((recipient) => recipient.kind === plan.kind);
            if (!selected.length) continue;
            const id = await createSupportBlast({
                campaignId: dailyCampaignId(day, plan.kind),
                sender: "blast",
                message: plan.message,
                dailyLimit: RECOVERY_DAILY_LIMIT,
                skipRecent: true,
                recipients: selected.map(({ phone, message }) => ({ phone, message })),
            });
            campaigns.push({ kind: plan.kind, id });
        }

        return NextResponse.json({
            day,
            campaignId: campaigns.find((campaign) => campaign.kind === "abandoned_plus")?.id || campaigns[0]?.id,
            campaignIds: campaigns.map((campaign) => campaign.id),
            eligible,
            queued: sendable.length,
            skipped: recipients.length - sendable.length,
            feedbackQueued: feedback.queued,
            feedbackError,
        }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
        console.error("[ABANDONED_BLAST] Failed:", error);
        return NextResponse.json({ error: "Falha ao preparar envio automático." }, { status: 500 });
    }
}
