// app/menu/[id]/item/[itemId]/page.tsx
import { createClient } from "@supabase/supabase-js";
import EditItemForm from "./edit-item-form";

type Props = {
    params: Promise<{ id: string; itemId: string }>;
};

export default async function Page({ params }: Props) {
    const { id: menuId, itemId } = await params;

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // busca menu
    const { data: menu, error: menuError } = await supabase
        .from("menu")
        .select("id, name, restaurant_id")
        .eq("id", menuId)
        .maybeSingle();

    if (menuError) {
        console.error(menuError);
        return <div>Erro ao buscar menu</div>;
    }
    if (!menu) return <div>Menu não encontrado</div>;

    // buscar item
    const { data: itemRow, error: itemErr } = await supabase
        .from("items")
        .select(
            `
      id,
      name,
      description,
      price_cents,
      image_path,
      is_available,
      position,
      category_id
    `
        )
        .eq("id", itemId)
        .maybeSingle();

    if (itemErr) {
        console.error(itemErr);
        return <div>Erro ao buscar item</div>;
    }
    if (!itemRow) return <div>Item não encontrado</div>;

    // buscar categorias do restaurante (para popular select)
    const { data: categories, error: catErr } = await supabase
        .from("categories")
        .select("id, name")
        .eq("restaurant_id", menu.restaurant_id)
        .order("position", { ascending: true });

    if (catErr) {
        console.error(catErr);
        // continua com array vazio
    }

    // transformar item para shape esperado pelo client
    const item = {
        id: itemRow.id,
        name: itemRow.name,
        description: itemRow.description,
        price_cents: itemRow.price_cents,
        image_path: itemRow.image_path,
        is_available: itemRow.is_available,
        position: itemRow.position,
        category_id: itemRow.category_id,
    };

    // após buscar categorias, queremos também buscar subcategorias do item
    const { data: subcatsRaw, error: subcatsErr } = await supabase
        .from("item_subcategories")
        .select("id, name, description, min_select, max_select, position")
        .eq("item_id", itemId)
        .order("position", { ascending: true });

    if (subcatsErr) {
        console.error("Erro ao buscar subcategorias:", subcatsErr);
    }
    const subcats = subcatsRaw ?? [];

    // buscar subitens pertencentes às subcategorias (se existirem)
    const subcatIds = (subcats || []).map((s: any) => s.id);
    let subitems: any[] = [];
    if (subcatIds.length > 0) {
        const { data: subsRaw, error: subsErr } = await supabase
            .from("subitems")
            .select("id, item_subcategory_id, name, description, price_cents, is_available, position")
            .in("item_subcategory_id", subcatIds)
            .order("position", { ascending: true });

        if (subsErr) {
            console.error("Erro ao buscar subitens:", subsErr);
        } else {
            subitems = subsRaw ?? [];
        }
    }

    // anexar subitems às subcats
    const subcategories = (subcats || []).map((s: any) => ({
        ...s,
        subitems: subitems.filter(si => si.item_subcategory_id === s.id) ?? [],
    }));

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold mb-4">Editar item</h1>
            <EditItemForm
                menuId={menuId}
                restaurantId={menu.restaurant_id}
                item={item}
                categories={categories ?? []}
                subcategories={subcategories}
            />
        </div>
    );
}
