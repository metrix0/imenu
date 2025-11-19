// components/ItemDetails.tsx
"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cartStore";
import { Item, Subcategory, Subitem } from "@/lib/types";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { icons } from "@/lib/fontawesome";
import posthog from "posthog-js";

// (Tipos e formatPrice permanecem os mesmos)
// ...
type ItemDetailsProps = {
    slug: string;
    item: Item;
    subcategories: Subcategory[];
    onClose: () => void;
};
type SelectedSubitemsQty = Record<string, Record<string, number>>;
const formatPrice = (priceInCents: number) => {
    return (priceInCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};


export default function ItemDetails({ slug, item, subcategories, onClose }: ItemDetailsProps) {
    const router = useRouter();
    const { orderId, restaurantSlug, setDraftOrder, clearCart } = useCart();
    const isSameRestaurant = !restaurantSlug || restaurantSlug === slug;

    // (Todos os states e lógicas de cálculo permanecem os mesmos)
    const [quantity, setQuantity] = useState(1);
    const [subitemQuantities, setSubitemQuantities] = useState<SelectedSubitemsQty>({});
    const [isAddingToCart, setIsAddingToCart] = useState(false);
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
                if (max_select === 1 && newQty === 1) {
                    const newRadioState: Record<string, number> = {};
                    newRadioState[subitemId] = 1;
                    return { ...prev, [subcatId]: newRadioState };
                }
                const totalItems = Object.values(categoryState).reduce((sum, qty) => sum + qty, 0) + amount;
                if (totalItems > max_select) {
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
    // --- FIM DA LÓGICA DO BRENDO ---


    const handleAddToCart = async () => {
        if (validationErrors.length > 0) {
            alert("Por favor, verifique as opções:\n" + validationErrors.join("\n"));
            return;
        }

        if (!isSameRestaurant) {
            if (confirm("Você tem itens de outro restaurante na sacola. Deseja limpar e adicionar este?")) {
                clearCart();
                alert("Sacola limpa. Por favor, adicione o item novamente.");
                setIsAddingToCart(false);
                return;
            } else {
                return;
            }
        }

        setIsAddingToCart(true);

        // (Lógica de descriptiveName, uniqueCartItemId, etc.)
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

        try {
            const response = await fetch("/api/cart/add-item", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    restaurantSlug: slug,
                    draftOrderId: orderId,
                    item: item,
                    quantity: quantity,
                    subitemsPriceCents: subitemsPriceCents,
                    descriptiveName: descriptiveName,
                    uniqueCartItemId: uniqueCartItemId,
                    selectedSubitems: subitemQuantities
                }),
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || "Falha ao adicionar item.");
            }

            const data = await response.json();
            setDraftOrder(data.orderId, data.restaurantSlug);

            // ---- EVENTO POSTHOG ----
            posthog.capture("item_added_to_cart", {
                restaurant_slug: slug,
                order_id: data.orderId,
                item_id: item.id,
                item_name: item.name,
                quantity,
                unit_price_cents: item.price_cents,
                subitems_price_cents: subitemsPriceCents,
                total_price_cents: totalCalculatedPriceCents,
                selected_subitems: selectedSubitemNames, // lista de nomes com qty
                unique_cart_item_id: uniqueCartItemId,
            });
            // -------------------------

            onClose(); // Fecha o modal

            // --- CORREÇÃO AQUI ---
            // Redireciona para a nova página do carrinho (Sacola)
            // Usamos o 'slug' e o 'orderId' que a API retornou
            router.push(`/${slug}/${data.orderId}`);
            // --- FIM DA CORREÇÃO ---

        } catch (err) {
            alert((err as Error).message);
        } finally {
            setIsAddingToCart(false);
        }
    };

    // --- JSX (Sem mudanças) ---
    return (
        <div className="relative bg-white rounded-t-2xl max-h-[90vh] overflow-y-auto">
            {/* (Botão de Fechar) */}
            <button onClick={onClose} className="absolute top-4 right-4 z-10 bg-gray-200 rounded-full p-2" aria-label="Fechar">
                <FontAwesomeIcon icon={icons.faTimes} className="w-5 h-5" />
            </button>
            {/* (Imagem) */}
            {item.image_public_url ? (
                <img src={item.image_public_url} alt={item.name} className="w-full h-64 object-cover" />
            ) : (
                <div className="w-full h-64 bg-gray-200" />
            )}
            {/* (Conteúdo) */}
            <div className="p-4 space-y-4">
                <h1 className="text-3xl font-bold text-gray-900">{item.name}</h1>
                {item.description && (
                    <p className="text-gray-600 mt-3">{item.description}</p>
                )}
                <p className="text-2xl font-semibold text-gray-800">
                    {formatPrice(item.price_cents)}
                </p>
            </div>
            <hr className="my-4" />
            {/* (Subcategorias) */}
            <div className="p-4 space-y-6">
                {subcategories.map((sc) => {
                    const categoryQtys = subitemQuantities[sc.id] || {};
                    const totalSelectedInCategory = Object.values(categoryQtys).reduce((sum, qty) => sum + qty, 0);
                    const min = sc.min_select;
                    const max = sc.max_select;
                    const isMinMet = totalSelectedInCategory >= min;
                    return (
                        <div key={sc.id} className="bg-white rounded-lg">
                            <div className="pb-3 border-b border-gray-200">
                                <div className="flex justify-between items-center">
                                    <h2 className="text-xl font-semibold">{sc.name}</h2>
                                    <span className={`px-2 py-0.5 rounded text-sm ${isMinMet ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                                        {min > 0 ? (isMinMet ? "Concluído" : "Obrigatório") : "Opcional"}
                                    </span>
                                </div>
                                <p className="text-sm text-gray-600 mt-1">Selecione {min === max ? `exatamente ${min}` : `de ${min} a ${max}`}. (Selecionado: {totalSelectedInCategory})</p>
                            </div>
                            <div className="mt-4 space-y-3">
                                {sc.subitems.map((si) => {
                                    const currentSubitemQty = categoryQtys[si.id] || 0;
                                    const isAddDisabled = max > 0 && totalSelectedInCategory >= max && currentSubitemQty === 0;
                                    const isRemoveDisabled = currentSubitemQty === 0;
                                    return (
                                        <div key={si.id} className="flex items-center justify-between p-3 rounded-md">
                                            <div className="flex-1 min-w-0">
                                                <span className="font-medium">{si.name}</span>
                                                <span className="text-gray-700 font-medium ml-2">+ {formatPrice(si.price_cents)}</span>
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
            {/* (Rodapé Fixo) */}
            <div className="sticky bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-inner z-20">
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
                    <button
                        onClick={handleAddToCart}
                        disabled={validationErrors.length > 0 || isAddingToCart || !isSameRestaurant}
                        className="flex-1 bg-black text-white px-6 py-3 rounded-lg font-bold text-lg shadow-md hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isAddingToCart ? "Adicionando..." : `Adicionar ${formatPrice(totalCalculatedPriceCents)}`}
                    </button>
                </div>
            </div>
            {!isSameRestaurant && (
                <div className="p-2 text-center text-xs bg-red-100 text-red-700">
                    Você já possui itens de outro restaurante na sacola.
                </div>
            )}
        </div>
    );
}