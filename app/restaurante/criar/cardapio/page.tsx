// app/restaurante/criar/cardapio/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCreationStore } from "@/lib/creationStore"; 
import CreationStepper from "@/components/restaurante/configuracoes/CreationStepper";
import Link from "next/link";

type Category = { id: string; name: string };
type Item = { id: string; name: string; category?: Category | null };
type Restaurant = { id: string; name: string; logo_url: string | null };
type ItemsByCategory = Record<string, Item[]>;
const UNCATEGORIZED_KEY = "_uncategorized";

export default function CriarCardapioPage() {
    const router = useRouter();
    const { restaurantId } = useCreationStore();
    const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
    const [menuId, setMenuId] = useState<string | null>(null);
    const [itemsByCategory, setItemsByCategory] = useState<ItemsByCategory>({});
    const [logoUrl, setLogoUrl] = useState<string | null>(null);

    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!restaurantId) {
            console.warn("ID do restaurante não encontrado no store. Redirecionando.");
            router.replace("/restaurante");
            return;
        }

        async function fetchData() {
            setIsLoading(true);
            try {
                const response = await fetch(`/api/restaurants/${restaurantId}/creation-data`);
                
                if (!response.ok) {
                    const err = await response.json();
                    throw new Error(err.error || "Falha ao buscar dados.");
                }
                
                const data = await response.json();
                
                setRestaurant(data.restaurant);
                setLogoUrl(data.restaurant.logo_url);
                setMenuId(data.menuId);

                const categories: Category[] = data.categories || [];
                const items: Item[] = data.items || [];
                
                const groupedItems = categories.reduce<Record<string, Item[]>>((acc, cat) => {
                    acc[cat.id] = [];
                    return acc;
                }, {});
                groupedItems[UNCATEGORIZED_KEY] = [];

                items.forEach((it) => {
                    const catId = it.category?.id ?? null;
                    if (catId && groupedItems[catId]) {
                        groupedItems[catId].push(it);
                    } else {
                        groupedItems[UNCATEGORIZED_KEY].push(it);
                    }
                });
                
                setItemsByCategory(groupedItems);
                
            } catch (err) {
                setError((err as Error).message);
            } finally {
                setIsLoading(false);
            }
        }

        fetchData();
    }, [restaurantId, router]);


    if (isLoading) {
        return (
            <main className="min-h-screen flex flex-col items-center justify-start p-6 bg-white">
                <div className="w-full max-w-3xl mt-12">
                    <CreationStepper currentStep={4} />
                    <div className="w-full max-w-2xl mx-auto text-center">
                        <p>Carregando cardápio...</p>
                    </div>
                </div>
            </main>
        );
    }
    
    if (error || !restaurant || !menuId) {
        return (
             <main className="min-h-screen flex flex-col items-center justify-start p-6 bg-white">
                 <div className="w-full max-w-3xl mt-12">
                     <CreationStepper currentStep={4} />
                     <div className="w-full max-w-2xl mx-auto text-center">
                         <p className="text-red-500">{error || "Não foi possível carregar o restaurante."}</p>
                         <Link href="/restaurante/criar/disponibilidade" className="text-indigo-600">
                             &larr; Voltar
                         </Link>
                     </div>
                 </div>
             </main>
        );
    }

    const allCategoryIds = Object.keys(itemsByCategory).filter(k => k !== UNCATEGORIZED_KEY);
    const uncategorizedItems = itemsByCategory[UNCATEGORIZED_KEY] || [];

    return (
        <main className="min-h-screen flex flex-col items-center justify-start p-6 bg-white">
            <div className="w-full max-w-3xl mt-12">
                
                <CreationStepper currentStep={4} />

                <div className="w-full max-w-2xl mx-auto">
                    <h1 className="text-3xl font-bold text-gray-900 mb-8">Cardápio</h1>

                    <button
                        disabled={true}
                        className="w-full py-3 px-4 mb-4 border border-gray-300 rounded-md text-base font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Importar e Sincronizar do iFood (Em breve)
                    </button>
                    
                    <p className="text-center text-gray-500 mb-6">ou adicione seus itens manualmente.</p>

                    <div className="p-6 bg-white border border-gray-200 rounded-lg shadow-sm mb-8">
                        <div className="flex items-center gap-4 mb-6 pb-6 border-b">
                            {logoUrl && (
                                <img src={logoUrl} alt="Logo" className="w-16 h-16 rounded-full object-cover" />
                            )}
                            <h2 className="text-2xl font-semibold">{restaurant.name}</h2>
                        </div>
                        
                        <h3 className="text-xl font-semibold mb-4">Itens do Menu</h3>
                        
                        <div className="space-y-6">
                            {allCategoryIds.length === 0 && uncategorizedItems.length === 0 && (
                                 <p className="text-sm text-gray-500">Nenhum item cadastrado.</p>
                            )}

                            {allCategoryIds.map((catId) => {
                                const items = itemsByCategory[catId];
                                const categoryName = items[0]?.category?.name; // Pega o nome da categoria
                                if (items.length === 0) return null;

                                return (
                                    <div key={catId}>
                                        <h4 className="text-lg font-medium text-gray-800 mb-2">{categoryName || "Categoria"}</h4>
                                        <div className="pl-4 space-y-2">
                                            {items.map(item => (
                                                <p key={item.id} className="text-gray-700">{item.name}</p>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                            
                            {uncategorizedItems.length > 0 && (
                                <div>
                                    <h4 className="text-lg font-medium text-gray-800 mb-2">Sem Categoria</h4>
                                    <div className="pl-4 space-y-2">
                                        {uncategorizedItems.map(item => (
                                            <p key={item.id} className="text-gray-700">{item.name}</p>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-4 mt-8 pt-6 border-t">
                            <Link 
                                href={`/menu/${menuId}/add-item`}
                                className="bg-indigo-600 text-white py-2 px-4 rounded-md font-medium hover:bg-indigo-700"
                            >
                                + Adicionar Item
                            </Link>
                            <Link 
                                href={`/menu/${menuId}`}
                                className="bg-gray-100 text-gray-800 py-2 px-4 rounded-md font-medium hover:bg-gray-200"
                            >
                                Gerenciar Cardápio (Avançado)
                            </Link>
                        </div>
                    </div>
                    
                    <Link
                        href="/restaurante/criar/info"
                        className="w-full block text-center bg-black text-white py-3 px-6 rounded-lg text-lg font-medium hover:bg-gray-800"
                    >
                        Continuar
                    </Link>
                </div>
            </div>
        </main>
    );
}