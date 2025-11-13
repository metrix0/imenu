// app/menu/[id]/item/[itemId]/add-subcategory/page.tsx
import AddSubcategoryClient from "./add-subcategoty-client";
import { createClient } from "@supabase/supabase-js";

type Props = {
    params: Promise<{ restauranteId: string; id: string; itemId: string }>;
};

export default async function Page({ params }: Props) {
    const resolved = await params;
    const { restauranteId, id: menuId, itemId } = resolved;

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    if (!itemId) {
        console.error("Parâmetro itemId ausente nos params.");
        return <div>Item inválido: parâmetro itemId ausente.</div>;
    }

    let item: { id: string; name?: string } | null = null;
    try {
        const { data, error } = await supabase
            .from("items")
            .select("id, name")
            .eq("id", itemId)
            .single();

        if (!error && data) item = data;
    } catch (err) {
        console.error("Erro ao buscar item no servidor:", err);
    }

    return <AddSubcategoryClient restauranteId={restauranteId} menuId={menuId} item={item} />;
}
