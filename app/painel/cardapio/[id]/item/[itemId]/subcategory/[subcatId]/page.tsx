import { createClient } from "@supabase/supabase-js";
import EditSubcategoryClient from "./edit-subcategory-client";

type Props = {
    params: Promise<{ restauranteId: string; id: string; itemId: string; subcatId: string }>;
};

export default async function Page({ params }: Props) {
    const { restauranteId, id: menuId, itemId, subcatId } = await params;

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: subcat, error: scErr } = await supabase
        .from("item_subcategories")
        .select("id, item_id, name, description, min_select, max_select, position")
        .eq("id", subcatId)
        .maybeSingle();

    if (scErr) {
        console.error(scErr);
        return <div>Erro ao buscar subcategoria</div>;
    }
    if (!subcat) return <div>Subcategoria não encontrada</div>;

    const { data: subitemsRaw, error: subsErr } = await supabase
        .from("subitems")
        .select("id, item_subcategory_id, name, description, price_cents, is_available, position")
        .eq("item_subcategory_id", subcatId)
        .order("position", { ascending: true });

    if (subsErr) {
        console.error(subsErr);
    }

    return <EditSubcategoryClient restauranteId={restauranteId} menuId={menuId} itemId={itemId} subcategory={subcat} subitems={subitemsRaw ?? []} />;
}
