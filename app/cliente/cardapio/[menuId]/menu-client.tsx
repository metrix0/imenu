// app/cliente/cardapio/[menuId]/menu-client.tsx
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
    };
    categories: Category[];
    itemsByCategory: ItemsByCategory;
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
        router.push(`/cliente/cardapio/${menu.id}/item/${itemId}`);
    };

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            {/* Banner */}
            {menu.banner_url ? (
                <div
                    className="w-full h-48 md:h-64 bg-cover bg-center"
                    style={{ backgroundImage: `url(${menu.banner_url})` }}
                    aria-label="Banner do Cardápio"
                />
            ) : (
                <div className="w-full h-48 md:h-64 bg-gray-200" />
            )}

            {/* Header */}
            <div className="max-w-4xl mx-auto p-4 -mt-16">
                <div className="bg-white p-6 rounded-lg shadow-lg">
                    <div className="flex items-center gap-4">
                        {restaurant.logo_url && (
                            <img
                                src={restaurant.logo_url}
                                alt="Logo do Restaurante"
                                className="w-20 h-20 rounded-full object-cover border-4 border-white"
                            />
                        )}
                        <h1 className="text-3xl font-bold">{menu.name}</h1>
                    </div>
                    {menu.description && <p className="mt-4 text-gray-600">{menu.description}</p>}
                </div>
            </div>

            {/* Categorias e Itens */}
            <div className="max-w-4xl mx-auto p-4 space-y-6">
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
                                        {/* usa sempre image_public_url (garantida server-side) */}
                                        {item.image_public_url ? (
                                            <img src={item.image_public_url} alt={item.name} className="w-24 h-24 object-cover rounded-md flex-shrink-0" />
                                        ) : (
                                            <div className="w-24 h-24 bg-gray-200 rounded-md flex-shrink-0 flex items-center justify-center text-gray-400 text-xs">
                                                Sem Imagem
                                            </div>
                                        )}

                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-bold text-lg">{item.name}</h3>
                                            <p className="text-gray-600 text-sm mt-1 line-clamp-2">{item.description}</p>
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
