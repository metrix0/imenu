import { after, NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { withTransaction } from "@/lib/database/sql";
import { normalizeBlastPhone } from "@/lib/services/supportBlast";
import { processRestaurantWhatsappSessionDeletions } from "@/lib/services/whatsappSessionDeletion";

export const revalidate = 0;

const UUID_PATTERN = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

type Restaurant = {
    id: string;
    logo_url: string | null;
    phone: string | null;
    store_whatsapp: string | null;
};

export async function POST(req: NextRequest) {
    try {
        const token = req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
        if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const body = await req.json().catch(() => null);
        const allOwned = body?.allOwned === true;
        const restaurantId: unknown = body?.restaurantId;
        if (allOwned ? restaurantId !== undefined : typeof restaurantId !== "string" || !UUID_PATTERN.test(restaurantId)) {
            return NextResponse.json({ error: "Invalid restaurant selection" }, { status: 400 });
        }

        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } },
        );
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const result = await withTransaction(async (client) => {
            const { rows: restaurants } = await client.query<Restaurant>(
                `SELECT id, logo_url, phone, store_whatsapp
                 FROM public.restaurants
                 WHERE user_id = $1 AND ($2::uuid IS NULL OR id = $2)
                 ORDER BY id
                 FOR UPDATE`,
                [user.id, allOwned ? null : restaurantId],
            );

            if (!restaurants.length) return { status: "missing" } as const;
            const ids = restaurants.map(({ id }) => id);

            const { rowCount: payoutCount } = await client.query(
                "SELECT 1 FROM public.payouts WHERE restaurant_id = ANY($1::uuid[]) LIMIT 1",
                [ids],
            );
            if (payoutCount) return { status: "payouts" } as const;

            const phones = [...new Set(
                [user.user_metadata?.phone, ...restaurants.flatMap(({ phone, store_whatsapp }) => [phone, store_whatsapp])]
                    .map((phone) => normalizeBlastPhone(String(phone || "")))
                    .filter((phone): phone is string => Boolean(phone)),
            )];
            if (phones.length) {
                await client.query(
                    `UPDATE public.support_blast_recipients
                     SET status = 'cancelled', error = 'Conta excluída.'
                     WHERE phone = ANY($1::text[]) AND status IN ('pending', 'processing')`,
                    [phones],
                );
            }

            const { rowCount: whatsappJobs } = await client.query(
                `INSERT INTO public.restaurant_whatsapp_session_deletions (session_name)
                 SELECT session_name
                 FROM public.whatsapp_connections
                 WHERE restaurant_id = ANY($1::uuid[]) AND session_name IS NOT NULL AND session_name <> ''
                 ON CONFLICT (session_name) DO NOTHING`,
                [ids],
            );

            await client.query("DELETE FROM public.print_jobs WHERE restaurant_id = ANY($1::uuid[])", [ids]);
            await client.query("DELETE FROM public.orders WHERE restaurant_id = ANY($1::uuid[])", [ids]);
            await client.query(
                `DELETE FROM public.item_media AS media
                 USING public.items AS item
                 WHERE media.item_id = item.id AND item.restaurant_id = ANY($1::uuid[])`,
                [ids],
            );

            const { rows: banners } = await client.query<{ banner_url: string | null }>(
                "DELETE FROM public.menu WHERE restaurant_id = ANY($1::uuid[]) RETURNING banner_url",
                [ids],
            );
            await client.query("DELETE FROM public.integrations WHERE restaurant_id = ANY($1::uuid[])", [ids]);
            // The remaining restaurant-owned rows are removed by their foreign-key cascades.
            await client.query("DELETE FROM public.restaurants WHERE id = ANY($1::uuid[])", [ids]);

            return {
                status: "deleted",
                whatsappJobs,
                logos: restaurants.map(({ logo_url }) => logo_url),
                banners: banners.map(({ banner_url }) => banner_url),
            } as const;
        });

        if (result.status === "payouts") {
            return NextResponse.json({ error: "restaurant_has_payouts" }, { status: 409 });
        }

        if (result.status === "deleted") {
            if (result.whatsappJobs) after(processRestaurantWhatsappSessionDeletions);

            after(async () => {
                for (const [bucket, references] of [
                    ["menu-banners", result.banners],
                    ["restaurant-logos", result.logos],
                ] as const) {
                    const paths = references.filter((path): path is string => Boolean(path));
                    if (!paths.length) continue;
                    try {
                        const { error } = await supabaseAdmin.storage.from(bucket).remove(paths);
                        if (error) throw error;
                    } catch (error) {
                        console.warn("[RESTAURANT_DELETION] Storage cleanup failed:", bucket, error);
                    }
                }
            });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[RESTAURANT_DELETION]", error);
        const pgError = error as { code?: string; constraint?: string } | null;
        if (pgError?.code === "23503") {
            return NextResponse.json({
                error: pgError.constraint === "payouts_restaurant_id_fkey"
                    ? "restaurant_has_payouts"
                    : "restaurant_has_linked_records",
            }, { status: 409 });
        }
        return NextResponse.json({ error: "restaurant_deletion_failed" }, { status: 500 });
    }
}
