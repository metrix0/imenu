// app/[slug]/menu-client.tsx
"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
// IMPORTAÇÃO ATUALIZADA
import { Category, Item, ItemsByCategory, Subcategory } from "@/lib/types";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { icons } from "@/lib/fontawesome";
// IMPORTA O NOVO COMPONENTE DE DETALHES
import posthog from "posthog-js";
import ItemDetails from "@/components/consumidor/ItemDetails";

// Definição de Props atualizada (não mudou da última vez)
type MenuClientProps = {
    slug: string;
    menu: {
        id: string;
        name: string;
        description: string | null;
        banner_url: string | null;
    };
    restaurant: {
        id: string | undefined;
        logo_url: string | null;
        prep_time_min_minutes?: number | null;
        prep_time_max_minutes?: number | null;
        rating?: number | null;
        min_order_cents?: number | null;
    };
    categories: Category[];
    itemsByCategory: ItemsByCategory;
    highlightedItems: Item[];
};

const formatPrice = (priceInCents: number) => {
    return (priceInCents / 100).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
    });
};

export default function MenuClientPage({
    slug,
    menu,
    restaurant,
    categories,
    itemsByCategory,
    highlightedItems,
}: MenuClientProps) {
    const router = useRouter();
    const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

    // --- NOVOS STATES PARA O MODAL (GAVETA) ---
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedItemData, setSelectedItemData] = useState<{ item: Item; subcategories: Subcategory[] } | null>(null);
    const [isLoadingDetails, setIsLoadingDetails] = useState(false);
    // --- FIM DOS NOVOS STATES ---

    // EFEITO PARA RASTREAMENTO COM POSTHOG
    useEffect(() => {
        posthog.capture("menu_viewed", {
            restaurantId: restaurant.id,
            menuId: menu.id,
        });
    }, [restaurant.id, menu.id]);
    // FIM DO EFEITO DE RASTREAMENTO

    // Inicializa o estado de categorias expandidas (todas abertas por padrão)
    useEffect(() => {
        const initialState: Record<string, boolean> = {};
        categories.forEach((cat) => {
            initialState[cat.id] = true;
        });
        setExpandedCategories(initialState);
    }, [categories]);

    const toggleCategory = (categoryId: string) => {
        setExpandedCategories((prev) => ({
            ...prev,
            [categoryId]: !prev[categoryId],
        }));
    };

    // --- LÓGICA DE CLIQUE ATUALIZADA ---
    // Em vez de navegar, agora busca os dados e abre o modal
    const handleItemClick = async (itemId: string) => {
        setIsLoadingDetails(true);
        setIsModalOpen(true); // Abre a gaveta (vazia)
        setSelectedItemData(null); // Limpa dados antigos

        try {
            // Chama a nova API que criamos
            const response = await fetch(`/api/item/${itemId}`);
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || "Falha ao buscar detalhes do item.");
            }
            const data = await response.json(); // { item, subcategories }
            setSelectedItemData(data);
        } catch (err) {
            console.error(err);
            alert((err as Error).message);
            setIsModalOpen(false); // Fecha se der erro
        } finally {
            setIsLoadingDetails(false);
        }
    };

    // Função para fechar o modal
    const closeModal = () => {
        setIsModalOpen(false);
        setSelectedItemData(null);
    };
    // --- FIM DAS MUDANÇAS NA LÓGICA ---

    const formatRating = (rating: number | null | undefined) => {
        if (!rating) return null;
        return rating.toFixed(1).replace('.', ',');
    };

    return (
        // Adiciona 'overflow-hidden' ao body quando o modal está aberto
        // para impedir o scroll da página principal no mobile
        <div className={`min-h-screen bg-white pb-20 ${isModalOpen ? 'overflow-hidden' : ''}`}>

            {/* ... (Todo o JSX do Cardápio: Banner, Logo, Infos, Destaques) ... */}
            {/* (O código do Brendo para a página principal permanece o mesmo) */}
            <div className="relative">
                {menu.banner_url ? (
                    <div className="w-full h-48 bg-cover bg-center" style={{ backgroundImage: `url(${menu.banner_url})` }} />
                ) : (
                    <div className="w-full h-48 bg-gray-200" />
                )}
                <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 z-10">
                    {restaurant.logo_url ? (
                        <img src={restaurant.logo_url} alt="Logo" className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-md" />
                    ) : (
                        <div className="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 border-4 border-white shadow-md">Logo</div>
                    )}
                </div>
            </div>
            <div className="max-w-4xl mx-auto px-4 mt-16 text-center">
                <h1 className="text-2xl font-bold">{menu.name}</h1>
                {restaurant.rating && (
                    <div className="flex items-center justify-center gap-2 mt-2 text-sm">
                        <span className="text-yellow-500">★</span>
                        <span className="font-bold text-gray-800">{formatRating(restaurant.rating)}</span>
                        <span className="text-gray-500">(50+ avaliações)</span>
                        <span className="text-gray-500">•</span>
                        <span className="font-bold text-red-600">Super</span>
                    </div>
                )}
                <div className="flex items-center justify-center flex-wrap gap-x-2 gap-y-1 mt-2 text-sm text-gray-500">
                    <span>Padrão</span>
                    <span className="text-gray-500">•</span>
                    {restaurant.prep_time_min_minutes && (
                        <span>{restaurant.prep_time_min_minutes} - {restaurant.prep_time_max_minutes} min</span>
                    )}
                    {restaurant.min_order_cents && restaurant.min_order_cents > 0 && (
                        <>
                            <span className="text-gray-500">•</span>
                            <span>Pedido Mínimo {formatPrice(restaurant.min_order_cents)}</span>
                        </>
                    )}
                </div>
                {menu.description && (<p className="mt-2 text-gray-600 text-sm">{menu.description}</p>)}
            </div>
            <hr className="my-6" />
            {highlightedItems.length > 0 && (
                <div className="max-w-4xl mx-auto px-4 mb-6">
                    <h2 className="text-xl font-bold mb-4">Destaques</h2>
                    <div className="flex gap-4 overflow-x-auto pb-4">
                        {highlightedItems.map((item) => (
                            <button key={item.id} onClick={() => handleItemClick(item.id)} className="flex-shrink-0 w-40 text-left">
                                <div className="w-40 h-28 bg-gray-100 rounded-md overflow-hidden">
                                    {item.image_public_url ? (<img src={item.image_public_url} alt={item.name} className="w-full h-full object-cover" />) : (<div className="w-full h-full bg-gray-200" />)}
                                </div>
                                <h3 className="font-medium text-gray-800 mt-2 truncate">{item.name}</h3>
                                <p className="font-semibold text-green-700">{formatPrice(item.price_cents)}</p>
                                {(item as any).old_price_cents && (
                                    <div className="flex items-center gap-2">
                                        <p className="text-xs text-gray-500 line-through">{formatPrice((item as any).old_price_cents)}</p>
                                        <span className="text-xs font-bold text-red-600 bg-red-100 px-1 rounded">
                                            - {Math.round(100 - (item.price_cents / (item as any).old_price_cents) * 100)}%
                                        </span>
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>
                    <hr className="mt-2" />
                </div>
            )}
            <div className="max-w-4xl mx-auto p-4 space-y-8">
                {categories.length === 0 && (<p className="text-center text-gray-500">Nenhum item disponível.</p>)}
                {categories.map((category) => (
                    <div key={category.id} className="overflow-hidden">
                        <button onClick={() => toggleCategory(category.id)} className="w-full flex justify-between items-center py-4">
                            <h2 className="text-2xl font-bold">{category.name}</h2>
                            <FontAwesomeIcon icon={expandedCategories[category.id] ? icons.faChevronUp : icons.faChevronDown} className="text-gray-600" />
                        </button>
                        {expandedCategories[category.id] && (
                            <div className="space-y-4">
                                {(itemsByCategory[category.id] || []).map((item) => (
                                    <button
                                        key={item.id}
                                        onClick={() => handleItemClick(item.id)}
                                        className="w-full flex text-left gap-4 p-3 rounded-md hover:bg-gray-50 transition-colors"
                                        disabled={!item.is_available}
                                    >
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-bold text-lg">{item.name}</h3>
                                            {item.description && (<p className="text-gray-600 text-sm mt-1 line-clamp-2">{item.description}</p>)}
                                            <p className="font-bold text-lg text-green-700 mt-2">{formatPrice(item.price_cents)}</p>
                                        </div>
                                        {item.image_public_url ? (
                                            <img src={item.image_public_url} alt={item.name} className="w-28 h-28 object-cover rounded-md flex-shrink-0" />
                                        ) : (
                                            <div className="w-28 h-28 bg-gray-200 rounded-md flex-shrink-0" />
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>
            {/* ... Fim do JSX da página do menu ... */}


            {/* --- [Elemento F] O Modal (Gaveta) --- */}
            {isModalOpen && (
                <div
                    className="fixed inset-0 z-40 bg-[rgba(0,0,0,0.5)] transition-opacity" // Overlay
                    onClick={closeModal}
                    aria-hidden="true"
                >
                    <div
                        className="fixed bottom-0 left-0 right-0 z-50 w-full max-w-4xl mx-auto" // A "Gaveta"
                        onClick={(e) => e.stopPropagation()} // Impede de fechar ao clicar na gaveta
                    >
                        {/* Estado de Carregamento */}
                        {isLoadingDetails && (
                            <div className="h-64 bg-white rounded-t-2xl flex items-center justify-center">
                                <p className="text-gray-500">Carregando detalhes do item...</p>
                            </div>
                        )}

                        {/* Conteúdo Carregado (O componente que criamos na Etapa 2) */}
                        {selectedItemData && (
                            <ItemDetails
                                slug={slug}
                                item={selectedItemData.item}
                                subcategories={selectedItemData.subcategories}
                                onClose={closeModal}
                            />
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}