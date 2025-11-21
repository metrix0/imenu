"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// UI Components
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

// Tipos necessários para renderização
type Category = { id: string; name: string };
type Item = { id: string; name: string; category?: Category | null };

interface MenuOverviewProps {
    menuId: string | null;
    categories: Category[];
    items: Item[];
    className?: string;
}

const UNCATEGORIZED_KEY = "_uncategorized";

export default function MenuOverview({ 
    menuId, 
    categories, 
    items,
    className = "" 
}: MenuOverviewProps) {
    const router = useRouter();

    // Lógica de agrupamento (mantida)
    const itemsByCategory = useMemo(() => {
        const grouped = categories.reduce<Record<string, Item[]>>((acc, cat) => {
            acc[cat.id] = [];
            return acc;
        }, {});
        
        grouped[UNCATEGORIZED_KEY] = [];

        items.forEach((it) => {
            const catId = it.category?.id ?? null;
            if (catId && grouped[catId]) {
                grouped[catId].push(it);
            } else {
                grouped[UNCATEGORIZED_KEY].push(it);
            }
        });

        return grouped;
    }, [categories, items]);

    const allCategoryIds = Object.keys(itemsByCategory).filter(k => k !== UNCATEGORIZED_KEY);
    const uncategorizedItems = itemsByCategory[UNCATEGORIZED_KEY] || [];

    if (!menuId) return null;

    return (
        // Substituída a div manual pelo componente Card
        <Card className={`min-h-[200px] p-6 ${className}`}>
            <div className="space-y-8">
                {/* Estado Vazio */}
                {allCategoryIds.length === 0 && uncategorizedItems.length === 0 && (
                     <div className="text-center py-8">
                        <p className="text-gray-500 mb-4">Seu cardápio está vazio.</p>
                        <Link 
                            href={`/menu/${menuId}/add-item`}
                            className="text-brand font-medium hover:underline"
                        >
                            Comece adicionando um item
                        </Link>
                     </div>
                )}

                {/* Categorias Ordenadas */}
                {allCategoryIds.map((catId) => {
                    const categoryItems = itemsByCategory[catId];
                    const categoryName = categories.find(c => c.id === catId)?.name || "Categoria";
                    
                    if (categoryItems.length === 0) return null;

                    return (
                        <div key={catId}>
                            <h4 className="text-lg font-bold text-gray-800 mb-3 border-b border-gray-100 pb-1">
                                {categoryName}
                            </h4>
                            <div className="space-y-3">
                                {categoryItems.map(item => (
                                    <div key={item.id} className="flex justify-between items-center p-3 hover:bg-gray-50 rounded-lg border border-transparent hover:border-gray-100 transition-all">
                                        <span className="text-gray-700 font-medium">{item.name}</span>
                                        {/* Link inline mantido como Link pois é navegação textual */}
                                        <Link href={`/painel/cardapio/item/${item.id}`} className="text-xs text-gray-400 hover:text-brand">
                                            Editar
                                        </Link>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
                
                {/* Itens Sem Categoria */}
                {uncategorizedItems.length > 0 && (
                    <div>
                        <h4 className="text-lg font-bold text-gray-800 mb-3 border-b border-gray-100 pb-1">Geral</h4>
                        <div className="space-y-3">
                            {uncategorizedItems.map(item => (
                                <div key={item.id} className="flex justify-between items-center p-3 hover:bg-gray-50 rounded-lg border border-transparent hover:border-gray-100 transition-all">
                                    <span className="text-gray-700 font-medium">{item.name}</span>
                                    <Link href={`/painel/cardapio/item/${item.id}`} className="text-xs text-gray-400 hover:text-brand">
                                        Editar
                                    </Link>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Ações de Rodapé usando Button Component */}
            <div className="mt-8 pt-6 border-t border-gray-100 flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                    <Button 
                        variant="secondary" 
                        onClick={() => router.push(`/menu/${menuId}/add-item`)}
                        className="w-full bg-white text-brand border-brand/30 hover:bg-brand/5"
                    >
                        + Adicionar Item Manualmente
                    </Button>
                </div>
                <div className="flex-1">
                    {/* Usando variant secondary mas com override de classes para manter o estilo 'brand' específico */}
                    <Button 
                        variant="secondary"
                        onClick={() => router.push(`/menu/${menuId}`)}
                        className="w-full bg-white text-brand border-brand/30 hover:bg-brand/5"
                    >
                        Gerenciar Categorias
                    </Button>
                </div>
            </div>
        </Card>
    );
}