import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/database/supabaseServerClient";

export const runtime = "nodejs";

export async function PATCH(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    const { id } = await context.params;

    if (!id) {
        return NextResponse.json({ error: "Item ID is required" }, { status: 400 });
    }

    const supabase = createSupabaseServerClient();

    const { data: item } = await supabase
        .from("items")
        .select("id, is_available")
        .eq("id", id)
        .maybeSingle();

    if (!item) {
        return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    const newState = !item.is_available;

    const { data: updatedItem } = await supabase
        .from("items")
        .update({ is_available: newState })
        .eq("id", id)
        .select("*")
        .maybeSingle();

    return NextResponse.json({ item: updatedItem });
}
