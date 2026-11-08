import { NextResponse } from "next/server";
import { requireRestaurantOwner, RestaurantOwnerAuthError } from "@/lib/auth/restaurantOwner";
import { query, withTransaction } from "@/lib/database/sql";
import { loadDeliveryConfig } from "@/lib/delivery/integrations";
import { ifoodRequest, seal, unseal, emptyDeliveryConfig, type DeliveryConfig } from "@/lib/delivery/providers";

export async function GET(request: Request) {
    try {
        const restaurantId = new URL(request.url).searchParams.get("restaurantId") || "";
        await requireRestaurantOwner(request, restaurantId);
        const config = await loadDeliveryConfig(restaurantId);
        const failures = await query(`SELECT d.order_id,o.display_id,d.state,d.error FROM delivery_dispatches d
            JOIN orders o ON o.id=d.order_id WHERE d.restaurant_id=$1 AND d.state IN ('failed','uncertain','requesting')
            AND o.status='preparing' ORDER BY d.updated_at DESC LIMIT 10`, [restaurantId]);
        return NextResponse.json({
            config: { ifood: { ...config.ifood, clientSecret: "" }, machine: { ...config.machine, apiKey: "", password: "" } },
            configured: { ifood: Boolean(config.ifood.clientSecret), machine: Boolean(config.machine.apiKey && config.machine.password) },
            available: Buffer.from(process.env.DELIVERY_INTEGRATIONS_KEY || "", "base64").length === 32, failures: failures.rows,
        }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) { return failure(error); }
}
export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        const restaurantId = String(body.restaurantId || "");
        await requireRestaurantOwner(request, restaurantId);
        await withTransaction(async client => {
            await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`delivery-config:${restaurantId}`]);
            const existing = await client.query("SELECT credentials FROM delivery_integrations WHERE restaurant_id=$1", [restaurantId]);
            const old = existing.rows[0] ? unseal(existing.rows[0].credentials) : structuredClone(emptyDeliveryConfig);
            const next: DeliveryConfig = structuredClone(old);
            for (const provider of ["ifood", "machine"] as const) {
                const fields = next[provider] as unknown as Record<string, string | boolean>;
                for (const key of Object.keys(fields)) {
                    if (key === "enabled") { fields[key] = body.config?.[provider]?.enabled === true; continue; }
                    if (typeof body.config?.[provider]?.[key] !== "string" || body.config[provider][key].length > 8000) throw new RestaurantOwnerAuthError("Configuração inválida.",400);
                    const value = key === "password" ? body.config[provider][key] : body.config[provider][key].trim();
                    if (["clientSecret","apiKey","password"].includes(key) && !value) continue;
                    fields[key] = value;
                }
            }
            if (next.ifood.enabled) {
                if (!/^[a-f0-9-]{36}$/i.test(next.ifood.merchantId) || !next.ifood.clientId || !next.ifood.clientSecret) throw new RestaurantOwnerAuthError("Preencha os dados do iFood.",400);
                if (!old.ifood.enabled || JSON.stringify(old.ifood) !== JSON.stringify(next.ifood)) {
                    await ifoodRequest(next.ifood, `/merchant/v1.0/merchants/${encodeURIComponent(next.ifood.merchantId)}`);
                }
            }
            if (next.machine.enabled && (!next.machine.username || !next.machine.password || !next.machine.apiKey ||
                !/^[1-9][0-9]*$/.test(next.machine.companyId) || !["D","B","C","X","P","H","F","R"].includes(next.machine.payment) ||
                (next.machine.categoryId && !/^[1-9][0-9]*$/.test(next.machine.categoryId)))) {
                throw new RestaurantOwnerAuthError("Preencha os dados da Machine e a forma de pagamento da entrega.",400);
            }
            await client.query(`INSERT INTO delivery_integrations(restaurant_id,credentials,ifood_merchant_id,ifood_enabled)
                VALUES($1,$2,$3,$4) ON CONFLICT(restaurant_id) DO UPDATE SET credentials=EXCLUDED.credentials,
                ifood_merchant_id=EXCLUDED.ifood_merchant_id,ifood_enabled=EXCLUDED.ifood_enabled,updated_at=now()`,
                [restaurantId,seal(next),next.ifood.merchantId || null,next.ifood.enabled]);
        });
        return NextResponse.json({ ok: true });
    } catch (error) { return failure(error); }
}
function failure(error: unknown) {
    return NextResponse.json({ error: error instanceof RestaurantOwnerAuthError ? error.message : "Não foi possível carregar ou salvar a integração. Confira os dados e a liberação da conta." },
        { status: error instanceof RestaurantOwnerAuthError ? error.status : 503 });
}
