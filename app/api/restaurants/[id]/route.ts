import { NextResponse } from "next/server";

import { query } from "@/lib/database/sql";
import { parseNeighborhoodDeliveryRules } from "@/lib/delivery/neighborhood";
import { GET as baseGET, PATCH as basePATCH } from "./routeBase";

export { baseGET as GET };

export async function PATCH(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    let body: Record<string, unknown>;
    try {
        body = await request.clone().json();
    } catch {
        return basePATCH(request, context);
    }

    const hasMode = Object.prototype.hasOwnProperty.call(
        body,
        "delivery_fee_mode"
    );
    const hasNeighborhoodRules = Object.prototype.hasOwnProperty.call(
        body,
        "delivery_neighborhood_fee_json"
    );

    if (!hasMode && !hasNeighborhoodRules) {
        return basePATCH(request, context);
    }

    const baseBody = Object.fromEntries(
        Object.entries(body).filter(
            ([key]) =>
                key !== "delivery_fee_mode" &&
                key !== "delivery_neighborhood_fee_json"
        )
    );

    if (Object.keys(baseBody).length > 0) {
        const baseRequest = new Request(request.url, {
            method: "PATCH",
            headers: new Headers(request.headers),
            body: JSON.stringify(baseBody),
        });
        const baseResponse = await basePATCH(baseRequest, context);
        if (!baseResponse.ok) return baseResponse;
    }

    const { id } = await context.params;
    if (!id) {
        return NextResponse.json(
            { error: "Restaurant ID is required" },
            { status: 400 }
        );
    }

    const values: unknown[] = [id];
    const fields: string[] = [];

    if (hasMode) {
        const mode = String(body.delivery_fee_mode || "");
        if (mode !== "radius" && mode !== "neighborhood") {
            return NextResponse.json(
                { error: "Modo de entrega inválido." },
                { status: 400 }
            );
        }
        values.push(mode);
        fields.push(`delivery_fee_mode = $${values.length}`);
    }

    if (hasNeighborhoodRules) {
        const rules = parseNeighborhoodDeliveryRules(
            body.delivery_neighborhood_fee_json
        );
        values.push(JSON.stringify(rules));
        fields.push(
            `delivery_neighborhood_fee_json = $${values.length}::jsonb`
        );
    }

    if (fields.length === 0) {
        return NextResponse.json(
            { error: "No valid fields provided to update" },
            { status: 400 }
        );
    }

    const result = await query(
        `
        UPDATE public.restaurants
        SET ${fields.join(", ")}, updated_at = NOW()
        WHERE id = $1
        RETURNING id, delivery_fee_mode
        `,
        values
    );

    if (result.rows.length === 0) {
        return NextResponse.json(
            { error: "Restaurant not found" },
            { status: 404 }
        );
    }

    return NextResponse.json({
        success: true,
        updatedId: result.rows[0].id,
        delivery_fee_mode: result.rows[0].delivery_fee_mode,
    });
}
