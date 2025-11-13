"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Category, Item, ItemsByCategory } from "@/lib/types";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { icons } from "@/lib/fontawesome";

type MenuClientProps = {
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
        prep_time_source?: string | null;
    };
    categories: Category[];
    itemsByCategory: ItemsByCategory;
    debugRestaurantId?: string | null;
    debugRestaurantRaw?: any | null;
};

const formatPrice = (priceInCents: number) => {
    return (priceInCents / 100).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
    });
};

export default function MenuClientPage({
    menu,
    restaurant,
    categories,
    itemsByCategory,
    debugRestaurantId = null,
    debugRestaurantRaw = null,
}: MenuClientProps) {
    const router = useRouter();
    const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

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

    const handleItemClick = (itemId: string) => {
        router.push(`/cardapio/${menu.id}/item/${itemId}`);
    };

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            {/* Banner */}
            {menu.banner_url ? (
                <div
                    className="w-full h-64 md:h-100 bg-cover bg-center"
                    style={{ backgroundImage: `url(${menu.banner_url})` }}
                    aria-label="Banner do Cardápio"
                />
            ) : (
                <div className="w-full h-48 md:h-80 bg-gray-200" />
            )}

            {/* Card com logo + texto (logo à esquerda em desktop; logo encima em mobile) */}
            <div className="max-w-4xl mx-auto px-4 -mt-16">
                <div className="bg-white p-6 rounded-lg shadow-lg">
                    {/* layout responsivo:
                        - small: column, items center (logo encima, textos centrados)
                        - md+: row, items-center (logo left, textos à direita)
                    */}
                    <div className="flex flex-col md:flex-row md:items-center gap-4">
                        {/* Logo (flex-shrink-0 para não encolher) */}
                        <div className="flex-shrink-0 flex items-center justify-center">
                            {restaurant.logo_url ? (
                                <img
                                    src={restaurant.logo_url}
                                    alt="Logo do Restaurante"
                                    className="w-24 h-24 md:w-28 md:h-28 lg:w-32 lg:h-32 rounded-full object-cover border-2 border-gray-100 shadow-sm"
                                />
                            ) : (
                                <div className="w-24 h-24 md:w-28 md:h-28 lg:w-32 lg:h-32 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
                                    Sem Imagem
                                </div>
                            )}
                        </div>

                        {/* DEBUG: mostrar id coletado e objeto cru do restaurante se a logo não aparecer */}
                        {!restaurant.logo_url && (
                            <div className="mt-2 text-xs text-center text-gray-500">
                                <div>ID coletado: {String(debugRestaurantId ?? "—")}</div>
                                <div className="truncate">Registro raw: {debugRestaurantRaw ? JSON.stringify(debugRestaurantRaw) : "—"}</div>
                            </div>
                        )}

                        {/* Textos: título e descrição */}
                        <div className="text-center md:text-left">
                            <h1 className="text-2xl md:text-3xl font-bold">{menu.name}</h1>
                            {menu.description && (
                                <p className="mt-2 text-gray-600">{menu.description}</p>
                            )}
                            {/* Tempo de preparo se disponível */}
                            {restaurant.prep_time_min_minutes !== undefined && restaurant.prep_time_max_minutes !== undefined && restaurant.prep_time_min_minutes !== null && restaurant.prep_time_max_minutes !== null && (
                                <p className="mt-2 text-sm text-gray-700">
                                    <span className="font-semibold">{restaurant.prep_time_min_minutes} – {restaurant.prep_time_max_minutes} minutos</span>
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Categorias e Itens */}
            <div className="max-w-4xl mx-auto p-4 space-y-6 mt-6">
                {categories.length === 0 && (
                    <p className="text-center text-gray-500">Nenhum item disponível neste cardápio no momento.</p>
                )}

                {categories.map((category) => (
                    <div key={category.id} className="bg-white rounded-lg shadow-md overflow-hidden">
                        <button onClick={() => toggleCategory(category.id)} className="w-full flex justify-between items-center p-4">
                            <h2 className="text-2xl font-semibold">{category.name}</h2>
                            <FontAwesomeIcon icon={expandedCategories[category.id] ? icons.faChevronUp : icons.faChevronDown} className="text-gray-600" />
                        </button>

                        {expandedCategories[category.id] && (
                            <div className="p-4 border-t border-gray-200 space-y-4">
                                {(itemsByCategory[category.id] || []).map((item) => (
                                    <button
                                        key={item.id}
                                        onClick={() => handleItemClick(item.id)}
                                        className="w-full flex text-left gap-4 p-3 rounded-md hover:bg-gray-100 transition-colors"
                                        disabled={!item.is_available}
                                    >
                                        {/* imagem do item */}
                                        {item.image_public_url ? (
                                            <img src={item.image_public_url} alt={item.name} className="w-24 h-24 object-cover rounded-md flex-shrink-0" />
                                        ) : (
                                            <div className="w-24 h-24 bg-gray-200 rounded-md flex-shrink-0 flex items-center justify-center text-gray-400 text-xs">
                                                Sem Imagem
                                            </div>
                                        )}

                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-bold text-lg">{item.name}</h3>
                                            <p className="font-bold text-lg text-green-700 mt-2">{formatPrice(item.price_cents)}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
