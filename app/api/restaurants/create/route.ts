import { readAffiliateCookie } from "@/lib/analytics/affiliateCode";
import { rememberAffiliateReferral } from "@/lib/analytics/affiliateAttribution";
import { readSignupOrigin } from "@/lib/analytics/signupOrigin";
import { getAuthenticatedUser } from "@/lib/auth/restaurantOwner";
import { query } from "@/lib/database/sql";
import { DEFAULT_DELIVERY_RANGES } from "@/lib/delivery/defaultRanges";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export async function POST(request: Request) {
    try {
        const { userId, phone } = await request.json();
        if (!userId) return NextResponse.json({ error: "User ID is required." }, { status: 400 });
        const existing = await query("SELECT id FROM public.restaurants WHERE user_id = $1 LIMIT 1", [userId]);
        if (existing.rows[0]) return NextResponse.json({ id: existing.rows[0].id });
        const referral = readAffiliateCookie(request);
        const host = (request.headers.get("host") ?? "").split(":")[0].toLowerCase();
        const origin = readSignupOrigin(request, host);
        const signupUser = (referral || origin) && request.headers.has("authorization")
            ? await getAuthenticatedUser(request).catch(() => null)
            : null;
        const result = await query(
            `INSERT INTO public.restaurants (
                user_id, phone, rating, min_order_cents, balance_cents,
                delivery_fee_json, availability_json, prep_time_min_minutes, prep_time_max_minutes,
                prep_time_source, created_at, updated_at, first_time, creation_step, pickup_enabled
            ) VALUES ($1, $2, 5.0, 1500, 0, $3::jsonb, '{}'::jsonb, 40, 50, 'manual', NOW(), NOW(), TRUE, 1, TRUE)
            RETURNING id`,
            [userId, phone, JSON.stringify(DEFAULT_DELIVERY_RANGES)]
        );
        const id = result.rows[0]?.id;
        if (!id) throw new Error("Falha ao criar restaurante.");
        await query("INSERT INTO public.menu (restaurant_id, name, is_active, created_at, updated_at) VALUES ($1, 'Cardápio Principal', TRUE, NOW(), NOW())", [id]);
        if (signupUser?.id === userId) {
            if (referral) await rememberAffiliateReferral(request, userId);
            if (origin) {
                await query(
                    `UPDATE auth.users
                     SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('signup_origin', $2::jsonb)
                     WHERE id = $1 AND NOT (COALESCE(raw_app_meta_data, '{}'::jsonb) ? 'signup_origin')`,
                    [userId, JSON.stringify(origin)]
                ).catch(error => console.warn("[SIGNUP_ORIGIN] Could not store origin:", error instanceof Error ? error.name : "unknown"));
            }
        }
        return NextResponse.json({ id });
    } catch (error) { console.error("[CREATE_RESTAURANT]", error); return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 }); }
}
