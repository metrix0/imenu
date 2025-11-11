// app/api/restaurants/[id]/set-prep-time/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
    const { id } = await context.params;
    const restaurantId = id;

    const body = await req.json();
    const source = body.source ?? null;

    if (!restaurantId) {
        return NextResponse.json({ error: "restaurantId is required." }, { status: 400 });
    }

    // Verifica se o restaurante existe
    const { data: restaurant, error: restaurantError } = await supabase
        .from("restaurants")
        .select("id")
        .eq("id", restaurantId)
        .single();

    if (restaurantError || !restaurant) {
        return NextResponse.json({ error: "Restaurante não encontrado." }, { status: 404 });
    }

    try {
        if (source === "manual") {
            const min = Number(body.min ?? NaN);
            const max = Number(body.max ?? NaN);
            if (isNaN(min) || isNaN(max)) {
                return NextResponse.json({ error: "min and max are required for manual source." }, { status: 400 });
            }

            // Atualiza prep_time_* para manual
            const { data: updated, error: updateError } = await supabase
                .from("restaurants")
                .update({
                    prep_time_min_minutes: min,
                    prep_time_max_minutes: max,
                    prep_time_source: "manual",
                    prep_time_computed_at: new Date().toISOString(),
                })
                .select("id, prep_time_min_minutes, prep_time_max_minutes, prep_time_source, prep_time_computed_at")
                .eq("id", restaurantId)
                .single();

            if (updateError) {
                console.error("Erro ao salvar tempos (manual):", updateError);
                return NextResponse.json({ error: updateError.message }, { status: 500 });
            }

            return NextResponse.json({ success: true, restaurant: updated });
        } else if (source === "auto") {
            // Marcar como auto e limpar valores manuais
            const { data: updated, error: updateError } = await supabase
                .from("restaurants")
                .update({
                    prep_time_min_minutes: null,
                    prep_time_max_minutes: null,
                    prep_time_source: "auto",
                    prep_time_computed_at: null,
                })
                .select("id, prep_time_min_minutes, prep_time_max_minutes, prep_time_source, prep_time_computed_at")
                .eq("id", restaurantId)
                .single();

            if (updateError) {
                console.error("Erro ao salvar modo auto:", updateError);
                return NextResponse.json({ error: updateError.message }, { status: 500 });
            }

            return NextResponse.json({ success: true, restaurant: updated });
        } else {
            return NextResponse.json({ error: "Invalid source. Allowed: 'manual' or 'auto'." }, { status: 400 });
        }
    } catch (err: any) {
        console.error("Unexpected error in set-prep-time:", err);
        return NextResponse.json({ error: String(err?.message ?? err) }, { status: 500 });
    }
}
