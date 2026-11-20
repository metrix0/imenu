import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/database/sql";

function parseIdArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];

    return Array.from(
        new Set(
            value
                .map((item) => String(item))
                .filter(Boolean)
        )
    );
}

export async function GET(request: NextRequest) {
    const restaurantId = new URL(
        request.url
    ).searchParams.get("restaurant_id");

    if (!restaurantId) {
        return NextResponse.json(
            { error: "Restaurant ID required" },
            { status: 400 }
        );
    }

    try {
        const result = await query(
            `
                SELECT id, restaurant_id, active, goal_count, min_order_value_cents, reward_item_id, reward_subitem_ids,
                       to_jsonb(loyalty_programs)->'additional_rewards' AS additional_rewards
                FROM loyalty_programs
                WHERE restaurant_id = $1
                LIMIT 1
            `,
            [restaurantId]
        );

        return NextResponse.json(
            result.rows[0] || null,
            { status: 200 }
        );
    } catch (error) {
        console.error(
            "[FIDELIDADE] Erro ao carregar configuração:",
            error
        );

        return NextResponse.json(
            {
                error:
                    "Não foi possível carregar a configuração.",
            },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        const restaurantId = String(
            body?.restaurant_id ?? ""
        ).trim();
        const active = body?.active === true;
        const requestedGoal = Number(body?.goal_count ?? 10);
        const goalCount = Number.isFinite(requestedGoal)
            ? Math.max(0, Math.min(100, Math.round(requestedGoal)))
            : 10;
        const minOrderValueCents = Math.max(
            0,
            Math.round(
                Number(body?.min_order_value_cents) || 0
            )
        );
        const rewardItemId = body?.reward_item_id
            ? String(body.reward_item_id)
            : null;
        const rewardSubitemIds = parseIdArray(
            body?.reward_subitem_ids
        );
        const requestedRewards: unknown = body?.additional_rewards;
        const additionalRewards = Array.isArray(requestedRewards)
            ? requestedRewards.map((reward: { item_id?: unknown; subitem_ids?: unknown } | null) => ({
                item_id: String(reward?.item_id ?? ""),
                subitem_ids: parseIdArray(reward?.subitem_ids),
            }))
            : null;
        const rewards = [
            ...(rewardItemId ? [{ item_id: rewardItemId, subitem_ids: rewardSubitemIds }] : []),
            ...(additionalRewards ?? []),
        ];
        if (new Set(rewards.map(reward => reward.item_id)).size !== rewards.length) {
            return NextResponse.json({ error: "Selecione itens de recompensa diferentes." }, { status: 400 });
        }

        if (!restaurantId) {
            return NextResponse.json(
                { error: "Restaurant ID required" },
                { status: 400 }
            );
        }

        for (const { item_id: rewardItemId, subitem_ids: rewardSubitemIds } of rewards) {
            const itemResult = await query(
                `
                    SELECT id
                    FROM items
                    WHERE id::text = $1
                      AND restaurant_id = $2
                    LIMIT 1
                `,
                [rewardItemId, restaurantId]
            );

            if (itemResult.rows.length === 0) {
                return NextResponse.json(
                    {
                        error:
                            "O item selecionado não pertence a este restaurante.",
                    },
                    { status: 400 }
                );
            }

            if (rewardSubitemIds.length > 0) {
                const validSubitemsResult = await query(
                    `
                        SELECT subitem.id::text AS id
                        FROM subitems subitem
                        JOIN item_subcategories subcategory
                          ON subitem.item_subcategory_id = subcategory.id
                        WHERE subcategory.item_id = $1
                          AND subitem.id::text = ANY($2::text[])
                    `,
                    [
                        rewardItemId,
                        rewardSubitemIds,
                    ]
                );

                const validIds = new Set(
                    validSubitemsResult.rows.map(
                        (row: any) => row.id
                    )
                );

                const hasInvalidSubitem =
                    rewardSubitemIds.some(
                        (id) => !validIds.has(id)
                    );

                if (hasInvalidSubitem) {
                    return NextResponse.json(
                        {
                            error:
                                "Um dos complementos selecionados não pertence ao item da recompensa.",
                        },
                        { status: 400 }
                    );
                }
            }
        }

        const result = await query(
            `
                INSERT INTO loyalty_programs (
                    restaurant_id,
                    goal_count,
                    active,
                    min_order_value_cents,
                    reward_item_id,
                    reward_subitem_ids,
                    additional_rewards,
                    updated_at
                )
                VALUES (
                    $1,
                    $2,
                    $3,
                    $4,
                    $5,
                    $6::jsonb,
                    COALESCE($7::jsonb, '[]'::jsonb),
                    NOW()
                )
                ON CONFLICT (restaurant_id)
                DO UPDATE SET
                    goal_count = EXCLUDED.goal_count,
                    active = EXCLUDED.active,
                    min_order_value_cents = EXCLUDED.min_order_value_cents,
                    reward_item_id = EXCLUDED.reward_item_id,
                    reward_subitem_ids = EXCLUDED.reward_subitem_ids,
                    additional_rewards = COALESCE($7::jsonb, loyalty_programs.additional_rewards),
                    updated_at = NOW()
                RETURNING id, restaurant_id, active, goal_count, min_order_value_cents,
                          reward_item_id, reward_subitem_ids, additional_rewards
            `,
            [
                restaurantId,
                goalCount,
                active,
                minOrderValueCents,
                rewardItemId,
                JSON.stringify(rewardSubitemIds),
                additionalRewards === null ? null : JSON.stringify(additionalRewards),
            ]
        );

        return NextResponse.json(
            result.rows[0],
            { status: 200 }
        );
    } catch (error) {
        console.error(
            "[FIDELIDADE] Erro ao salvar configuração:",
            error
        );

        return NextResponse.json(
            {
                error:
                    "Não foi possível salvar a configuração.",
            },
            { status: 500 }
        );
    }
}
