import { loadLoyaltyOffer } from "@/lib/services/loyaltyOffer";
import { NextResponse } from "next/server";
import { query } from "@/lib/database/sql";

export const dynamic = "force-dynamic";

function normalizePhone(value: unknown): string {
    let digits = String(value ?? "").replace(/\D/g, "");

    if (
        digits.startsWith("55") &&
        (digits.length === 12 || digits.length === 13)
    ) {
        digits = digits.slice(2);
    }

    return digits;
}

export async function GET(request: Request) {
    const restaurantId = new URL(request.url).searchParams.get("restaurant_id")?.trim();
    if (!restaurantId) return NextResponse.json({ error: "Restaurante não identificado." }, { status: 400 });
    try {
        return NextResponse.json(await loadLoyaltyOffer(restaurantId));
    } catch (error) {
        console.error("[FIDELIDADE] Erro ao buscar programa:", error);
        return NextResponse.json({ error: "Não foi possível carregar a fidelidade." }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const restaurantId = String(
            body?.restaurant_id ?? ""
        ).trim();
        const cleanPhone = normalizePhone(body?.phone);

        if (!restaurantId) {
            return NextResponse.json(
                { error: "Restaurante não identificado." },
                { status: 400 }
            );
        }

        if (
            cleanPhone.length !== 10 &&
            cleanPhone.length !== 11
        ) {
            return NextResponse.json(
                { error: "Número de WhatsApp inválido." },
                { status: 400 }
            );
        }

        const phoneCandidates = [
            cleanPhone,
            `55${cleanPhone}`,
        ];

        const balanceQuery = `
            SELECT
                id,
                restaurant_id,
                customer_phone,
                current_count,
                total_lifetime_count,
                last_order_at
            FROM loyalty_balances
            WHERE restaurant_id = $1
              AND customer_phone = ANY($2::text[])
            ORDER BY
                CASE
                    WHEN customer_phone = $3 THEN 0
                    ELSE 1
                END,
                last_order_at DESC NULLS LAST
            LIMIT 1
        `;

        const ordersQuery = `
            SELECT
                id,
                display_id,
                status,
                total_cents,
                created_at,
                loyalty_credited,
                loyalty_points_used
            FROM orders
            WHERE restaurant_id = $1
              AND regexp_replace(
                    COALESCE(customer_phone, ''),
                    '[^0-9]',
                    '',
                    'g'
                  ) = ANY($2::text[])
            ORDER BY created_at DESC
            LIMIT 20
        `;

        const [balanceResult, ordersResult, program] = await Promise.all([
            query(balanceQuery, [restaurantId, phoneCandidates, cleanPhone]),
            query(ordersQuery, [restaurantId, phoneCandidates]),
            loadLoyaltyOffer(restaurantId),
        ]);

        return NextResponse.json({
            balance: balanceResult.rows[0] || null,
            orders: ordersResult.rows,
            program,
        });
    } catch (error) {
        console.error(
            "[FIDELIDADE] Erro ao buscar status:",
            error
        );

        return NextResponse.json(
            {
                error:
                    "Não foi possível carregar a fidelidade.",
            },
            { status: 500 }
        );
    }
}
