import { NextResponse } from "next/server";
import { query } from "@/lib/database/sql";
import { pollIfoodOrders } from "@/lib/delivery/ifoodPolling";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
    const secret = process.env.CRON_SECRET?.trim();
    if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`)
        return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    const { rows } = await query("SELECT restaurant_id FROM delivery_integrations WHERE ifood_enabled=true AND ifood_merchant_id IS NOT NULL");
    let failed = 0;
    // The application pool has five connections; leave room for owner actions and import transactions.
    for (const row of rows) {
        try { await pollIfoodOrders(row.restaurant_id); }
        catch { failed++; }
    }
    return NextResponse.json({ checked: rows.length, failed }, { status: failed ? 503 : 200, headers: { "Cache-Control": "no-store" } });
}
