import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/database/supabaseServerClient";

export async function DELETE(
    _: Request,
    { params }: { params: { itemId: string } }
) {
    const supabase = createSupabaseServerClient();
    const { itemId } = params;

    if (!itemId) {
        return NextResponse.json({ error: "itemId required" }, { status: 400 });
    }

    const { error } = await supabase
        .from("promotions")
        .update({ active: false })
        .eq("item_id", itemId);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
