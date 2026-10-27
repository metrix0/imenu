import { NextResponse } from "next/server";
import { processCustomerAutomations } from "@/lib/services/crmAutomations";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(request: Request) {
  if (
    !process.env.CRON_SECRET ||
    request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`
  )
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  try {
    return NextResponse.json(await processCustomerAutomations(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[CUSTOMER_AUTOMATIONS]", error);
    return NextResponse.json(
      { error: "Falha ao processar automações." },
      { status: 500 },
    );
  }
}
