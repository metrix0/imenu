// app/menu/[id]/add-item/page.tsx
import { createClient } from "@supabase/supabase-js";
import AddItemForm from "./add-item-form";

type Props = {
    params: Promise<{ id: string }>;
};

export default async function AddItemPage({ params }: Props) {
    const { id: menuId } = await params;

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // buscar menu
    const { data: menu, error: menuError } = await supabase
        .from("menu")
        .select("id, name, restaurant_id")
        .eq("id", menuId)
        .maybeSingle();

    if (menuError) {
        console.error(menuError);
        return <div>Erro ao buscar o menu.</div>;
    }
    if (!menu) {
        return <div>Menu não encontrado.</div>;
    }

    // buscar categorias do restaurante (para popular select)
    const { data: categories, error: catError } = await supabase
        .from("categories")
        .select("id, name")
        .eq("restaurant_id", menu.restaurant_id)
        .order("position", { ascending: true });

    if (catError) {
        console.error(catError);
        // mesmo com erro, passamos array vazio para o client
    }

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold mb-4">Adicionar item ao cardápio: {menu.name}</h1>
            <AddItemForm
                menuId={menuId}
                restaurantId={menu.restaurant_id}
                categories={categories ?? []}
            />
        </div>
    );
}
