import { NextResponse } from "next/server";

import { query } from "@/lib/database/sql";
import { parseNeighborhoodDeliveryRules } from "@/lib/delivery/neighborhood";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    const url = new URL(request.url);
    const restaurantId = url.searchParams.get("restaurantId")?.trim();

    if (!restaurantId) {
        return NextResponse.json(
            { error: "Restaurant ID is required" },
            { status: 400 }
        );
    }

    const { rows } = await query<{
        delivery_fee_mode: string | null;
        delivery_neighborhood_fee_json: unknown;
    }>(
        `
        SELECT delivery_fee_mode, delivery_neighborhood_fee_json
        FROM public.restaurants
        WHERE id = $1
        LIMIT 1
        `,
        [restaurantId]
    );

    if (rows.length === 0) {
        return NextResponse.json(
            { error: "Restaurant not found" },
            { status: 404 }
        );
    }

    const row = rows[0];

    return NextResponse.json(
        {
            mode:
                row.delivery_fee_mode === "neighborhood"
                    ? "neighborhood"
                    : "radius",
            rules: parseNeighborhoodDeliveryRules(
                row.delivery_neighborhood_fee_json
            ),
        },
        {
            headers: {
                "Cache-Control": "no-store",
            },
        }
    );
}
