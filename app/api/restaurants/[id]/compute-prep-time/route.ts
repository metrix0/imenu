// app/api/restaurants/[id]/compute-prep-time/route.ts
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

    try {
        const { data, error } = await supabase.rpc("compute_and_update_prep_time", {
            restaurant_uuid: restaurantId,
        });

        if (error) {
            console.error("RPC compute_and_update_prep_time error:", error);
            return NextResponse.json({ ok: false, error }, { status: 500 });
        }

        return NextResponse.json({ ok: true, data });
    } catch (err) {
        console.error("Unexpected error computing prep time:", err);
        return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
    }
}
