import { NextRequest, NextResponse } from "next/server";
import { requireRestaurantOwner, RestaurantOwnerAuthError } from "@/lib/auth/restaurantOwner";
import { query } from "@/lib/database/sql";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    try {
        const restaurantId = request.nextUrl.searchParams.get("restaurantId") || "";
        await requireRestaurantOwner(request, restaurantId);
        const page = Math.max(1, Math.min(10000, Math.floor(Number(request.nextUrl.searchParams.get("page")) || 1)));
        const [customers, count] = await Promise.all([
            query(
                `SELECT b.id, b.customer_phone, c.name, b.current_count, b.total_lifetime_count, b.last_order_at
                 FROM loyalty_balances b
                 LEFT JOIN customers c ON c.restaurant_id = b.restaurant_id AND c.phone = public.crm_phone(b.customer_phone)
                 WHERE b.restaurant_id = $1
                 ORDER BY b.current_count DESC NULLS LAST, b.last_order_at DESC NULLS LAST, b.id
                 LIMIT 25 OFFSET $2`,
                [restaurantId, (page - 1) * 25],
            ),
            query<{ total: number }>(
                "SELECT count(*)::int AS total FROM loyalty_balances WHERE restaurant_id = $1",
                [restaurantId],
            ),
        ]);
        return NextResponse.json(
            { customers: customers.rows, total: count.rows[0]?.total ?? 0 },
            { headers: { "Cache-Control": "no-store" } },
        );
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof RestaurantOwnerAuthError ? error.message : "Não foi possível carregar os clientes do programa." },
            { status: error instanceof RestaurantOwnerAuthError ? error.status : 500 },
        );
    }
}
