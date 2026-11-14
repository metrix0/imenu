import { NextResponse } from "next/server";
import { requireRestaurantOwner, RestaurantOwnerAuthError } from "@/lib/auth/restaurantOwner";
import { query, withTransaction } from "@/lib/database/sql";
import { loadDeliveryConfig } from "@/lib/delivery/integrations";
import { ifoodAppAvailable, publicIfood } from "@/lib/delivery/ifoodConnection";
import { seal, unseal, emptyDeliveryConfig, type DeliveryConfig } from "@/lib/delivery/providers";

export async function GET(request: Request) {
    try {
        const restaurantId = new URL(request.url).searchParams.get("restaurantId") || "";
        await requireRestaurantOwner(request, restaurantId);
        const config = await loadDeliveryConfig(restaurantId);
        const failures = await query(`SELECT d.order_id,o.display_id,d.state,d.error FROM delivery_dispatches d
            JOIN orders o ON o.id=d.order_id WHERE d.restaurant_id=$1 AND d.state IN ('failed','uncertain','requesting')
            AND o.status='preparing' ORDER BY d.updated_at DESC LIMIT 10`, [restaurantId]);
        return NextResponse.json({
            config: { ifood: { enabled: publicIfood(config.ifood).enabled, merchantId: config.ifood.merchantId, clientId: "", clientSecret: "" }, machine: { ...config.machine, apiKey: "", password: "" } },
            ifood: { ...publicIfood(config.ifood), available: ifoodAppAvailable() },
            configured: { ifood: publicIfood(config.ifood).connected, machine: Boolean(config.machine.apiKey && config.machine.password) },
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
            // OAuth credentials, merchant routing and tokens are server-owned; stale autosaves cannot replace them.
            if (typeof body.config?.ifood?.enabled === "boolean") {
                if (body.config.ifood.enabled && !publicIfood(old.ifood).connected)
                    throw new RestaurantOwnerAuthError("Conecte sua loja ao iFood antes de ativar a integração.", 409);
                next.ifood.enabled = body.config.ifood.enabled;
            }
            for (const provider of ["machine"] as const) {
                if (!body.config?.[provider]) continue;
                const fields = next[provider] as unknown as Record<string, string | boolean>;
                for (const key of Object.keys(fields)) {
                    if (key === "enabled") { fields[key] = body.config?.[provider]?.enabled === true; continue; }
                    if (typeof body.config?.[provider]?.[key] !== "string" || body.config[provider][key].length > 8000) throw new RestaurantOwnerAuthError("Configuração inválida.",400);
                    const value = key === "password" ? body.config[provider][key] : body.config[provider][key].trim();
                    if (["clientSecret","apiKey","password"].includes(key) && !value) continue;
                    fields[key] = value;
                }
            }
            await client.query(`INSERT INTO delivery_integrations(restaurant_id,credentials,ifood_merchant_id,ifood_enabled)
                VALUES($1,$2,$3,$4) ON CONFLICT(restaurant_id) DO UPDATE SET credentials=EXCLUDED.credentials,
                ifood_merchant_id=EXCLUDED.ifood_merchant_id,ifood_enabled=EXCLUDED.ifood_enabled,updated_at=now()`,
                [restaurantId,seal(next),/^[a-f0-9-]{36}$/i.test(next.ifood.merchantId) ? next.ifood.merchantId : null,next.ifood.enabled]);
        });
        return NextResponse.json({ ok: true });
    } catch (error) { return failure(error); }
}
function failure(error: unknown) {
    return NextResponse.json({ error: error instanceof RestaurantOwnerAuthError ? error.message : "Não foi possível carregar ou salvar a integração. Confira os dados e a liberação da conta." },
        { status: error instanceof RestaurantOwnerAuthError ? error.status : 503 });
}

