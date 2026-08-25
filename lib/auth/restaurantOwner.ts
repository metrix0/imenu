import type { User } from "@supabase/supabase-js";

import { createSupabaseServerClient } from "@/lib/database/supabaseServerClient";
import { query } from "@/lib/database/sql";

export class RestaurantOwnerAuthError extends Error {
    status: number;

    constructor(message: string, status: number) {
        super(message);
        this.name = "RestaurantOwnerAuthError";
        this.status = status;
    }
}

function getBearerToken(request: Request): string {
    const authorization = request.headers.get("authorization")?.trim() || "";
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    const token = match?.[1]?.trim();

    if (!token) {
        throw new RestaurantOwnerAuthError("Não autenticado.", 401);
    }

    return token;
}

export async function getAuthenticatedUser(request: Request): Promise<User> {
    const token = getBearerToken(request);
    const supabase = createSupabaseServerClient();
    const {
        data: { user },
        error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
        throw new RestaurantOwnerAuthError(
            "Sessão inválida ou expirada.",
            401
        );
    }

    return user;
}

export async function requireRestaurantOwner(
    request: Request,
    restaurantId: string
): Promise<{
    user: User;
    restaurant: {
        id: string;
        name: string | null;
        url_slug: string | null;
        phone: string | null;
    };
}> {
    const user = await getAuthenticatedUser(request);
    const result = await query<{
        id: string;
        name: string | null;
        url_slug: string | null;
        phone: string | null;
    }>(
        `
            SELECT id, name, url_slug, phone
            FROM public.restaurants
            WHERE id = $1
              AND user_id = $2
            LIMIT 1
        `,
        [restaurantId, user.id]
    );

    const restaurant = result.rows[0];
    if (!restaurant) {
        throw new RestaurantOwnerAuthError("Acesso negado.", 403);
    }

    return { user, restaurant };
}
