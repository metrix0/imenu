"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Loader from "@/components/ui/Loader";
import MenuOverview from "@/components/restaurante/configuracoes/MenuOverview";

// Tipos locais para o fetch
type Category = { id: string; name: string };
type Item = { id: string; name: string; category?: Category | null };

export default function PainelCardapioPage() {
    const [isLoading, setIsLoading] = useState(true);
    const [restaurantId, setRestaurantId] = useState<string | null>(null);
    
    // Dados do Menu
    const [menuId, setMenuId] = useState<string | null>(null);
    const [categories, setCategories] = useState<Category[]>([]);
    const [items, setItems] = useState<Item[]>([]);

    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            
            // 1. Sessão
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) return;

            // 2. Restaurante
            const { data: restaurant } = await supabase
                .from("restaurants")
                .select("id")
                .eq("user_id", session.user.id)
                .single();

            if (!restaurant) {
                setIsLoading(false);
                return;
            }
            setRestaurantId(restaurant.id);

            // 3. Menu (Pega o primeiro menu ativo)
            const { data: menu } = await supabase
                .from("menu")
                .select("id")
                .eq("restaurant_id", restaurant.id)
                .limit(1)
                .maybeSingle();

            if (menu) {
                setMenuId(menu.id);

                // 4. Categorias
                const { data: catsData } = await supabase
                    .from("categories")
                    .select("id, name, position")
                    .eq("restaurant_id", restaurant.id)
                    .order("position", { ascending: true });
                
                setCategories(catsData || []);

                // 5. Itens (via tabela de junção menu_items se existir, ou direto se seu schema for simplificado.
                // Assumindo relação direta items -> category -> restaurant por simplicidade,
                // ou items -> menu_items -> menu.
                // VOU USAR A LOGICA DA API QUE VOCÊ ME PASSOU ANTES (creation-data) como base:
                
                // Buscar IDs dos itens no menu
                const { data: menuItemsRel } = await supabase
                    .from("menu_items")
                    .select("item_id")
                    .eq("menu_id", menu.id);

                const itemIds = (menuItemsRel || []).map((r: any) => r.item_id);

                if (itemIds.length > 0) {
                    const { data: itemsData } = await supabase
                        .from("items")
                        .select("id, name, category:categories(id, name)")
                        .in("id", itemIds)
                        .order("position", { ascending: true });
                    
                    // Normalizar categoria (Supabase retorna array ou objeto dependendo da relação)
                    const normalizedItems = (itemsData || []).map((it: any) => ({
                        ...it,
                        category: Array.isArray(it.category) ? it.category[0] : it.category
                    }));
                    
                    setItems(normalizedItems);
                } else {
                    setItems([]);
                }
            }

            setIsLoading(false);
        };

        loadData();
    }, []);

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-64">
                <Loader />
                <p className="text-gray-500 mt-4">Carregando seu cardápio...</p>
            </div>
        );
    }

    if (!restaurantId) {
        return <div className="p-8 text-red-500">Restaurante não encontrado.</div>;
    }

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold text-gray-900">Gestão de Cardápio</h1>
                <p className="text-gray-500">Organize seus itens, categorias e preços.</p>
            </div>

            <MenuOverview 
                menuId={menuId} 
                categories={categories} 
                items={items} 
            />
        </div>
    );
}