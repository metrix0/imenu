import { createClient } from "@supabase/supabase-js";
import EditSubitemClient from "./edit-subitem-client";

type Props = {
    params: Promise<{ id: string; itemId: string; subcatId: string; subitemId: string }>;
};

export default async function Page({ params }: Props) {
    const { id: menuId, itemId, subcatId, subitemId } = await params;

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: subitem, error } = await supabase
        .from("subitems")
        .select("id, item_subcategory_id, name, description, price_cents, is_available, position")
        .eq("id", subitemId)
        .maybeSingle();

    if (error) {
        console.error(error);
        return <div>Erro ao buscar subitem</div>;
    }
    if (!subitem) return <div>Subitem não encontrado</div>;

    return <EditSubitemClient menuId={menuId} itemId={itemId} subcatId={subcatId} subitem={subitem} />;
}
