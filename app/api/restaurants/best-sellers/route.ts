import { query } from "@/lib/database/sql";
import { createSupabaseServerClient } from "@/lib/database/supabaseServerClient";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const { rows } = await query(`
            SELECT
                r.id,
                r.name,
                r.url_slug,
                r.logo_url,
                SUM(o.total_cents)::bigint AS gmv_cents
            FROM public.restaurants r
            INNER JOIN public.orders o
                ON o.restaurant_id = r.id
            WHERE r.first_time = FALSE
              AND COALESCE(TRIM(r.name), '') <> ''
              AND COALESCE(TRIM(r.url_slug), '') <> ''
              AND LOWER(TRIM(r.name)) <> 'brc tecnologia'
              AND o.status IN ('paid', 'preparing', 'delivering', 'done')
              AND o.created_at >= NOW() - INTERVAL '7 days'
            GROUP BY r.id, r.name, r.url_slug, r.logo_url
            ORDER BY gmv_cents DESC, r.name ASC
            LIMIT 3
        `);

        const supabase = createSupabaseServerClient();
        const restaurants = rows.map((restaurant) => ({
            id: restaurant.id,
            name: restaurant.name,
            url_slug: restaurant.url_slug,
            gmv_cents: Number(restaurant.gmv_cents || 0),
            logo_url: restaurant.logo_url
                ? supabase.storage
                      .from("restaurant-logos")
                      .getPublicUrl(restaurant.logo_url).data.publicUrl
                : null,
        }));

        return NextResponse.json({ restaurants });
    } catch (error) {
        console.error("[BEST_SELLERS]", error);
        return NextResponse.json(
            { error: "Não foi possível carregar o ranking." },
            { status: 500 }
        );
    }
}
