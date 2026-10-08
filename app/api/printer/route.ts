import { NextResponse } from "next/server";

import { requireRestaurantOwner, RestaurantOwnerAuthError } from "@/lib/auth/restaurantOwner";
import { query } from "@/lib/database/sql";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_ATTEMPTS = 3;

type PrinterRequest = {
    action?: string;
    restaurant_id?: string;
    job_id?: string;
    order_id?: string;
    attempt?: number;
    status?: string;
    last_error?: string | null;
    limit?: number;
};

function uuid(value: unknown): string {
    if (typeof value !== "string" || !UUID.test(value)) {
        throw new RestaurantOwnerAuthError("Identificador inválido.", 400);
    }
    return value;
}

function attempt(value: unknown): number {
    if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > MAX_ATTEMPTS) {
        throw new RestaurantOwnerAuthError("Tentativa inválida.", 400);
    }
    return value;
}

function errorMessage(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    return String(value).slice(0, 1000);
}

export async function POST(request: Request) {
    try {
        const body = (await request.json()) as PrinterRequest;
        const restaurantId = uuid(body.restaurant_id);
        await requireRestaurantOwner(request, restaurantId);

        const ok = (data: object) => NextResponse.json(data, {
            headers: { "Cache-Control": "no-store" },
        });

        switch (body.action) {
            case "next_job": {
                const result = await query(
                    `SELECT * FROM public.print_jobs
                     WHERE restaurant_id = $1 AND status = 'queued'
                     ORDER BY created_at ASC LIMIT 1`,
                    [restaurantId]
                );
                return ok({ job: result.rows[0] ?? null });
            }
            case "claim_job": {
                const id = uuid(body.job_id);
                const count = attempt(body.attempt);
                const result = await query(
                    `UPDATE public.print_jobs
                     SET status = 'printing', attempts = $3, last_error = NULL
                     WHERE restaurant_id = $1 AND id = $2 AND status = 'queued'
                     RETURNING id`,
                    [restaurantId, id, count]
                );
                return ok({ claimed: result.rows.length > 0 });
            }
            case "queued_failure": {
                const id = uuid(body.job_id);
                const count = attempt(body.attempt);
                if (body.status !== "queued" && body.status !== "failed") {
                    throw new RestaurantOwnerAuthError("Status inválido.", 400);
                }
                await query(
                    `UPDATE public.print_jobs
                     SET attempts = $3, status = $4, last_error = $5
                     WHERE restaurant_id = $1 AND id = $2 AND status = 'queued'`,
                    [restaurantId, id, count, body.status, errorMessage(body.last_error)]
                );
                return ok({ ok: true });
            }
            case "update_job": {
                const id = uuid(body.job_id);
                if (!["printed", "queued", "failed"].includes(body.status || "")) {
                    throw new RestaurantOwnerAuthError("Status inválido.", 400);
                }
                await query(
                    `UPDATE public.print_jobs
                     SET status = $3,
                         last_error = $4,
                         printed_at = CASE WHEN $3 = 'printed' THEN NOW() ELSE printed_at END
                     WHERE restaurant_id = $1 AND id = $2
                       AND (
                         (status = 'printing' AND $3 IN ('printed', 'queued', 'failed'))
                         OR (status = 'queued' AND $3 = 'failed')
                       )`,
                    [restaurantId, id, body.status, errorMessage(body.last_error)]
                );
                return ok({ ok: true });
            }
            case "recover": {
                const result = await query(
                    `UPDATE public.print_jobs
                     SET status = 'failed',
                         last_error = 'Impressão interrompida antes de ser concluída.'
                     WHERE restaurant_id = $1 AND status = 'printing'
                     RETURNING id`,
                    [restaurantId]
                );
                return ok({ recovered: result.rows.length });
            }
            case "history": {
                const limit = Math.min(30, Math.max(1, Number(body.limit) || 15));
                const result = await query(
                    `SELECT p.order_id, p.status, p.created_at, p.printed_at,
                            o.display_id, o.customer_name
                     FROM public.print_jobs p
                     LEFT JOIN public.orders o ON o.id = p.order_id AND o.restaurant_id = p.restaurant_id
                     WHERE p.restaurant_id = $1
                       AND p.status IN ('queued', 'printing', 'printed', 'failed')
                     ORDER BY p.created_at DESC
                     LIMIT $2`,
                    [restaurantId, limit * 3]
                );
                const seen = new Set<string>();
                const history: object[] = [];
                for (const row of result.rows) {
                    if (!row.order_id || seen.has(row.order_id)) continue;
                    seen.add(row.order_id);
                    history.push({
                        order_id: row.order_id,
                        display_id: row.display_id,
                        customer_name: row.customer_name || "",
                        status: row.status,
                        status_at: row.printed_at || row.created_at || null,
                    });
                    if (history.length >= limit) break;
                }
                return ok({ history });
            }
            case "reprint_check": {
                const orderId = uuid(body.order_id);
                const matching = await query(
                    `SELECT id FROM public.print_jobs
                     WHERE restaurant_id = $1 AND order_id = $2 AND status = 'printed'
                     LIMIT 1`,
                    [restaurantId, orderId]
                );
                if (!matching.rows.length) {
                    throw new RestaurantOwnerAuthError("Pedido não encontrado no histórico deste restaurante.", 400);
                }
                const active = await query(
                    `SELECT id FROM public.print_jobs
                     WHERE restaurant_id = $1 AND status IN ('queued', 'printing')
                     LIMIT 1`,
                    [restaurantId]
                );
                if (active.rows.length) {
                    throw new RestaurantOwnerAuthError("Aguarde os pedidos pendentes terminarem de imprimir.", 409);
                }
                const order = await query(
                    `SELECT display_id FROM public.orders
                     WHERE id = $1 AND restaurant_id = $2 LIMIT 1`,
                    [orderId, restaurantId]
                );
                return ok({ display_id: order.rows[0]?.display_id ?? null });
            }
            case "receipt": {
                const orderId = uuid(body.order_id);
                const orderResult = await query(
                    `SELECT id, display_id, created_at, scheduled_for, customer_name,
                            customer_phone, customer_address, payment_method, is_delivery,
                            table_name_snapshot, subtotal_cents, delivery_cents,
                            coupon_discount_cents, total_cents
                     FROM public.orders WHERE id = $1 AND restaurant_id = $2 LIMIT 1`,
                    [orderId, restaurantId]
                );
                const order = orderResult.rows[0];
                if (!order) {
                    throw new RestaurantOwnerAuthError("Pedido não encontrado.", 404);
                }
                const [itemsResult, subitemsResult] = await Promise.all([
                    query(
                        `SELECT id, name, quantity, observation, price_cents, total_cents
                         FROM public.order_items WHERE order_id = $1`,
                        [orderId]
                    ),
                    query(
                        `SELECT s.order_item_id, s.name, s.quantity, s.price_cents
                         FROM public.order_item_subitems s
                         JOIN public.order_items i ON i.id = s.order_item_id
                         WHERE i.order_id = $1`,
                        [orderId]
                    ),
                ]);
                return ok({
                    order,
                    items: itemsResult.rows,
                    subitems: subitemsResult.rows,
                });
            }
            default:
                throw new RestaurantOwnerAuthError("Operação inválida.", 400);
        }
    } catch (error) {
        const status = error instanceof RestaurantOwnerAuthError ? error.status : 500;
        if (status === 500) console.error("Printer API:", error);
        return NextResponse.json(
            { error: status === 500 ? "Falha interna ao processar impressão." : (error as Error).message },
            { status, headers: { "Cache-Control": "no-store" } }
        );
    }
}
