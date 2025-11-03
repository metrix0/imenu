// /app/api/menu/update-item/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.warn("Supabase service role key or url missing in env.");
}

// server-side supabase (service role)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
});

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const {
            itemId,
            name,
            description,
            price_cents,
            category_id,
            is_available,
            imageBase64, // optional dataURL for new image
            imageDeleted, // boolean: user requested deletion
            originalImagePath, // optional, for attempts to remove storage object
        } = body;

        if (!itemId) return NextResponse.json({ error: "itemId is required" }, { status: 400 });

        // 1) Update basic fields
        const { error: updateErr } = await supabase
            .from("items")
            .update({
                name: name ?? undefined,
                description: description ?? null,
                price_cents: price_cents ?? undefined,
                category_id: category_id ?? undefined,
                is_available: typeof is_available === "boolean" ? is_available : undefined,
            })
            .eq("id", itemId);

        if (updateErr) {
            console.error("Erro ao atualizar items:", updateErr);
            return NextResponse.json({ error: "Erro ao atualizar item" }, { status: 500 });
        }

        // 2) Handle media changes
        // Helper to delete storage object if path hints at storage key
        async function tryRemoveStorageObject(path: string | null) {
            if (!path) return;
            // case 1: you saved a storage key like "menu-images/...."
            if (path.startsWith("menu-images/")) {
                try {
                    const { error: remErr } = await supabase.storage.from("menu-images").remove([path]);
                    if (remErr) console.warn("Falha ao remover objeto do bucket (por chave):", remErr);
                } catch (e) {
                    console.warn("Erro ao tentar remover do storage:", e);
                }
                return;
            }
            // case 2: public url pattern pointing to storage object
            // ex: https://<project>.supabase.co/storage/v1/object/public/menu-images/<key>
            try {
                const m = path.match(/\/storage\/v1\/object\/public\/([^\/]+)\/(.+)$/);
                if (m) {
                    const bucket = m[1];
                    const key = decodeURIComponent(m[2]);
                    const { error: remErr } = await supabase.storage.from(bucket).remove([key]);
                    if (remErr) console.warn("Falha ao remover objeto do bucket (por URL):", remErr);
                }
            } catch (e) {
                // ignore
            }
        }

        if (imageBase64) {
            // Replace image: delete old item_media rows, insert new, update items.image_path
            const delRes = await supabase
                .from("item_media")
                .delete()
                .eq("item_id", itemId)
                .eq("media_type", "image");

            if (delRes.error) {
                console.warn("Aviso: falha ao deletar item_media antigo (continuando):", delRes.error);
            } else {
                // if there was an originalImagePath we try to remove from storage
                if (originalImagePath) {
                    await tryRemoveStorageObject(originalImagePath);
                }
            }

            const ins = await supabase
                .from("item_media")
                .insert([{ item_id: itemId, media_type: "image", url: imageBase64 }]);

            if (ins.error) {
                console.error("Erro ao inserir item_media:", ins.error);
                return NextResponse.json({ error: "Erro ao inserir mídia" }, { status: 500 });
            }

            const upd = await supabase
                .from("items")
                .update({ image_path: imageBase64 })
                .eq("id", itemId);

            if (upd.error) {
                console.error("Erro ao atualizar items.image_path:", upd.error);
                return NextResponse.json({ error: "Erro ao atualizar items.image_path" }, { status: 500 });
            }
        } else if (imageDeleted) {
            // delete item_media rows and clear items.image_path
            // first, read old rows so we can try to remove storage file if any
            const { data: existingMedia, error: selectErr } = await supabase
                .from("item_media")
                .select("id, url")
                .eq("item_id", itemId)
                .eq("media_type", "image");

            if (selectErr) {
                console.warn("Falha ao selecionar item_media (continuando):", selectErr);
            } else if (existingMedia && existingMedia.length > 0) {
                // try removing storage objects if urls look like storage keys
                for (const row of existingMedia) {
                    const url = row.url as string;
                    await tryRemoveStorageObject(url);
                }
            } else {
                // also try originalImagePath if provided:
                if (originalImagePath) await tryRemoveStorageObject(originalImagePath);
            }

            const delRes = await supabase
                .from("item_media")
                .delete()
                .eq("item_id", itemId)
                .eq("media_type", "image");

            if (delRes.error) {
                console.error("Erro ao deletar item_media:", delRes.error);
                return NextResponse.json({ error: "Erro ao deletar item_media" }, { status: 500 });
            }

            const upd = await supabase.from("items").update({ image_path: null }).eq("id", itemId);
            if (upd.error) {
                console.error("Erro ao limpar items.image_path:", upd.error);
                return NextResponse.json({ error: "Erro ao limpar items.image_path" }, { status: 500 });
            }
        }

        return NextResponse.json({ ok: true });
    } catch (err) {
        console.error("Erro no handler update-item:", err);
        return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
}
