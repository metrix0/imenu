// app/cardapio/[id]/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useCart } from "@/lib/cartStore";

type Restaurant = {

    id: string;
    name: string;
};

type Menu = {
    id: string;
    restaurant_id: string;
};

type Category = {
    id: string;
    name: string;

    position: number;
};
type Item = {

    id: string;
    name: string;
    description: string | null;

    price_cents: number;
    is_available: boolean;
    category: Category | null;

};


type CategoryWithItems = Category & {

    items: Item[];
};

export default function PublicMenuPage() {

    const params = useParams();
    const router = useRouter();
    

    const slug = Array.isArray(params.id) ? params.id[0] : params.id;

    const [restaurant, setRestaurant] = useState<Restaurant | null>(null);

    const [menu, setMenu] = useState<CategoryWithItems[]>([]);
    const [uncategorizedItems, setUncategorizedItems] = useState<Item[]>([]);
    const [loading, setLoading] = useState(true);

    const [error, setError] = useState<string | null>(null);


    const { add: addItemToCart, items: cartItems } = useCart();

    useEffect(() => {

        if (!slug) return;

        const fetchMenuData = async () => {

            setLoading(true);
            setError(null);

            try {

                // 1. Find restaurant by slug
                const { data: restaurantData, error: restaurantError } = await supabase
                    .from("restaurants")

                    .select("id, name")
                    .eq("url_slug", slug)
                    .single();

                if (restaurantError || !restaurantData) throw new Error("Restaurante não encontrado.");

                setRestaurant(restaurantData);

                // 2. Find active Menu

                const { data: menuData, error: menuError } = await supabase
                    .from("menu")
                    .select("id, restaurant_id")

                    .eq("restaurant_id", restaurantData.id)
                    .eq("is_active", true) 
                    .single();
                
                if (menuError || !menuData) throw new Error("Cardápio não encontrado para este restaurante.");

                // 3. Search Categories

                const { data: categoriesData, error: catErr } = await supabase
                    .from("categories")
                    .select("id, name, position")

                    .eq("restaurant_id", restaurantData.id)
                    .order("position", { ascending: true });

                if (catErr) throw new Error("Erro ao buscar categorias.");

                const categories = categoriesData || [];

                // 4. Seach item_id

                const { data: miRows, error: miErr } = await supabase
                    .from("menu_items")
                    .select("item_id")

                    .eq("menu_id", menuData.id);

                if (miErr) throw new Error("Erro ao buscar itens do menu.");

                const itemIds = (miRows || []).map((r: any) => r.item_id);
                if (itemIds.length === 0) {
                    setLoading(false);

                    return; // Empty menu
                }

                // 5. Find details about items

                const { data: itemsRaw, error: itemsErr } = await supabase
                    .from("items")
                    .select(`

                        id, name, description, price_cents, is_available, position,
                        category:categories(id, name)
                    `)

                    .in("id", itemIds)
                    .eq("is_available", true) 
                    .order("position", { ascending: true });
                
                if (itemsErr) throw new Error("Erro ao buscar detalhes dos itens.");

                // 6. Normalize and organize items

                const normalizedItems: Item[] = (itemsRaw || []).map((it: any) => {
                    const cat = it.category;
                    const normalizedCategory = Array.isArray(cat) ? (cat.length > 0 ? cat[0] : null) : cat ?? null;

                    return { ...it, category: normalizedCategory };
                });

                // 7. Group items by category

                const itemsByCategory: Record<string, Item[]> = {};
                const uncategorized: Item[] = [];

                for (const item of normalizedItems) {

                    const catId = item.category?.id;
                    if (catId) {
                        if (!itemsByCategory[catId]) itemsByCategory[catId] = [];

                        itemsByCategory[catId].push(item);
                    } else {
                        uncategorized.push(item);

                    }
                }

                const finalMenu: CategoryWithItems[] = categories

                    .map(cat => ({
                        ...cat,
                        items: itemsByCategory[cat.id] || []

                    }))
                    .filter(cat => cat.items.length > 0);

                setMenu(finalMenu);

                setUncategorizedItems(uncategorized);

            } catch (err: any) {
                setError(err.message);

            } finally {
                setLoading(false);
            }

        };

        fetchMenuData();
    }, [slug]);

    // Helper for price format

    const formatPrice = (priceInCents: number) => {
        return (priceInCents / 100).toLocaleString("pt-BR", {
            style: "currency",

            currency: "BRL",
        });
    };

    if (loading) {

        return <div className="flex min-h-screen items-center justify-center">Carregando cardápio...</div>;
    }

    if (error) {

        return <div className="flex min-h-screen items-center justify-center text-red-600">{error}</div>;
    }

    const totalItemsInCart = cartItems.reduce((acc, item) => acc + item.qty, 0);

    return (

        <div className="min-h-screen bg-gray-50 pb-24"> 
            <div className="mx-auto max-w-2xl p-4">
                <header className="my-6 text-center">
                    <h1 className="text-4xl font-bold">{restaurant?.name}</h1>

                </header>

                <main className="space-y-8">
                    {menu.map((category) => (

                        <section key={category.id}>
                            <h2 className="mb-4 text-2xl font-semibold">{category.name}</h2>
                            <div className="space-y-4">
                                {category.items.map((item) => (

                                    <div key={item.id} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                                        <h3 className="text-xl font-semibold">{item.name}</h3>
                                        {item.description && (
                                            <p className="mt-1 text-sm text-gray-600">{item.description}</p>

                                        )}
                                        <div className="mt-4 flex items-center justify-between">
                                            <span className="text-lg font-medium text-gray-800">
                                                {formatPrice(item.price_cents)}

                                            </span>
                                            <button
                                                onClick={() => addItemToCart({

                                                    itemId: item.id,
                                                    name: item.name,
                                                    price_cents: item.price_cents
                                                })}
                                                className="rounded-md bg-black px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2"

                                            >
                                                Adicionar
                                            </button>

                                        </div>
                                    </div>
                                ))}
                            </div>

                        </section>
                    ))}

                    {uncategorizedItems.length > 0 && (

                        <section>
                            <h2 className="mb-4 text-2xl font-semibold">Outros</h2>
                            <div className="space-y-4">
                                {uncategorizedItems.map((item) => (

                                    <div key={item.id} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                                        <h3 className="text-xl font-semibold">{item.name}</h3>
                                        {item.description && (
                                            <p className="mt-1 text-sm text-gray-600">{item.description}</p>

                                        )}
                                        <div className="mt-4 flex items-center justify-between">
                                            <span className="text-lg font-medium text-gray-800">
                                                {formatPrice(item.price_cents)}

                                            </span>
                                            <button
                                                onClick={() => addItemToCart({

                                                    itemId: item.id,
                                                    name: item.name,
                                                    price_cents: item.price_cents
                                                })}
                                                className="rounded-md bg-black px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2"

                                            >
                                                Adicionar
                                            </button>

                                        </div>
                                    </div>
                                ))}
                            </div>

                        </section>
                    )}
                </main>
            </div>

            {/* Button */}

            {totalItemsInCart > 0 && (
                <footer className="fixed bottom-0 left-0 w-full border-t border-gray-200 bg-white p-4 shadow-top">
                    <div className="mx-auto max-w-2xl">
                        <button

                            onClick={() => router.push(`/carrinho/${slug}`)} 
                            className="w-full rounded-md bg-indigo-600 px-6 py-3 text-lg font-medium text-white shadow-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                        >

                            Ver Carrinho ({totalItemsInCart} {totalItemsInCart > 1 ? 'itens' : 'item'})
                        </button>
                    </div>

                </footer>
            )}
        </div>
    );
}