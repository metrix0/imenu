import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/database/supabaseServerClient";

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const restaurantId = searchParams.get("restaurantId");

    if (!restaurantId) {
        return NextResponse.json({ error: "restaurantId required" }, { status: 400 });
    }

    const supabase = createSupabaseServerClient();

    const { data, error } = await supabase
        .from("categories")
        .select(`
      id,
      name,
      position,
      items (
        id,
        name,
        price_cents,
        position,
        is_available
      )
    `)
        .eq("restaurant_id", restaurantId)
        .order("position", { ascending: true })
        .order("position", { referencedTable: "items", ascending: true });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data ?? []);
}
