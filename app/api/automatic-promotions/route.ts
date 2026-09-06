import { NextResponse } from "next/server";
import {
  requireRestaurantOwner,
  RestaurantOwnerAuthError,
} from "@/lib/auth/restaurantOwner";
import { query, withTransaction } from "@/lib/database/sql";
import {
  isUuid,
  parseAutomaticPromotions,
  validateAutomaticPromotion,
  type AutomaticPromotion,
} from "@/lib/promotions/automatic";

export const dynamic = "force-dynamic";

function failure(error: unknown) {
  if (error instanceof RestaurantOwnerAuthError)
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  console.error("[AUTOMATIC_PROMOTIONS]", error);
  return NextResponse.json(
    { error: "Não foi possível salvar as promoções. Tente novamente." },
    { status: 500 },
  );
}

export async function GET(request: Request) {
  const restaurantId = new URL(request.url).searchParams.get("restaurantId");
  if (!isUuid(restaurantId))
    return NextResponse.json(
      { error: "Restaurante inválido." },
      { status: 400 },
    );
  try {
    await requireRestaurantOwner(request, restaurantId);
    const result = await query(
      "SELECT automatic_promotions FROM restaurants WHERE id = $1",
      [restaurantId],
    );
    return NextResponse.json({
      promotions: parseAutomaticPromotions(
        result.rows[0]?.automatic_promotions,
      ),
    });
  } catch (error) {
    return failure(error);
  }
}

export async function PUT(request: Request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }
  if (!isUuid(body?.restaurantId))
    return NextResponse.json(
      { error: "Restaurante inválido." },
      { status: 400 },
    );
  const validation = validateAutomaticPromotion(body.promotion);
  if (validation)
    return NextResponse.json({ error: validation }, { status: 400 });
  try {
    await requireRestaurantOwner(request, body.restaurantId);
    const source = body.promotion as AutomaticPromotion;
    const promotion: AutomaticPromotion = {
      id: source.id,
      name: source.name.trim(),
      active: source.active,
      show_on_menu: source.show_on_menu,
      delivery: source.delivery,
      mesa: source.mesa,
      allow_coupon: source.allow_coupon,
      rules: source.rules,
      benefits: source.benefits,
    };
    const ids = [
      ...new Set(
        [...promotion.rules, ...promotion.benefits].flatMap((r) =>
          r.type === "product" ? [r.item_id] : [],
        ),
      ),
    ];
    if (ids.length) {
      const products = await query(
        "SELECT id FROM items WHERE restaurant_id = $1 AND id = ANY($2::uuid[])",
        [body.restaurantId, ids],
      );
      if (products.rows.length !== ids.length)
        return NextResponse.json(
          { error: "Um produto foi removido ou não pertence ao restaurante." },
          { status: 400 },
        );
    }
    const promotions = await withTransaction(async (client) => {
      const result = await client.query(
        "SELECT automatic_promotions FROM restaurants WHERE id = $1 FOR UPDATE",
        [body.restaurantId],
      );
      const current = parseAutomaticPromotions(
        result.rows[0]?.automatic_promotions,
      );
      const index = current.findIndex((p) => p.id === promotion.id);
      if (index >= 0) current[index] = promotion;
      else current.push(promotion);
      if (current.length > 100)
        throw new RestaurantOwnerAuthError(
          "Limite de 100 promoções por restaurante.",
          400,
        );
      await client.query(
        "UPDATE restaurants SET automatic_promotions = $2::jsonb WHERE id = $1",
        [body.restaurantId, JSON.stringify(current)],
      );
      return current;
    });
    return NextResponse.json({ promotions });
  } catch (error) {
    return failure(error);
  }
}

export async function DELETE(request: Request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }
  if (!isUuid(body?.restaurantId) || !isUuid(body?.id))
    return NextResponse.json({ error: "Promoção inválida." }, { status: 400 });
  try {
    await requireRestaurantOwner(request, body.restaurantId);
    const result = await query(
      `UPDATE restaurants SET automatic_promotions = COALESCE(
            (SELECT jsonb_agg(p) FROM jsonb_array_elements(automatic_promotions) p WHERE p->>'id' <> $2), '[]'::jsonb)
            WHERE id = $1 RETURNING automatic_promotions`,
      [body.restaurantId, body.id],
    );
    return NextResponse.json({
      promotions: parseAutomaticPromotions(
        result.rows[0]?.automatic_promotions,
      ),
    });
  } catch (error) {
    return failure(error);
  }
}
