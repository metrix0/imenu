"use client";

import { useState, ReactNode } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { icons } from "@/lib/fontawesome";
import { supabase } from "@/lib/supabaseClient";
import MenuItemRow, { MenuItemType } from "./MenuItemRow";

interface CategorySectionProps {
    category: { id: string; name: string };
    items: MenuItemType[];
    restaurantId: string;
    onRefresh: () => void;
    onEditCategory?: () => void;
    onOpenItemDetails: (item: MenuItemType) => void;
    dragHandle?: ReactNode;
}

export default function CategorySection({ 
    category, 
    items, 
    restaurantId, 
    onRefresh, 
    onEditCategory,
    onOpenItemDetails,
    dragHandle 
}: CategorySectionProps) {
    const [isCreating, setIsCreating] = useState(false);

    const handleCreateItem = async (partialItem: MenuItemType) => {
        const { error } = await supabase.from("items").insert({
            name: partialItem.name,
            description: partialItem.description,
            price_cents: partialItem.price_cents,
            image_path: partialItem.image_path,
            category_id: category.id,
            restaurant_id: restaurantId,
            is_available: true,
            position: items.length
        });
        if (error) throw error;
        setIsCreating(false);
        onRefresh();
    };

    const handleUpdateItem = async (updatedItem: MenuItemType) => {
        const { error } = await supabase
            .from("items")
            .update({
                name: updatedItem.name,
                description: updatedItem.description,
                price_cents: updatedItem.price_cents,
                image_path: updatedItem.image_path,
                is_available: updatedItem.is_available
            })
            .eq("id", updatedItem.id);
        if (error) throw error;
        onRefresh();
    };

    const handleDeleteItem = async (id: string) => {
        const { error } = await supabase.from("items").delete().eq("id", id);
        if (error) { alert("Erro ao deletar item."); return; }
        onRefresh();
    };

    // --- NOVA FUNÇÃO: DUPLICAR ---
    const handleDuplicateItem = async (originalItem: MenuItemType) => {
        // Copia os dados básicos
        const { error } = await supabase.from("items").insert({
            name: `${originalItem.name} (Cópia)`,
            description: originalItem.description,
            price_cents: originalItem.price_cents,
            image_path: originalItem.image_path, // Reusa a mesma imagem
            category_id: category.id,
            restaurant_id: restaurantId,
            is_available: false, // Começa pausado por segurança
            position: items.length // Fim da lista
        });

        if (error) {
            alert("Erro ao duplicar item.");
            console.error(error);
        } else {
            onRefresh();
        }
        // Nota: Para duplicar os complementos (subitems), precisaríamos de uma query mais complexa
        // ou uma procedure no banco. Por enquanto, duplicamos apenas o item base.
    };

    return (
        <div className="mb-10 animate-fadeUp">
            <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-3">
                    {dragHandle && (
                        <div className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 p-1">
                            {dragHandle}
                        </div>
                    )}
                    <h3 className="text-xl font-bold text-gray-800 tracking-tight">{category.name}</h3>
                </div>
                
                <button onClick={onEditCategory} className="text-xs font-medium text-gray-400 hover:text-brand transition-colors cursor-pointer">
                    Editar categoria
                </button>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                {items.map((item) => (
                    <MenuItemRow
                        key={item.id}
                        item={item}
                        onSave={handleUpdateItem}
                        onDelete={handleDeleteItem}
                        onOpenDetails={() => onOpenItemDetails(item)}
                        onDuplicate={handleDuplicateItem} // <--- PASSANDO A FUNÇÃO
                    />
                ))}

                {isCreating && (
                    <MenuItemRow
                        item={{ id: "new", name: "", price_cents: 0, is_available: true, category_id: category.id }}
                        isNew={true}
                        onSave={handleCreateItem}
                        onCancel={() => setIsCreating(false)}
                    />
                )}

                {!isCreating && (
                    <button onClick={() => setIsCreating(true)} className="cursor-pointer w-full py-4 px-4 text-left text-brand text-sm font-semibold hover:bg-orange-50/50 transition-colors flex items-center gap-3 group">
                        <div className="w-5 h-5 rounded-full border-2 border-brand flex items-center justify-center">
                            <FontAwesomeIcon icon={icons.faPlus} className="text-[10px]" />
                        </div>
                        Adicionar item em <span className="underline decoration-brand/30 group-hover:decoration-brand">{category.name}</span>
                    </button>
                )}
            </div>
        </div>
    );
}