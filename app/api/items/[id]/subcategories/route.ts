import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/database/supabaseServerClient";

export async function GET(
    req: Request,
    context: { params: Promise<{ id: string }> }
) {
    try {
        // FIX HERE: unwrap params
        const { id } = await context.params;

        const supabase = createSupabaseServerClient();

        const { data, error } = await supabase
            .from("item_subcategories")
            .select(`
        id,
        name,
        description,
        min_select,
        max_select,
        position,
        subitems:subitems (
          id,
          item_subcategory_id,
          name,
          description,
          price_cents,
          is_available,
          position
        )
      `)
            .eq("item_id", id);

        if (error) {
            console.error("DB ERROR:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json(data ?? []);
    } catch (err: any) {
        console.error("ROUTE CRASH:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
