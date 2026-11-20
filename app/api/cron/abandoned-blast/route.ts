import { NextResponse } from "next/server";

import { RECOVERY_DAILY_LIMIT } from "@/lib/dev/abandonedBlast";
import { PLUS_FIRST_MONTH_FEEDBACK_MESSAGE, PLUS_FEEDBACK_DAILY_LIMIT } from "@/lib/dev/plusFeedbackBlast";
import { createSupportBlast } from "@/lib/services/supportBlast";
import { brazilClock, dailyCampaignId, getFirstMonthFeedbackRecipients, getRecoveryPlan } from "@/lib/dev/abandonedBlastPlan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function queueFirstMonthFeedback(day: string) {
    const selected = await getFirstMonthFeedbackRecipients(day);
    if (!selected.length) return 0;
    await createSupportBlast({
        campaignId: dailyCampaignId(day, "plus_feedback"),
        sender: "support",
        message: PLUS_FIRST_MONTH_FEEDBACK_MESSAGE,
        dailyLimit: PLUS_FEEDBACK_DAILY_LIMIT,
        skipRecent: true,
        recipients: selected,
    });
    return selected.length;
}

export async function GET(request: Request) {
    const secret = process.env.CRON_SECRET?.trim();
    if (!secret || request.headers.get("authorization") !== "Bearer " + secret) {
        return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    // Daily 19:00 São Paulo snapshot. No backfill for step-4 completion.
    const { day, hour } = brazilClock(new Date());
    if (hour !== 19) {
        return NextResponse.json({ skipped: "outside_sending_hour", day });
    }

    try {
        let feedbackQueued = 0;
        let feedbackError = false;
        try {
            feedbackQueued = await queueFirstMonthFeedback(day);
        } catch (error) {
            feedbackError = true;
            console.error("[PLUS_FIRST_MONTH_FEEDBACK] Failed to queue:", error);
        }
        const { plans, eligible, recipients, sendable } = await getRecoveryPlan(day);
        if (!recipients.length) {
            return NextResponse.json({ day, eligible, queued: 0, feedbackQueued, feedbackError });
        }

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
            feedbackQueued,
            feedbackError,
        }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
        console.error("[ABANDONED_BLAST] Failed:", error);
        return NextResponse.json({ error: "Falha ao preparar envio automático." }, { status: 500 });
    }
}
