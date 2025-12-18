"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { icons } from "@/lib/utils/fontawesome";

// UI Components
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

// Tipos necessários
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

    // Lógica de agrupamento
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

    if (!menuId) return (
        <Card className="p-8 text-center">
            <p className="text-gray-500">Nenhum cardápio encontrado.</p>
        </Card>
    );

    return (
        <Card className={`min-h-[200px] p-6 ${className}`}>
            <div className="space-y-8">
                <div className="flex justify-between items-center border-b border-gray-100 pb-4">
                    <h3 className="text-xl font-bold text-gray-900">Seu Cardápio</h3>
                    <Button 
                        variant="primary" 
                        onClick={() => router.push(`/painel/cardapio/adicionar-item`)}
                        className="text-sm px-4 py-2"
                    >
                        <FontAwesomeIcon icon={icons.faPlus} className="mr-2" />
                        Novo Item
                    </Button>
                </div>

                {/* Estado Vazio */}
                {allCategoryIds.length === 0 && uncategorizedItems.length === 0 && (
                     <div className="text-center py-12 my-10 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                        <p className="text-gray-500 mb-4 ">Seu cardápio ainda não tem itens.</p>
                        <Button 
                            variant="primary"
                            onClick={() => router.push(`/painel/cardapio/adicionar-item`)}
                        >
                            Adicionar primeiro item
                        </Button>
                     </div>
                )}

                {/* Categorias Ordenadas */}
                {allCategoryIds.map((catId) => {
                    const categoryItems = itemsByCategory[catId];
                    const categoryName = categories.find(c => c.id === catId)?.name || "Categoria";
                    
                    if (categoryItems.length === 0) return null;

                    return (
                        <div key={catId}>
                            <div className="flex justify-between items-center mb-3">
                                <h4 className="text-lg font-bold text-gray-800">
                                    {categoryName}
                                </h4>
                                <Link 
                                    href={`/painel/cardapio/categorias/${catId}`} 
                                    className="text-xs text-brand font-medium hover:underline"
                                >
                                    Editar Categoria
                                </Link>
                            </div>
                            
                            <div className="grid grid-cols-1 gap-2">
                                {categoryItems.map(item => (
                                    <div key={item.id} className="flex justify-between items-center p-4 bg-white rounded-lg border border-gray-200 hover:border-brand/30 hover:shadow-sm transition-all group">
                                        <span className="text-gray-700 font-medium">{item.name}</span>
                                        <Link 
                                            href={`/painel/cardapio/item/${item.id}`} 
                                            className="text-sm text-gray-400 group-hover:text-brand font-medium flex items-center gap-2"
                                        >
                                            <FontAwesomeIcon icon={icons.faEdit} />
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
                        <h4 className="text-lg font-bold text-gray-800 mb-3 pt-4">Geral (Sem Categoria)</h4>
                        <div className="grid grid-cols-1 gap-2">
                            {uncategorizedItems.map(item => (
                                <div key={item.id} className="flex justify-between items-center p-4 bg-white rounded-lg border border-gray-200 hover:border-brand/30 hover:shadow-sm transition-all group">
                                    <span className="text-gray-700 font-medium">{item.name}</span>
                                    <Link 
                                        href={`/painel/cardapio/item/${item.id}`} 
                                        className="text-sm text-gray-400 group-hover:text-brand font-medium flex items-center gap-2"
                                    >
                                        <FontAwesomeIcon icon={icons.faEdit} />
                                        Editar
                                    </Link>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Ações de Rodapé */}
            <div className="mt-8 pt-6 border-t border-gray-100 flex flex-col sm:flex-row gap-4 justify-end">
                <Button 
                    variant="secondary"
                    onClick={() => router.push(`/painel/cardapio/categorias`)}
                >
                    Gerenciar Categorias
                </Button>
            </div>
        </Card>
    );
}