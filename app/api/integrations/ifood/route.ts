import { receiveIfoodStatus } from "@/lib/delivery/ifoodStatus";
import { NextResponse } from "next/server";
import { query } from "@/lib/database/sql";
import { importIfoodOrder } from "@/lib/delivery/integrations";
import { ifoodRequest, unseal, validSignature } from "@/lib/delivery/providers";

export async function POST(request: Request) {
    try {
        const raw = Buffer.from(await request.arrayBuffer());
        const signature = request.headers.get("x-ifood-signature") || "";
        // Use untrusted routing metadata only to locate credentials; authenticate before handling events.
        const event = JSON.parse(raw.toString("utf8"));
        if (event.code === "KEEPALIVE") {
            const { rows } = await query("SELECT ifood_merchant_id,credentials FROM delivery_integrations WHERE ifood_enabled=true");
            const authenticated = rows.filter(row => validSignature(raw,signature,unseal(row.credentials).ifood.clientSecret));
            const online = authenticated.map(row => row.ifood_merchant_id).filter(id => !Array.isArray(event.merchantIds) || event.merchantIds.includes(id));
            if (!authenticated.length) return new NextResponse(null,{status:401});
            return NextResponse.json({merchantIds:online},{status:202});
        }
        const { rows: [integration] } = await query(`SELECT restaurant_id,credentials FROM delivery_integrations
            WHERE ifood_merchant_id=$1 AND ifood_enabled=true`,[String(event.merchantId || "")]);
        if (!integration) return new NextResponse(null,{status:404});
        const config = unseal(integration.credentials).ifood;
        if (!validSignature(raw,signature,config.clientSecret)) return new NextResponse(null,{status:401});
        if (event.fullCode === "PLACED" || event.code === "PLC") {
            if (!/^[a-f0-9-]{36}$/i.test(event.orderId || "")) return new NextResponse(null,{status:400});
            const exists = await query("SELECT 1 FROM delivery_imported_orders WHERE external_id=$1 AND restaurant_id=$2",[event.orderId,integration.restaurant_id]);
            if (!exists.rowCount) {
                const data = await ifoodRequest(config,`/order/v1.0/orders/${event.orderId}`);
                if (data.id !== event.orderId || data.merchant?.id !== config.merchantId) return new NextResponse(null,{status:403});
                await importIfoodOrder(integration.restaurant_id,data);
            }
        }
        else {
            await receiveIfoodStatus(integration.restaurant_id, event);
        }
        return new NextResponse(null,{status:202});
    } catch { return NextResponse.json({error:"Falha ao receber pedido iFood."},{status:503}); }
}
