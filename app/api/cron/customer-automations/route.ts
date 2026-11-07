import { NextResponse } from "next/server";
import { processCustomerAutomations } from "@/lib/services/crmAutomations";
import { runIntegrationChecks } from "@/lib/dev/integrationProbes";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(request: Request) {
  if (
    !process.env.CRON_SECRET ||
    request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`
  )
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  // Use the existing 15-minute authenticated timer for independent, read-only checks.
  // Monitoring errors must not change customer automation success/failure.
  const health = runIntegrationChecks().catch(error => {
    console.error("[INTEGRATION_HEALTH]", error instanceof Error ? error.name : "unknown");
  });
  try {
    const result = await processCustomerAutomations();
    await health;
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    await health;
    console.error("[CUSTOMER_AUTOMATIONS]", error);
    return NextResponse.json(
      { error: "Falha ao processar automações." },
      { status: 500 },
    );
  }
}
