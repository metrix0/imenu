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
    if (!selected.length) return { queued: 0, phones: new Set<string>() };
    await createSupportBlast({
        campaignId: dailyCampaignId(day, "plus_feedback"),
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

    // Daily 19:00 São Paulo snapshot. No backfill for step-4 completion.
    const { day, hour } = brazilClock(new Date());
    if (hour !== 19) {
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
        const { plans, eligible, recipients, sendable } = await getRecoveryPlan(day, feedback.phones);
        if (!recipients.length) {
            return NextResponse.json({ day, eligible, queued: 0, feedbackQueued: feedback.queued, feedbackError });
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
            feedbackQueued: feedback.queued,
            feedbackError,
        }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
        console.error("[ABANDONED_BLAST] Failed:", error);
        return NextResponse.json({ error: "Falha ao preparar envio automático." }, { status: 500 });
    }
}
