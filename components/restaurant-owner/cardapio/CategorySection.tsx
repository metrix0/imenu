"use client";

import { useState, ReactNode, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { icons } from "@/lib/fontawesome";
import { faGripVertical } from "@fortawesome/free-solid-svg-icons"; // Importando ícone
import { supabase } from "@/lib/database/supabaseClient";
import MenuItemRow, { MenuItemType } from "./MenuItemRow";

interface CategorySectionProps {
    category: { id: string; name: string };
    items: MenuItemType[];
    restaurantId: string;
    onRefresh: () => void;
    onEditCategory?: () => void;
    onOpenItemDetails: (item: MenuItemType) => void;
    dragHandle?: ReactNode; // Handle para a categoria
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
    
    // Estados locais para Drag & Drop dos ITENS
    const [localItems, setLocalItems] = useState<MenuItemType[]>(items);
    const [draggedItemId, setDraggedItemId] = useState<string | null>(null);

    // Sincroniza estado local quando as props mudam (ex: após refresh)
    useEffect(() => {
        setLocalItems(items);
    }, [items]);

    // --- LÓGICA DE DRAG & DROP DE ITENS ---
    const handleDragStart = (e: React.DragEvent, itemId: string) => {
        // e.stopPropagation() é crucial para não arrastar a Categoria inteira se ela também for draggable
        e.stopPropagation(); 
        setDraggedItemId(itemId);
        e.dataTransfer.effectAllowed = "move";

        // Tenta remover o "ghost" padrão do navegador (imagem transparente que segue o mouse)
        // Isso cria uma experiência mais "clean" onde os itens se reorganizam enquanto você arrasta
        // Se preferir ver o ghost, remova essas linhas.
        const emptyImg = new Image();
        emptyImg.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
        e.dataTransfer.setDragImage(emptyImg, 0, 0);
        // Efeito visual de opacidade
        setTimeout(() => {
             if (e.target instanceof HTMLElement) e.target.classList.add("opacity-10", "bg-gray-50");
        }, 0);
    };

    const handleDragEnd = (e: React.DragEvent) => {
        (e.target as HTMLElement).style.opacity = "1";
        setDraggedItemId(null);
        saveItemOrder(localItems); // Salva no banco ao soltar
    };

    const handleDragOver = (e: React.DragEvent, targetItemId: string) => {
        e.preventDefault();
        e.stopPropagation(); // Impede evento de subir para a categoria

        if (!draggedItemId || draggedItemId === targetItemId) return;

        const currentList = [...localItems];
        const draggedIndex = currentList.findIndex(i => i.id === draggedItemId);
        const targetIndex = currentList.findIndex(i => i.id === targetItemId);

        if (draggedIndex === -1 || targetIndex === -1) return;

        // Reordena o array localmente
        const [removed] = currentList.splice(draggedIndex, 1);
        currentList.splice(targetIndex, 0, removed);

        // Atualiza posições
        const updatedList = currentList.map((item, index) => ({ ...item, position: index }));
        setLocalItems(updatedList);
    };

    const saveItemOrder = async (finalList: MenuItemType[]) => {
        try {
            const updates = finalList.map(item => 
                supabase.from("items").update({ position: item.position }).eq("id", item.id)
            );
            await Promise.all(updates);
        } catch (error) { 
            console.error("Erro ao salvar ordem dos itens:", error); 
        }
    };

    // --- CRUD ITENS (Mantido) ---
    const handleCreateItem = async (partialItem: MenuItemType) => {
        const { error } = await supabase.from("items").insert({
            name: partialItem.name,
            description: partialItem.description,
            price_cents: partialItem.price_cents,
            image_path: partialItem.image_path,
            category_id: category.id,
            restaurant_id: restaurantId,
            is_available: true,
            position: items.length // Adiciona no fim
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

    const handleDuplicateItem = async (originalItem: MenuItemType) => {
        const { error } = await supabase.from("items").insert({
            name: `${originalItem.name} (Cópia)`,
            description: originalItem.description,
            price_cents: originalItem.price_cents,
            image_path: originalItem.image_path, 
            category_id: category.id,
            restaurant_id: restaurantId,
            is_available: false, 
            position: items.length 
        });

        if (error) {
            alert("Erro ao duplicar item.");
            console.error(error);
        } else {
            onRefresh();
        }
    };

    return (
        <div className="mb-10 animate-fadeUp">
            {/* Header da Categoria */}
            <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-3">
                    {/* Drag Handle da Categoria (passado pelo pai) */}
                    {dragHandle && (
                        <div className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 p-1">
                            {dragHandle}
                        </div>
                    )}
                    <h3 className="text-xl font-bold text-gray-800 tracking-tight">{category.name}</h3>
                </div>
                
                <button onClick={onEditCategory} className="text-xs 2xl:text-base font-medium text-gray-400 hover:text-brand transition-colors cursor-pointer">
                    Editar categoria
                </button>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl 2xl:mt-4 overflow-hidden shadow-sm 2xl:sadow-lg">
                {items.map((item) => (
                    <MenuItemRow
                        key={item.id}
                        draggable={!isCreating} // Desabilita drag durante criação
                        onDragStart={(e) => handleDragStart(e, item.id)}
                        onDragOver={(e) => handleDragOver(e, item.id)}
                        onDragEnd={handleDragEnd}
                        className="transition-transform duration-200"
                    >
                        <MenuItemRow
                            item={item}
                            onSave={handleUpdateItem}
                            onDelete={handleDeleteItem}
                            onOpenDetails={() => onOpenItemDetails(item)}
                            onDuplicate={handleDuplicateItem}
                            // Passa o ícone de drag para o item
                            dragHandle={!isCreating ? <FontAwesomeIcon icon={faGripVertical} className="text-sm" /> : null}
                        />
                    </div>
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
                    <button onClick={() => setIsCreating(true)} className="cursor-pointer 2xl:text-base w-full py-4 px-4 2xl:px-6 2xl:py-6 text-left text-brand text-sm font-semibold hover:bg-orange-50/50 transition-colors flex items-center gap-3 group">
                        <div className="w-5 h-5 2xl:w-6 2xl:h-6 rounded-full border-2 border-brand flex items-center justify-center">
                            <FontAwesomeIcon icon={icons.faPlus} className="text-[10px]" />
                        </div>
                        <div>
                            Adicionar item em <span className="underline decoration-brand/30 group-hover:decoration-brand ml-1">{category.name}</span>
                        </div>
                    </button>
                )}
            </div>
        </div>
    );
}