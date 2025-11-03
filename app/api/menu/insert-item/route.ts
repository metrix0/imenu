// /app/api/menu/insert-item/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.warn("Supabase URL or service role key missing in env.");
}

// server-side supabase (service role)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
});

export async function POST(req: Request) {
    try {
        const body = await req.json();

        const {
            menuId,
            restaurantId,
            categoryId,
            name,
            description,
            price_cents,
            is_available,
            imageBase64, // optional data URL string
        } = body ?? {};

        if (!menuId || !restaurantId || !categoryId || !name || typeof price_cents !== "number") {
            return NextResponse.json({ error: "menuId, restaurantId, categoryId, name and price_cents are required" }, { status: 400 });
        }

        // 1) Insert into items
        const { data: itemData, error: itemErr } = await supabase
            .from("items")
            .insert([
                {
                    restaurant_id: restaurantId,
                    category_id: categoryId,
                    name: name.trim(),
                    description: description?.trim() || null,
                    price_cents,
                    is_available: !!is_available,
                    image_path: imageBase64 ?? null,
                    position: 0,
                },
            ])
            .select("id")
            .single();

        if (itemErr || !itemData) {
            console.error("Erro ao inserir item:", itemErr);
            return NextResponse.json({ error: "Erro ao inserir item" }, { status: 500 });
        }

        const newItemId = itemData.id;

        // 2) Associate item to menu (menu_items)
        const { error: menuItemErr } = await supabase
            .from("menu_items")
            .insert([{ menu_id: menuId, item_id: newItemId, position: 0 }]);

        if (menuItemErr) {
            console.error("Erro ao inserir menu_items:", menuItemErr);
            // try to rollback item insertion? (optional)
            return NextResponse.json({ error: "Erro ao associar item ao menu" }, { status: 500 });
        }

        // 3) If have imageBase64, insert into item_media
        if (imageBase64) {
            const { error: mediaErr } = await supabase
                .from("item_media")
                .insert([{ item_id: newItemId, media_type: "image", url: imageBase64 }]);

            if (mediaErr) {
                console.warn("Falha ao inserir item_media:", mediaErr);
                // non-fatal: item created and associated, return success but warn client
                return NextResponse.json({ ok: true, itemId: newItemId, warning: "Falha ao salvar item_media" });
            }
        }

        return NextResponse.json({ ok: true, itemId: newItemId });
    } catch (err) {
        console.error("Erro no route insert-item:", err);
        return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
}
