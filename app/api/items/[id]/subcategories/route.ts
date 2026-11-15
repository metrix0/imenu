import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/database/supabaseServerClient";
import { getAuthenticatedUser, RestaurantOwnerAuthError } from "@/lib/auth/restaurantOwner";
import { withTransaction } from "@/lib/database/sql";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getAuthenticatedUser(req);
    const { id } = await params;
    const body: unknown = await req.json().catch(() => null);
    const groupIds: unknown = body && typeof body === "object" && "groupIds" in body ? body.groupIds : null;

    if (!uuid.test(id) || !Array.isArray(groupIds) || groupIds.length < 2 ||
        groupIds.some(groupId => typeof groupId !== "string" || !uuid.test(groupId)) ||
        new Set(groupIds).size !== groupIds.length) {
      return NextResponse.json({ error: "Ordem dos grupos inválida." }, { status: 400 });
    }

    await withTransaction(async db => {
      const item = await db.query(
        `SELECT item.id
         FROM public.items item
         JOIN public.restaurants restaurant ON restaurant.id = item.restaurant_id
         WHERE item.id = $1 AND restaurant.user_id = $2
         FOR UPDATE OF item`,
        [id, user.id],
      );
      if (!item.rowCount) throw new RestaurantOwnerAuthError("Acesso negado.", 403);

      const current = await db.query<{ id: string }>(
        "SELECT id FROM public.item_subcategories WHERE item_id = $1 FOR UPDATE",
        [id],
      );
      const requested = new Set(groupIds);
      if (current.rows.length !== requested.size || current.rows.some(group => !requested.has(group.id))) {
        throw new RestaurantOwnerAuthError("Os grupos mudaram. Feche e reabra os complementos.", 409);
      }

      await db.query(
        `UPDATE public.item_subcategories AS groups
         SET position = ordered.ordinality - 1
         FROM unnest($2::uuid[]) WITH ORDINALITY AS ordered(id, ordinality)
         WHERE groups.item_id = $1 AND groups.id = ordered.id
           AND groups.position <> ordered.ordinality - 1`,
        [id, groupIds],
      );
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof RestaurantOwnerAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Erro ao salvar a ordem dos complementos:", error);
    return NextResponse.json({ error: "Não foi possível salvar a ordem dos grupos." }, { status: 500 });
  }
}

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
        max_per_option,
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
