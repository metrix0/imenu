import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/database/supabaseServerClient";

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const restaurantId = searchParams.get("restaurantId");

    if (!restaurantId) {
        return NextResponse.json({ error: "restaurantId required" }, { status: 400 });
    }

    const supabase = createSupabaseServerClient();
    const now = new Date().toISOString();

    const { data, error } = await supabase
        .from("promotions")
        .select("item_id, type, value, starts_at, ends_at")
        .eq("restaurant_id", restaurantId)
        .eq("active", true)
        .lte("starts_at", now)
        .gte("ends_at", now);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data ?? []);
}
