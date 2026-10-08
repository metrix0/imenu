// app/api/menu/delete-item/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export async function POST(req: Request) {
    const { itemId } = await req.json();
    if (!itemId) return NextResponse.json({ error: "itemId required" }, { status: 400 });

    try {
        // Buscar image_path
        const { data: item, error: fetchErr } = await supabaseAdmin
            .from("items")
            .select("image_path")
            .eq("id", itemId)
            .single();

        if (fetchErr) return NextResponse.json({ error: "Erro ao buscar item", detail: fetchErr }, { status: 500 });

        // Chamar RPC que limpa DB
        const { data: rpcData, error: rpcErr } = await supabaseAdmin
            .rpc("delete_item_completely", { p_item_id: itemId });

        if (rpcErr) return NextResponse.json({ error: "Erro ao deletar item no DB", detail: rpcErr }, { status: 500 });

        // Preserve files still shared by other menu items.
        if (item?.image_path) {
            const { count, error: refsErr } = await supabaseAdmin
                .from("items")
                .select("id", { count: "exact", head: true })
                .eq("image_path", item.image_path);

            if (refsErr) {
                console.error("Erro ao verificar imagem compartilhada:", refsErr);
            } else if (count === 0) {
                const { error: removeErr } = await supabaseAdmin.storage
                    .from("menu-images")
                    .remove([item.image_path]);
                if (removeErr) console.error("Erro ao remover imagem:", removeErr);
            }
        }

        return NextResponse.json({ ok: true, rpcData });
    } catch (err) {
        console.error("Erro inesperado:", err);
        return NextResponse.json({ error: "unexpected", detail: String(err) }, { status: 500 });
    }
}
