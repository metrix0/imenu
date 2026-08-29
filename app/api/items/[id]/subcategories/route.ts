import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/database/supabaseServerClient";

const getPosition = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
};

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;

    const supabase = createSupabaseServerClient();

    const { data, error } = await supabase
      .from("item_subcategories")
      .select(
        `
        id,
        name,
        description,
        min_select,
        max_select,
        allow_multiple_units,
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
      `,
      )
      .eq("item_id", id);

    if (error) {
      console.error("DB ERROR:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const orderedData = (data ?? [])
      .map((subcategory) => ({
        ...subcategory,
        subitems: [...(subcategory.subitems ?? [])]
          .filter((subitem) => subitem.is_available === true)
          .sort(
            (a, b) => getPosition(a.position) - getPosition(b.position),
          ),
      }))
      .sort((a, b) => getPosition(a.position) - getPosition(b.position));

    return NextResponse.json(orderedData, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (err: any) {
    console.error("ROUTE CRASH:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
