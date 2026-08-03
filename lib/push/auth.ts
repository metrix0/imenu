import { NextRequest } from "next/server";

import { createSupabaseServerClient } from "@/lib/database/supabaseServerClient";

function getBearerToken(request: NextRequest): string | null {
    const authorization = request.headers.get("authorization") || "";
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    return match?.[1]?.trim() || null;
}

export async function requireOwnedRestaurant(
    request: NextRequest,
    restaurantId: string
): Promise<{ userId: string; restaurantId: string }> {
    const token = getBearerToken(request);
    if (!token) {
        throw new Response("Unauthorized", { status: 401 });
    }

    const supabase = createSupabaseServerClient();
    const {
        data: { user },
        error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
        throw new Response("Unauthorized", { status: 401 });
    }

    const { data: restaurant, error } = await supabase
        .from("restaurants")
        .select("id")
        .eq("id", restaurantId)
        .eq("user_id", user.id)
        .maybeSingle();

    if (error) throw error;
    if (!restaurant) {
        throw new Response("Restaurant not found", { status: 404 });
    }

    return {
        userId: user.id,
        restaurantId: String(restaurant.id),
    };
}
