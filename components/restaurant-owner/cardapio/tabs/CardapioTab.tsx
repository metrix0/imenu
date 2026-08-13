"use client";

import { useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {faSearch, faLayerGroup, faPlus, faGripVertical, faWandMagicSparkles} from "@fortawesome/free-solid-svg-icons";
import { supabase } from "@/lib/database/supabaseClient";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Dropdown from "@/components/ui/Dropdown";
import CategorySection from "@/components/restaurant-owner/cardapio/CategorySection";
import { MenuItemType } from "@/components/restaurant-owner/cardapio/MenuItemRow";

type Category = { id: string; name: string; position: number };

interface CardapioTabProps {
    categories: Category[];
    items: MenuItemType[];
    restaurantId: string;
    onRefresh: () => void;
    onItemUpdated: (item: MenuItemType) => void;
    onEditCategory: (cat: Category) => void;
    onOpenItemDetails: (item: MenuItemType) => void;
    onNewCategory: () => void;
    onAIScanMenu?: React.Dispatch<React.SetStateAction<boolean>> | (() => void);
}

export default function CardapioTab({
    categories,
    items,
    restaurantId,
    onRefresh,
    onItemUpdated,
    onEditCategory,
    onOpenItemDetails,
    onNewCategory,
    onAIScanMenu
}: CardapioTabProps) {
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedCategoryId, setSelectedCategoryId] = useState("");
    const [localCategories, setLocalCategories] = useState<Category[]>(categories);
    const [mobileDragPreview, setMobileDragPreview] = useState<{ name: string; x: number; y: number } | null>(null);
    const localCategoriesRef = useRef<Category[]>(categories);
    const draggedCatIdRef = useRef<string | null>(null);
    const normalizedRestaurantRef = useRef<string | null>(null);

    useEffect(() => {
        const featured = categories.find((category) => category.position === 1);
        const visibleOrder = featured && categories[0]?.id !== featured.id
            ? [featured, ...categories.filter((category) => category.id !== featured.id)]
            : categories;
        const normalized = visibleOrder.map((category, index) => ({ ...category, position: index + 1 }));

        setLocalCategories(normalized);
        localCategoriesRef.current = normalized;

        const needsNormalization = categories.length === normalized.length && categories.some(
            (category, index) => category.id !== normalized[index]?.id || category.position !== index + 1
        );

        if (needsNormalization && normalizedRestaurantRef.current !== restaurantId) {
            normalizedRestaurantRef.current = restaurantId;
            void Promise.all(
                normalized.map((category) =>
                    supabase.from("categories").update({ position: category.position }).eq("id", category.id)
                )
            ).then((results) => {
                const failed = results.find((result) => result.error);
                if (failed?.error) console.error("Erro ao normalizar ordem das categorias:", failed.error);
            });
        }
    }, [categories, restaurantId]);

    const isFiltering = searchTerm.length > 0 || selectedCategoryId !== "";

    const reorderCategory = (targetCatId: string) => {
        const draggedCatId = draggedCatIdRef.current;
        if (!draggedCatId || draggedCatId === targetCatId) return;
        const currentList = [...localCategoriesRef.current];
        const draggedIndex = currentList.findIndex((category) => category.id === draggedCatId);
        const targetIndex = currentList.findIndex((category) => category.id === targetCatId);
        if (draggedIndex === -1 || targetIndex === -1) return;

        const [removed] = currentList.splice(draggedIndex, 1);
        currentList.splice(targetIndex, 0, removed);
        const updatedList = currentList.map((category, index) => ({ ...category, position: index + 1 }));
        localCategoriesRef.current = updatedList;
        setLocalCategories(updatedList);
    };

    const saveOrder = async (finalList: Category[]) => {
        try {
            const normalized = finalList.map((category, index) => ({ ...category, position: index + 1 }));
            const results = await Promise.all(
                normalized.map((category) =>
                    supabase.from("categories").update({ position: category.position }).eq("id", category.id)
                )
            );
            const failed = results.find((result) => result.error);
            if (failed?.error) throw failed.error;
        } catch (error) {
            console.error("Erro ao salvar ordem das categorias:", error);
        }
    };

    const handleDragStart = (e: React.DragEvent, catId: string) => {
        draggedCatIdRef.current = catId;
        e.dataTransfer.effectAllowed = "move";
        const target = e.currentTarget as HTMLElement;
        setTimeout(() => target.style.opacity = "0.4", 0);
    };

    const handleDragEnd = (e: React.DragEvent) => {
        const target = e.currentTarget as HTMLElement;
        target.style.opacity = "1";
        draggedCatIdRef.current = null;
        void saveOrder(localCategoriesRef.current);
    };

    const handleDragOver = (e: React.DragEvent, targetCatId: string) => {
        e.preventDefault();
        reorderCategory(targetCatId);
    };

    const handlePointerStart = (e: React.PointerEvent<HTMLSpanElement>, catId: string) => {
        if (e.pointerType === "mouse" || isFiltering) return;
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        draggedCatIdRef.current = catId;
        const category = localCategoriesRef.current.find((current) => current.id === catId);
        if (category) setMobileDragPreview({ name: category.name, x: e.clientX, y: e.clientY });
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLSpanElement>) => {
        if (e.pointerType === "mouse" || !draggedCatIdRef.current || isFiltering) return;
        e.stopPropagation();
        setMobileDragPreview((current) => current ? { ...current, x: e.clientX, y: e.clientY } : current);
        const target = document
            .elementFromPoint(e.clientX, e.clientY)
            ?.closest<HTMLElement>("[data-category-id]");
        const targetCatId = target?.dataset.categoryId;
        if (targetCatId) reorderCategory(targetCatId);
    };

    const handlePointerEnd = (e: React.PointerEvent<HTMLSpanElement>) => {
        if (e.pointerType === "mouse" || !draggedCatIdRef.current || isFiltering) return;
        e.stopPropagation();
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId);
        }
        draggedCatIdRef.current = null;
        setMobileDragPreview(null);
        void saveOrder(localCategoriesRef.current);
    };

    const displayCategories = localCategories.filter((category) => {
        const matchesSearch = category.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesSelect = selectedCategoryId ? category.id === selectedCategoryId : true;
        return matchesSearch && matchesSelect;
    });

    if (categories.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-lg border border-gray-100 shadow-sm">
                <div className="w-40 h-40 bg-red-50 rounded-full flex items-center justify-center mb-6">
                    <FontAwesomeIcon icon={faLayerGroup} className="text-5xl text-brand/50" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2 2xl:text-xl">Você ainda não possui nenhuma categoria criada</h3>
                <p className="text-gray-500 text-sm mb-8 text-center max-w-md 2xl:text-base">
                    Adicione uma categoria agora mesmo clicando no botão "Adicionar categoria"
                </p>
                <div className="flex gap-4">
                    <Button variant="secondary" onClick={onNewCategory} className="text-brand border-brand/20 hover:bg-brand/5">
                        <FontAwesomeIcon icon={faPlus} className="mr-2" />
                        Adicionar categoria
                    </Button>
                    <Button onClick={() => onAIScanMenu?.(true)} variant="secondary">
                        <FontAwesomeIcon icon={faWandMagicSparkles} className="text-sm mr-2" /> Scanear Cardápio com IA
                    </Button>
                </div>
            </div>
        );
    }

    const categoryOptions = [
        { value: "", label: "Todas as categorias" },
        ...categories.map((category) => ({ value: category.id, label: category.name }))
    ];

    return (
        <div className="space-y-6">
            {mobileDragPreview && (
                <div
                    className="pointer-events-none fixed z-[9999] flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 font-bold text-gray-800 shadow-xl opacity-95 md:hidden"
                    style={{ left: mobileDragPreview.x + 12, top: mobileDragPreview.y + 12 }}
                >
                    <FontAwesomeIcon icon={faGripVertical} className="text-gray-400" />
                    <span className="truncate">{mobileDragPreview.name}</span>
                </div>
            )}

            <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                    <Input
                        placeholder="Buscar uma categoria"
                        icon={<FontAwesomeIcon icon={faSearch} />}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="w-full md:w-64">
                    <Dropdown
                        options={categoryOptions}
                        value={selectedCategoryId}
                        onChange={(e) => setSelectedCategoryId(e.target.value)}
                    />
                </div>
                <Button variant="secondary" onClick={onNewCategory} className="whitespace-nowrap">
                    Adicionar categoria
                </Button>
            </div>

            <div className="space-y-4">
                {displayCategories.map((category) => (
                    <div
                        key={category.id}
                        data-category-id={category.id}
                        draggable={!isFiltering}
                        onDragStart={(e) => handleDragStart(e, category.id)}
                        onDragOver={(e) => handleDragOver(e, category.id)}
                        onDragEnd={handleDragEnd}
                        className="transition-transform"
                    >
                        <CategorySection
                            category={category}
                            items={items.filter((item) => item.category_id === category.id)}
                            restaurantId={restaurantId}
                            onRefresh={onRefresh}
                            onItemUpdated={onItemUpdated}
                            onEditCategory={() => onEditCategory(category)}
                            onOpenItemDetails={onOpenItemDetails}
                            isFeatured={localCategories[0]?.id === category.id}
                            dragHandle={!isFiltering ? (
                                <span
                                    className="inline-flex touch-none"
                                    onPointerDown={(e) => handlePointerStart(e, category.id)}
                                    onPointerMove={handlePointerMove}
                                    onPointerUp={handlePointerEnd}
                                    onPointerCancel={handlePointerEnd}
                                >
                                    <FontAwesomeIcon icon={faGripVertical} />
                                </span>
                            ) : null}
                        />
                    </div>
                ))}

                {displayCategories.length === 0 && (
                    <p className="text-center text-gray-500 py-10">Nenhuma categoria encontrada.</p>
                )}
            </div>
        </div>
    );
}