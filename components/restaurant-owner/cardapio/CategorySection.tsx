"use client";

import { useState, ReactNode, useEffect, useRef, useCallback } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { icons } from "@/lib/utils/fontawesome";
import { faGripVertical, faStar } from "@fortawesome/free-solid-svg-icons";
import { supabase } from "@/lib/database/supabaseClient";
import Tooltip from "@/components/ui/Tooltip";
import MenuItemRow, { MenuItemType } from "./MenuItemRow";

interface CategorySectionProps {
    category: { id: string; name: string };
    items: MenuItemType[];
    restaurantId: string;
    onRefresh: () => void;
    onItemUpdated: (item: MenuItemType) => void;
    onEditCategory?: () => void;
    onOpenItemDetails: (item: MenuItemType) => void;
    isFeatured?: boolean;
    dragHandle?: ReactNode;
}

export default function CategorySection({
    category,
    items,
    restaurantId,
    onRefresh,
    onItemUpdated,
    onEditCategory,
    onOpenItemDetails,
    isFeatured = false,
    dragHandle
}: CategorySectionProps) {
    const [isCreating, setIsCreating] = useState(false);
    const [localItems, setLocalItems] = useState<MenuItemType[]>(items);
    const [mobileDragPreview, setMobileDragPreview] = useState<{ name: string; x: number; y: number } | null>(null);
    const localItemsRef = useRef<MenuItemType[]>(items);
    const draggedItemIdRef = useRef<string | null>(null);
    const activePointerIdRef = useRef<number | null>(null);

    useEffect(() => {
        setLocalItems(items);
        localItemsRef.current = items;
    }, [items]);

    const reorderItem = useCallback((targetItemId: string) => {
        const draggedItemId = draggedItemIdRef.current;
        if (!draggedItemId || draggedItemId === targetItemId) return;

        const currentList = [...localItemsRef.current];
        const draggedIndex = currentList.findIndex((item) => item.id === draggedItemId);
        const targetIndex = currentList.findIndex((item) => item.id === targetItemId);
        if (draggedIndex === -1 || targetIndex === -1) return;

        const [removed] = currentList.splice(draggedIndex, 1);
        currentList.splice(targetIndex, 0, removed);

        const updatedList = currentList.map((item, index) => ({ ...item, position: index }));
        localItemsRef.current = updatedList;
        setLocalItems(updatedList);
    }, []);

    const saveItemOrder = useCallback(async (finalList: MenuItemType[]) => {
        try {
            const results = await Promise.all(
                finalList.map((item) =>
                    supabase.from("items").update({ position: item.position }).eq("id", item.id)
                )
            );
            const failed = results.find((result) => result.error);
            if (failed?.error) throw failed.error;
        } catch (error) {
            console.error("Erro ao salvar ordem dos itens:", error);
        }
    }, []);

    const finishMobileDrag = useCallback((pointerId?: number) => {
        if (
            pointerId !== undefined &&
            activePointerIdRef.current !== null &&
            activePointerIdRef.current !== pointerId
        ) return;

        const wasDragging = Boolean(draggedItemIdRef.current);
        draggedItemIdRef.current = null;
        activePointerIdRef.current = null;
        setMobileDragPreview(null);
        if (wasDragging) void saveItemOrder(localItemsRef.current);
    }, [saveItemOrder]);

    useEffect(() => {
        const handleMove = (event: PointerEvent) => {
            if (
                activePointerIdRef.current !== event.pointerId ||
                !draggedItemIdRef.current ||
                isCreating
            ) return;

            setMobileDragPreview((current) => current ? { ...current, x: event.clientX, y: event.clientY } : current);
            const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-menu-item-id]");
            const targetItemId = target?.dataset.menuItemId;
            if (targetItemId) reorderItem(targetItemId);
        };

        const handleEnd = (event: PointerEvent) => finishMobileDrag(event.pointerId);
        const handleBlur = () => finishMobileDrag();
        const handleVisibilityChange = () => {
            if (document.hidden) finishMobileDrag();
        };

        window.addEventListener("pointermove", handleMove);
        window.addEventListener("pointerup", handleEnd);
        window.addEventListener("pointercancel", handleEnd);
        window.addEventListener("blur", handleBlur);
        document.addEventListener("visibilitychange", handleVisibilityChange);

        return () => {
            window.removeEventListener("pointermove", handleMove);
            window.removeEventListener("pointerup", handleEnd);
            window.removeEventListener("pointercancel", handleEnd);
            window.removeEventListener("blur", handleBlur);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
        };
    }, [finishMobileDrag, isCreating, reorderItem]);

    const handleDragStart = (e: React.DragEvent, itemId: string) => {
        e.stopPropagation();
        draggedItemIdRef.current = itemId;
        e.dataTransfer.effectAllowed = "move";

        const emptyImg = new Image();
        emptyImg.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBAAA7";
        e.dataTransfer.setDragImage(emptyImg, 0, 0);
    };

    const handleDragEnd = (e: React.DragEvent) => {
        e.stopPropagation();
        draggedItemIdRef.current = null;
        void saveItemOrder(localItemsRef.current);
    };

    const handleDragOver = (e: React.DragEvent, targetItemId: string) => {
        e.preventDefault();
        e.stopPropagation();
        reorderItem(targetItemId);
    };

    const handlePointerStart = (e: React.PointerEvent<HTMLSpanElement>, itemId: string) => {
        if (e.pointerType === "mouse" || isCreating || activePointerIdRef.current !== null) return;
        e.stopPropagation();
        activePointerIdRef.current = e.pointerId;
        draggedItemIdRef.current = itemId;
        const item = localItemsRef.current.find((current) => current.id === itemId);
        if (item) setMobileDragPreview({ name: item.name, x: e.clientX, y: e.clientY });
    };

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

        const nextItems = localItemsRef.current.map((item) =>
            item.id === updatedItem.id ? { ...item, ...updatedItem } : item
        );
        localItemsRef.current = nextItems;
        setLocalItems(nextItems);
        onItemUpdated(updatedItem);
    };

    const handleDeleteItem = async (id: string) => {
        const { error } = await supabase.from("items").delete().eq("id", id);
        if (error) {
            alert("Erro ao deletar item.");
            return;
        }
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
            {mobileDragPreview && (
                <div
                    className="pointer-events-none fixed z-[9999] flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 font-medium text-gray-900 shadow-xl opacity-95 md:hidden"
                    style={{ left: mobileDragPreview.x + 12, top: mobileDragPreview.y + 12 }}
                >
                    <FontAwesomeIcon icon={faGripVertical} className="text-gray-400" />
                    <span className="truncate">{mobileDragPreview.name}</span>
                </div>
            )}

            <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-3">
                    {dragHandle && (
                        <div className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 p-1">
                            {dragHandle}
                        </div>
                    )}
                    <h3 className="text-xl font-bold text-gray-800 tracking-tight">{category.name}</h3>
                    {isFeatured && (
                        <Tooltip text="A primeira categoria é destacada no cardápio." position="right" showOnClick>
                            <FontAwesomeIcon icon={faStar} className="text-brand text-sm cursor-help" />
                        </Tooltip>
                    )}
                </div>

                <button onClick={onEditCategory} className="text-xs 2xl:text-base font-medium text-gray-400 hover:text-brand transition-colors cursor-pointer">
                    Editar categoria
                </button>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl 2xl:mt-4 overflow-hidden shadow-sm 2xl:shadow-lg">
                {localItems.map((item) => (
                    <div
                        key={item.id}
                        data-menu-item-id={item.id}
                        draggable={!isCreating}
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
                            dragHandle={!isCreating ? (
                                <span
                                    className="inline-flex touch-none"
                                    onPointerDown={(e) => handlePointerStart(e, item.id)}
                                >
                                    <FontAwesomeIcon icon={faGripVertical} className="text-sm" />
                                </span>
                            ) : null}
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