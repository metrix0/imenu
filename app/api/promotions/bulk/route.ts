import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/database/supabaseServerClient";

export async function POST(req: Request) {
    const supabase = createSupabaseServerClient();
    const body = await req.json();

    const {
        restaurantId,
        itemIds,
        type,
        value,
        startsAt,
        endsAt,
    } = body;

    if (
        !restaurantId ||
        !Array.isArray(itemIds) ||
        itemIds.length === 0 ||
        !type
    ) {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    /* 1️⃣ Disable existing promos for those items */
    const { error: disableError } = await supabase
        .from("promotions")
        .update({ active: false })
        .eq("restaurant_id", restaurantId)
        .in("item_id", itemIds);

    if (disableError) {
        return NextResponse.json({ error: disableError.message }, { status: 500 });
    }

    /* 2️⃣ Insert new promos */
    const inserts = itemIds.map((itemId: string) => ({
        restaurant_id: restaurantId,
        item_id: itemId,
        type,
        value,
        starts_at: startsAt ?? new Date().toISOString(),
        ends_at: endsAt ?? "3000-01-01",
        active: true,
    }));

    const { error: insertError } = await supabase
        .from("promotions")
        .insert(inserts);

    if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
