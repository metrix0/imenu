"use client";

import { useMemo, useState, useEffect } from "react";
import { Restaurant, Category, ItemsByCategory, Item } from "@/lib/types/types";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { icons } from "@/lib/utils/fontawesome";
import Input from "@/components/ui/Input";
import ItemModal from "./ItemModal";
import DraggableModal from "@/components/ui/HybridModal";

interface SearchModalProps {
    restaurant: Restaurant;
    categories: Category[];
    itemsByCategory: ItemsByCategory;
    onClose: () => void; // only close modal
}

export default function SearchModal({ restaurant, categories, itemsByCategory, onClose }: SearchModalProps) {
    const [searchText, setSearchText] = useState(""); // isolated state
    const [openedItem, setOpenedItem] = useState<Item | null>(null);
    const [openModal, setOpenModal] = useState(false);

    // --- Animate open ---
    useEffect(() => {
        requestAnimationFrame(() => setOpenModal(true));
    }, []);

    // --- Closing with animation ---
    const closeWithAnimation = () => {
        setOpenModal(false);
        setTimeout(() => onClose(), 250); // match DraggableModal transition
    };

    const filteredItemsByCat = useMemo(() => {
        return Object.fromEntries(
            Object.entries(itemsByCategory).map(([catId, arr]) => [
                catId,
                searchText
                    ? arr.filter((i) => i.name.toLowerCase().includes(searchText.toLowerCase()))
                    : [],
            ])
        );
    }, [searchText, itemsByCategory]);

    const allFilteredItems = useMemo(() => Object.values(filteredItemsByCat).flat(), [filteredItemsByCat]);

    const hasSearch = searchText.trim().length > 0;

    useEffect(() => {
        if (!openModal) return;

        // Lock scroll
        const originalStyle = window.getComputedStyle(document.body).overflow;
        document.body.style.overflow = "hidden";

        return () => {
            // Restore
            document.body.style.overflow = originalStyle;
        };
    }, [openModal]);

    return (
        <DraggableModal open={openModal} onClose={closeWithAnimation} height={0.9} handle>
            {/* Search bar + Cancel */}
            <div className="sticky top-0 bg-white z-50 py-3 flex items-center gap-2 px-2">
                <Input
                    icon={<FontAwesomeIcon icon={icons.faMagnifyingGlass} />}
                    placeholder="Buscar no cardápio..."
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                />
                <button className="text-brand font-semibold ml-2" onClick={closeWithAnimation}>
                    Cancelar
                </button>
            </div>

            {/* Empty / Not found */}
            {!hasSearch && (
                <div className="flex flex-col items-center justify-center mt-20 text-center">
                    <img src="/images/empty_search.svg" alt="Sem pesquisa" className="w-48 h-48 mb-4" />
                    <p className="text-gray-500">Digite o nome do item que deseja encontrar no cardápio.</p>
                </div>
            )}

            {hasSearch && allFilteredItems.length === 0 && (
                <div className="flex flex-col items-center justify-center mt-20 text-center">
                    <img src="/images/no_results.svg" alt="Nada encontrado" className="w-48 h-48 mb-4" />
                    <p className="text-gray-500">Nenhum item encontrado para "{searchText}".</p>
                </div>
            )}

            {/* List items by category */}
            {hasSearch && allFilteredItems.length > 0 && (
                <div className="space-y-6 mt-3">
                    {categories.map((cat) => {
                        const items = filteredItemsByCat[cat.id];
                        if (!items || items.length === 0) return null;
                        return (
                            <div key={cat.id}>
                                <h3 className="font-semibold text-lg mb-2">{cat.name}</h3>
                                <div className="space-y-2">
                                    {items.map((item) => (
                                        <button
                                            key={item.id}
                                            className="w-full text-left border-b border-gray-200 py-2 flex items-center gap-3"
                                            onClick={() => setOpenedItem(item)}
                                        >
                                            <img
                                                src={item.image_public_url || "/placeholders/item.png"}
                                                alt={item.name}
                                                className="w-16 h-16 rounded object-cover"
                                            />
                                            <div className="flex-1">
                                                <p className="font-semibold">{item.name}</p>
                                                {item.description && (
                                                    <p className="text-gray-600 text-sm line-clamp-2">{item.description}</p>
                                                )}
                                            </div>
                                            <div className="font-bold">
                                                {item.price_cents ? `R$ ${(item.price_cents / 100).toFixed(2)}` : "-"}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Item modal */}
            {openedItem && (
                <ItemModal
                    restaurant={restaurant}
                    item={openedItem}
                    subcategories={[]}
                    loading={false}
                    onClose={() => setOpenedItem(null)}
                    deliveryTax={{ lowest: 0, highest: 0 }}
                    deliveryTime={{ lowest: 0, highest: 0 }}
                />
            )}
        </DraggableModal>
    );
}
