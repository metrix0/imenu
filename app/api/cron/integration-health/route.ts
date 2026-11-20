import { NextResponse } from "next/server";
import { runIntegrationChecks } from "@/lib/dev/integrationProbes";
import { checkPlusSupportWaits } from "@/lib/services/supportWaitAlarms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
    const secret = process.env.CRON_SECRET?.trim();
    if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
        return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }
    try {
        const [integrationResult, supportResult] = await Promise.allSettled([
            runIntegrationChecks(),
            checkPlusSupportWaits(),
        ]);
        if (integrationResult.status === "rejected") throw integrationResult.reason;
        if (supportResult.status === "rejected") throw supportResult.reason;
        const checks = integrationResult.value;
        return NextResponse.json({
            checked: checks.length,
            states: Object.fromEntries(checks.map(check => [check.id, check.state])),
            supportAlarms: supportResult.value,
        }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
        console.error("[INTEGRATION_HEALTH]", error instanceof Error ? error.name : "unknown");
        return NextResponse.json({ error: "Falha nas verificações." }, { status: 500 });
    }
}
