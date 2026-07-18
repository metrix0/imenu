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

function parseIdArray(value: unknown): string[] {
    if (Array.isArray(value)) {
        return value
            .map((item) => String(item))
            .filter(Boolean);
    }

    if (typeof value === "string") {
        try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed)
                ? parsed
                      .map((item) => String(item))
                      .filter(Boolean)
                : [];
        } catch {
            return [];
        }
    }

    return [];
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

        const programQuery = `
            SELECT
                program.*,
                item.name AS reward_item_name,
                item.image_path AS reward_item_image_path
            FROM loyalty_programs program
            LEFT JOIN items item
              ON program.reward_item_id = item.id
            WHERE program.restaurant_id = $1
            LIMIT 1
        `;

        const [balanceResult, ordersResult, programResult] =
            await Promise.all([
                query(balanceQuery, [
                    restaurantId,
                    phoneCandidates,
                    cleanPhone,
                ]),
                query(ordersQuery, [
                    restaurantId,
                    phoneCandidates,
                ]),
                query(programQuery, [restaurantId]),
            ]);

        const program = programResult.rows[0] || null;

        if (!program) {
            return NextResponse.json(
                {
                    balance:
                        balanceResult.rows[0] || null,
                    orders: ordersResult.rows,
                    program: null,
                },
                { status: 200 }
            );
        }

        const rewardSubitemIds = parseIdArray(
            program.reward_subitem_ids
        );

        let expandedRewardSubitems: any[] = [];

        if (rewardSubitemIds.length > 0) {
            const subitemsResult = await query(
                `
                    SELECT
                        subitem.id AS subitem_id,
                        subitem.name AS subitem_name,
                        subcategory.id AS subcategory_id,
                        subcategory.name AS subcategory_name
                    FROM subitems subitem
                    JOIN item_subcategories subcategory
                      ON subitem.item_subcategory_id = subcategory.id
                    WHERE subitem.id::text = ANY($1::text[])
                      AND subcategory.item_id = $2
                    ORDER BY subcategory.position, subitem.position
                `,
                [
                    rewardSubitemIds,
                    program.reward_item_id,
                ]
            );

            expandedRewardSubitems =
                subitemsResult.rows;
        }

        const supabaseUrl =
            process.env.NEXT_PUBLIC_SUPABASE_URL;
        const rewardItemImage =
            program.reward_item_image_path &&
            supabaseUrl
                ? `${supabaseUrl}/storage/v1/object/public/menu-images/${program.reward_item_image_path}`
                : null;

        return NextResponse.json(
            {
                balance:
                    balanceResult.rows[0] || null,
                orders: ordersResult.rows,
                program: {
                    ...program,
                    reward_item_image:
                        rewardItemImage,
                    expanded_reward_subitems:
                        expandedRewardSubitems,
                },
            },
            { status: 200 }
        );
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
