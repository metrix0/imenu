// app/api/menu/delete-category/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.warn("Supabase URL or service role key missing in env.");
}

// Admin client (service role) — necessary to delete related rows and call RPC
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export async function POST(req: Request) {
    try {
        const { categoryId } = await req.json();
        if (!categoryId) return NextResponse.json({ error: "categoryId required" }, { status: 400 });

        // 1) get all item ids for this category
        const { data: items, error: itemsErr } = await supabaseAdmin
            .from("items")
            .select("id")
            .eq("category_id", categoryId);

        if (itemsErr) {
            console.error("Failed to fetch items for category:", itemsErr);
            return NextResponse.json({ error: "Failed to fetch items", detail: itemsErr }, { status: 500 });
        }

        const itemIds: string[] = (items || []).map((r: any) => r.id);

        // If there are items, try to delete each via the RPC that already handles order_items safely
        if (itemIds.length > 0) {
            // Try RPC approach first (preferred). If RPC not available or errors, fallback below.
            let rpcFailed = false;
            let rpcErrors: any[] = [];

            for (const itemId of itemIds) {
                try {
                    const { data: rpcData, error: rpcErr } = await supabaseAdmin
                        .rpc("delete_item_completely", { p_item_id: itemId });

                    if (rpcErr) {
                        rpcFailed = true;
                        rpcErrors.push({ itemId, rpcErr });
                        // stop trying RPCs to go fallback route
                        break;
                    }
                    // rpcData could be used for debugging if needed
                } catch (err) {
                    rpcFailed = true;
                    rpcErrors.push({ itemId, err });
                    break;
                }
            }

            if (rpcFailed) {
                console.warn("RPC delete_item_completely failed for some items — falling back to safe manual deletion", rpcErrors);

                // Fallback: preserve order_items (nullify item_id) then delete media/menu_items/items
                // 1) nullify references in order_items (preserve the row data except item_id)
                const { error: orderUpdateErr } = await supabaseAdmin
                    .from("order_items")
                    .update({ item_id: null })
                    .in("item_id", itemIds);

                if (orderUpdateErr) {
                    console.error("Failed to nullify order_items.item_id:", orderUpdateErr);
                    return NextResponse.json({ error: "Failed to nullify order_items", detail: orderUpdateErr }, { status: 500 });
                }

                // 2) delete item_media
                const { error: mediaDelErr } = await supabaseAdmin
                    .from("item_media")
                    .delete()
                    .in("item_id", itemIds);

                if (mediaDelErr) {
                    console.error("Failed to delete item_media (fallback):", mediaDelErr);
                    return NextResponse.json({ error: "Failed to delete item_media", detail: mediaDelErr }, { status: 500 });
                }

                // 3) delete menu_items entries
                const { error: menuItemsDelErr } = await supabaseAdmin
                    .from("menu_items")
                    .delete()
                    .in("item_id", itemIds);

                if (menuItemsDelErr) {
                    console.error("Failed to delete menu_items entries (fallback):", menuItemsDelErr);
                    return NextResponse.json({ error: "Failed to delete menu_items entries", detail: menuItemsDelErr }, { status: 500 });
                }

                // 4) delete items themselves
                const { error: itemsDelErr } = await supabaseAdmin
                    .from("items")
                    .delete()
                    .in("id", itemIds);

                if (itemsDelErr) {
                    console.error("Failed to delete items (fallback):", itemsDelErr);
                    return NextResponse.json({ error: "Failed to delete items", detail: itemsDelErr }, { status: 500 });
                }
            }
            // else RPC succeeded for all items => nothing else to do for items
        }

        // 2) finally delete category
        const { error: catDelErr } = await supabaseAdmin
            .from("categories")
            .delete()
            .eq("id", categoryId);

        if (catDelErr) {
            console.error("Failed to delete category:", catDelErr);
            return NextResponse.json({ error: "Failed to delete category", detail: catDelErr }, { status: 500 });
        }

        return NextResponse.json({ ok: true, deleted_items: itemIds.length });
    } catch (err) {
        console.error("delete-category route error:", err);
        return NextResponse.json({ error: "Internal server error", detail: String(err) }, { status: 500 });
    }
}
