import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/database/supabaseServerClient";

export async function POST(req: Request) {
    const supabase = createSupabaseServerClient();
    const { item_id } = await req.json();

    if (!item_id) {
        return NextResponse.json({ error: "item_id required" }, { status: 400 });
    }

    const { error } = await supabase
        .from("promotions")
        .update({ active: false })
        .eq("item_id", item_id);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
}
