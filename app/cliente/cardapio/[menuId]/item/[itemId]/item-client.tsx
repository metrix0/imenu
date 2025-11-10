// app/cliente/cardapio/[menuId]/item/[itemId]/item-client.tsx
"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cartStore";
import { Item, Subcategory, Subitem } from "@/lib/types";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { icons } from "@/lib/fontawesome";

type ItemClientProps = {
    menuId: string;
    item: Item;
    subcategories: Subcategory[];
};

type SelectedSubitemsQty = Record<string, Record<string, number>>;

const formatPrice = (priceInCents: number) => {
    return (priceInCents / 100).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
    });
};

export default function ItemClientPage({ menuId, item, subcategories }: ItemClientProps) {
    const router = useRouter();
    const { add: addToCart } = useCart();

    const [quantity, setQuantity] = useState(1);
    const [subitemQuantities, setSubitemQuantities] = useState<SelectedSubitemsQty>({});

    const handleQuantityChange = (amount: 1 | -1) => {
        setQuantity((prev) => Math.max(1, prev + amount));
    };

    const handleSubitemQtyChange = (subcat: Subcategory, subitem: Subitem, amount: 1 | -1) => {
        const { id: subcatId, max_select } = subcat;
        const { id: subitemId } = subitem;

        setSubitemQuantities((prev) => {
            const categoryState = prev[subcatId] || {};
            const currentQty = categoryState[subitemId] || 0;
            const newQty = currentQty + amount;

            if (newQty < 0) return prev;

            if (amount > 0 && max_select > 0) {
                const totalInCategory = Object.keys(categoryState).reduce((sum, sId) => {
                    if (sId === subitemId) return sum;
                    return sum + categoryState[sId];
                }, 0);

                const newTotalInCategory = totalInCategory + newQty;
                if (newTotalInCategory > max_select) {
                    return prev;
                }
            }

            const newCategoryState = { ...categoryState, [subitemId]: newQty };
            if (newQty === 0) {
                delete newCategoryState[subitemId];
            }

            return { ...prev, [subcatId]: newCategoryState };
        });
    };

    const allSubitemsMap = useMemo(() => {
        const map = new Map<string, Subitem>();
        subcategories.forEach((sc) => {
            sc.subitems.forEach((si) => {
                map.set(si.id, si);
            });
        });
        return map;
    }, [subcategories]);

    const subitemsPriceCents = useMemo(() => {
        let total = 0;
        for (const catId in subitemQuantities) {
            const category = subitemQuantities[catId];
            for (const subitemId in category) {
                const qty = category[subitemId];
                const subitem = allSubitemsMap.get(subitemId);
                if (subitem) {
                    total += subitem.price_cents * qty;
                }
            }
        }
        return total;
    }, [subitemQuantities, allSubitemsMap]);

    const totalCalculatedPriceCents = useMemo(() => {
        const unitPrice = item.price_cents + subitemsPriceCents;
        return unitPrice * quantity;
    }, [item.price_cents, subitemsPriceCents, quantity]);

    const validationErrors = useMemo(() => {
        const errors: string[] = [];
        subcategories.forEach((sc) => {
            const categoryQtys = subitemQuantities[sc.id] || {};
            const selectedCount = Object.values(categoryQtys).reduce((sum, qty) => sum + qty, 0);
            if (selectedCount < sc.min_select) {
                errors.push(`Selecione pelo menos ${sc.min_select} em "${sc.name}".`);
            }
        });
        return errors;
    }, [subcategories, subitemQuantities]);

    const handleAddToCart = () => {
        if (validationErrors.length > 0) {
            alert("Por favor, verifique as opções:\n" + validationErrors.join("\n"));
            return;
        }

        const selectedSubitemNames: string[] = [];
        for (const catId in subitemQuantities) {
            const category = subitemQuantities[catId];
            for (const subitemId in category) {
                const qty = category[subitemId];
                if (qty > 0) {
                    const subitem = allSubitemsMap.get(subitemId);
                    if (subitem) selectedSubitemNames.push(`${subitem.name} (x${qty})`);
                }
            }
        }

        const descriptiveName = item.name + (selectedSubitemNames.length > 0 ? ` (${selectedSubitemNames.join(", ")})` : "");
        const unitPriceCents = item.price_cents + subitemsPriceCents;

        const sortedQuantities: SelectedSubitemsQty = {};
        Object.keys(subitemQuantities).sort().forEach((catId) => {
            const category = subitemQuantities[catId];
            const sortedCategory: Record<string, number> = {};
            Object.keys(category).sort().forEach((subitemId) => {
                if (category[subitemId] > 0) sortedCategory[subitemId] = category[subitemId];
            });
            if (Object.keys(sortedCategory).length > 0) sortedQuantities[catId] = sortedCategory;
        });
        const selectionKey = JSON.stringify(sortedQuantities);
        const uniqueCartItemId = `${item.id}-${selectionKey}`;

        addToCart({
            itemId: uniqueCartItemId,
            name: descriptiveName,
            price_cents: unitPriceCents,
            qty: quantity,
            base_item_id: item.id,
            menuId: menuId,
        });

        router.push(`/carrinho/${menuId}`);
    };

    return (
        <div className="min-h-screen bg-gray-50 pb-32">
            <button onClick={() => router.back()} className="absolute top-4 left-4 z-10 bg-white rounded-full p-2 shadow-md">
                <FontAwesomeIcon icon={icons.faArrowLeft} className="w-5 h-5" />
            </button>

            <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-md mt-16 overflow-hidden relative z-0">

                {/* Imagem no topo do card */}
                {item.image_public_url ? (
                    <img
                        src={item.image_public_url}
                        alt={item.name}
                        className="w-full h-64 sm:h-80 object-cover"
                    />
                ) : (
                    <div className="w-full h-64 sm:h-80 bg-gray-200 flex items-center justify-center text-gray-400">
                        Sem Imagem
                    </div>
                )}

                {/* Conteúdo abaixo da imagem */}
                <div className="p-6">
                    <h1 className="text-3xl font-bold text-gray-900">{item.name}</h1>
                    {item.description && (
                        <p className="text-gray-600 mt-3">{item.description}</p>
                    )}
                    <p className="text-2xl font-semibold text-gray-800 mt-4">
                        {formatPrice(item.price_cents)}
                    </p>
                </div>
            </div>

            <div className="max-w-2xl mx-auto p-4 mt-6 space-y-6">
                {subcategories.map((sc) => {
                    const categoryQtys = subitemQuantities[sc.id] || {};
                    const totalSelectedInCategory = Object.values(categoryQtys).reduce((sum, qty) => sum + qty, 0);
                    const min = sc.min_select;
                    const max = sc.max_select;
                    const isMinMet = totalSelectedInCategory >= min;

                    return (
                        <div key={sc.id} className="bg-white rounded-lg shadow-md p-4">
                            <div className="pb-3 border-b border-gray-200">
                                <div className="flex justify-between items-center">
                                    <h2 className="text-xl font-semibold">{sc.name}</h2>
                                    <span className={`px-2 py-0.5 rounded text-sm ${isMinMet ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                                        {min > 0 ? (isMinMet ? "Concluído" : "Obrigatório") : "Opcional"}
                                    </span>
                                </div>
                                {sc.description && <p className="text-sm text-gray-500 mt-1">{sc.description}</p>}
                                <p className="text-sm text-gray-600 mt-1">Selecione {min === max ? `exatamente ${min}` : `de ${min} a ${max}`}. (Selecionado: {totalSelectedInCategory})</p>
                            </div>

                            <div className="mt-4 space-y-3">
                                {sc.subitems.map((si) => {
                                    const currentSubitemQty = categoryQtys[si.id] || 0;
                                    const isAddDisabled = max > 0 && totalSelectedInCategory >= max;
                                    const isRemoveDisabled = currentSubitemQty === 0;

                                    return (
                                        <div key={si.id} className="flex items-center justify-between p-3 rounded-md border border-gray-200">
                                            <div className="flex-1 min-w-0">
                                                <span className="font-medium">{si.name}</span>
                                                {si.description && <p className="text-sm text-gray-500">{si.description}</p>}
                                                <span className="text-gray-700 font-medium">+ {formatPrice(si.price_cents)}</span>
                                            </div>

                                            <div className="flex items-center rounded-lg border border-gray-300 ml-4">
                                                <button onClick={() => handleSubitemQtyChange(sc, si, -1)} disabled={isRemoveDisabled} className="px-3 py-1 text-lg font-bold text-gray-700 hover:bg-gray-100 disabled:opacity-50">
                                                    <FontAwesomeIcon icon={icons.faMinus} className="w-3 h-3" />
                                                </button>
                                                <span className="px-4 py-1 text-sm font-bold">{currentSubitemQty}</span>
                                                <button onClick={() => handleSubitemQtyChange(sc, si, 1)} disabled={isAddDisabled} className="px-3 py-1 text-lg font-bold text-gray-700 hover:bg-gray-100 disabled:opacity-50">
                                                    <FontAwesomeIcon icon={icons.faPlus} className="w-3 h-3" />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-inner z-20">
                <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
                    <div className="flex items-center rounded-lg border border-gray-300">
                        <button onClick={() => handleQuantityChange(-1)} className="px-4 py-2 text-xl font-bold text-gray-700 hover:bg-gray-100 disabled:opacity-50" disabled={quantity <= 1}>
                            <FontAwesomeIcon icon={icons.faMinus} />
                        </button>
                        <span className="px-5 py-2 text-lg font-bold">{quantity}</span>
                        <button onClick={() => handleQuantityChange(1)} className="px-4 py-2 text-xl font-bold text-gray-700 hover:bg-gray-100">
                            <FontAwesomeIcon icon={icons.faPlus} />
                        </button>
                    </div>

                    <button onClick={handleAddToCart} disabled={validationErrors.length > 0} className="flex-1 bg-black text-white px-6 py-3 rounded-lg font-bold text-lg shadow-md hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed">
                        Adicionar {formatPrice(totalCalculatedPriceCents)}
                    </button>
                </div>
            </div>
        </div>
    );
}
