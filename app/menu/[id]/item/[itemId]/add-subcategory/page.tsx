// app/menu/[id]/item/[itemId]/add-subcategory/page.tsx
import AddSubcategoryClient from "./add-subcategoty-client";
import { createClient } from "@supabase/supabase-js";

type Props = {
    params: Promise<{ id: string; itemId: string }>;
};

export default async function Page({ params }: Props) {
    // Aguarda params (Next passa como Promise em Server Components)
    const resolved = await params;
    const { id: menuId, itemId } = resolved;

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // checagem defensiva: se não veio itemId nos params, retorna mensagem clara
    if (!itemId) {
        console.error("Parâmetro itemId ausente nos params.");
        return <div>Item inválido: parâmetro itemId ausente.</div>;
    }

    // Buscar dados básicos do item só para exibir título / validação
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

    // Passa menuId e item para o componente cliente como props
    return <AddSubcategoryClient menuId={menuId} item={item} />;
}
