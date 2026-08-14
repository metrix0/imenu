"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faGripVertical,
    faLayerGroup,
    faPlus,
    faSearch,
    faWandMagicSparkles,
} from "@fortawesome/free-solid-svg-icons";
import { supabase } from "@/lib/database/supabaseClient";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Dropdown from "@/components/ui/Dropdown";
import CategorySection from "@/components/restaurant-owner/cardapio/CategorySection";
import OrganizeCategoriesModal from "@/components/restaurant-owner/cardapio/OrganizeCategoriesModal";
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
    onAIScanMenu,
}: CardapioTabProps) {
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedCategoryId, setSelectedCategoryId] = useState("");
    const [localCategories, setLocalCategories] = useState<Category[]>(categories);
    const [draggedCatId, setDraggedCatId] = useState<string | null>(null);
    const [mobileDragPreview, setMobileDragPreview] = useState<{
        name: string;
        x: number;
        y: number;
    } | null>(null);
    const [organizerOpen, setOrganizerOpen] = useState(false);
    const [organizerSaving, setOrganizerSaving] = useState(false);

    const localCategoriesRef = useRef<Category[]>(categories);
    const mobileDraggedCatIdRef = useRef<string | null>(null);
    const activePointerIdRef = useRef<number | null>(null);
    const mobilePointerStartRef = useRef<{ x: number; y: number } | null>(null);
    const mobileDidMoveRef = useRef(false);
    const desktopDidDragRef = useRef(false);
    const normalizedRestaurantRef = useRef<string | null>(null);

    useEffect(() => {
        const featured = categories.find((category) => category.position === 1);
        const visibleOrder =
            featured && categories[0]?.id !== featured.id
                ? [
                      featured,
                      ...categories.filter(
                          (category) => category.id !== featured.id
                      ),
                  ]
                : categories;
        const normalized = visibleOrder.map((category, index) => ({
            ...category,
            position: index + 1,
        }));

        setLocalCategories(normalized);
        localCategoriesRef.current = normalized;

        const needsNormalization =
            categories.length === normalized.length &&
            categories.some(
                (category, index) =>
                    category.id !== normalized[index]?.id ||
                    category.position !== index + 1
            );

        if (
            needsNormalization &&
            normalizedRestaurantRef.current !== restaurantId
        ) {
            normalizedRestaurantRef.current = restaurantId;
            void Promise.all(
                normalized.map((category) =>
                    supabase
                        .from("categories")
                        .update({ position: category.position })
                        .eq("id", category.id)
                )
            ).then((results) => {
                const failed = results.find((result) => result.error);
                if (failed?.error) {
                    console.error(
                        "Erro ao normalizar ordem das categorias:",
                        failed.error
                    );
                }
            });
        }
    }, [categories, restaurantId]);

    const isFiltering = searchTerm.length > 0 || selectedCategoryId !== "";

    const saveOrder = useCallback(async (finalList: Category[]) => {
        try {
            const normalized = finalList.map((category, index) => ({
                ...category,
                position: index + 1,
            }));
            const results = await Promise.all(
                normalized.map((category) =>
                    supabase
                        .from("categories")
                        .update({ position: category.position })
                        .eq("id", category.id)
                )
            );
            const failed = results.find((result) => result.error);
            if (failed?.error) throw failed.error;
        } catch (error) {
            console.error("Erro ao salvar ordem das categorias:", error);
            throw error;
        }
    }, []);

    const handleDragStart = (e: React.DragEvent, catId: string) => {
        desktopDidDragRef.current = true;
        setDraggedCatId(catId);
        e.dataTransfer.effectAllowed = "move";
        const target = e.currentTarget as HTMLElement;
        setTimeout(() => {
            target.style.opacity = "0.4";
        }, 0);
    };

    const handleDragEnd = (e: React.DragEvent) => {
        const target = e.currentTarget as HTMLElement;
        target.style.opacity = "1";
        setDraggedCatId(null);
        window.setTimeout(() => {
            desktopDidDragRef.current = false;
        }, 0);
    };

    const handleDragOver = (e: React.DragEvent, targetCatId: string) => {
        e.preventDefault();
        if (!draggedCatId || draggedCatId === targetCatId) return;

        const currentList = [...localCategories];
        const draggedIndex = currentList.findIndex(
            (category) => category.id === draggedCatId
        );
        const targetIndex = currentList.findIndex(
            (category) => category.id === targetCatId
        );
        if (draggedIndex === -1 || targetIndex === -1) return;

        const [removed] = currentList.splice(draggedIndex, 1);
        currentList.splice(targetIndex, 0, removed);
        const updatedList = currentList.map((category, index) => ({
            ...category,
            position: index + 1,
        }));
        setLocalCategories(updatedList);
        localCategoriesRef.current = updatedList;
    };

    const handleFinalDragEnd = (e: React.DragEvent) => {
        handleDragEnd(e);
        void saveOrder(localCategoriesRef.current);
    };

    const reorderMobileCategory = useCallback((targetCatId: string) => {
        const draggedCatId = mobileDraggedCatIdRef.current;
        if (!draggedCatId || draggedCatId === targetCatId) return;

        const currentList = [...localCategoriesRef.current];
        const draggedIndex = currentList.findIndex(
            (category) => category.id === draggedCatId
        );
        const targetIndex = currentList.findIndex(
            (category) => category.id === targetCatId
        );
        if (draggedIndex === -1 || targetIndex === -1) return;

        const [removed] = currentList.splice(draggedIndex, 1);
        currentList.splice(targetIndex, 0, removed);
        const updatedList = currentList.map((category, index) => ({
            ...category,
            position: index + 1,
        }));
        localCategoriesRef.current = updatedList;
        setLocalCategories(updatedList);
    }, []);

    const finishMobileDrag = useCallback(
        (pointerId?: number) => {
            if (
                pointerId !== undefined &&
                activePointerIdRef.current !== null &&
                activePointerIdRef.current !== pointerId
            ) {
                return;
            }

            const wasDragging = Boolean(mobileDraggedCatIdRef.current);
            mobileDraggedCatIdRef.current = null;
            activePointerIdRef.current = null;
            mobilePointerStartRef.current = null;
            setMobileDragPreview(null);
            if (wasDragging && mobileDidMoveRef.current) {
                void saveOrder(localCategoriesRef.current);
            }

            window.setTimeout(() => {
                mobileDidMoveRef.current = false;
            }, 0);
        },
        [saveOrder]
    );

    useEffect(() => {
        const handleMove = (event: PointerEvent) => {
            if (
                activePointerIdRef.current !== event.pointerId ||
                !mobileDraggedCatIdRef.current
            ) {
                return;
            }

            const start = mobilePointerStartRef.current;
            if (
                start &&
                Math.hypot(
                    event.clientX - start.x,
                    event.clientY - start.y
                ) > 6
            ) {
                mobileDidMoveRef.current = true;
            }

            if (!mobileDidMoveRef.current) return;

            setMobileDragPreview((current) =>
                current
                    ? { ...current, x: event.clientX, y: event.clientY }
                    : current
            );
            const target = document
                .elementFromPoint(event.clientX, event.clientY)
                ?.closest<HTMLElement>("[data-category-id]");
            const targetCatId = target?.dataset.categoryId;
            if (targetCatId) reorderMobileCategory(targetCatId);
        };

        const handleEnd = (event: PointerEvent) =>
            finishMobileDrag(event.pointerId);
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
            document.removeEventListener(
                "visibilitychange",
                handleVisibilityChange
            );
        };
    }, [finishMobileDrag, reorderMobileCategory]);

    const openOrganizer = () => setOrganizerOpen(true);

    const handlePointerStart = (
        e: React.PointerEvent<HTMLSpanElement>,
        catId: string
    ) => {
        if (
            e.pointerType === "mouse" ||
            isFiltering ||
            activePointerIdRef.current !== null
        ) {
            return;
        }

        e.stopPropagation();
        activePointerIdRef.current = e.pointerId;
        mobileDraggedCatIdRef.current = catId;
        mobilePointerStartRef.current = { x: e.clientX, y: e.clientY };
        mobileDidMoveRef.current = false;
        const category = localCategoriesRef.current.find(
            (current) => current.id === catId
        );
        if (category) {
            setMobileDragPreview({
                name: category.name,
                x: e.clientX,
                y: e.clientY,
            });
        }
    };

    const handleHandleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
    };

    const saveOrganizerOrder = async (orderedCategories: Category[]) => {
        if (organizerSaving) return;
        setOrganizerSaving(true);

        const normalized = orderedCategories.map((category, index) => ({
            ...category,
            position: index + 1,
        }));

        try {
            await saveOrder(normalized);
            setLocalCategories(normalized);
            localCategoriesRef.current = normalized;
            setOrganizerOpen(false);
        } finally {
            setOrganizerSaving(false);
        }
    };

    const displayCategories = localCategories.filter((category) => {
        const matchesSearch = category.name
            .toLowerCase()
            .includes(searchTerm.toLowerCase());
        const matchesSelect = selectedCategoryId
            ? category.id === selectedCategoryId
            : true;
        return matchesSearch && matchesSelect;
    });

    if (categories.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-lg border border-gray-100 shadow-sm">
                <div className="w-40 h-40 bg-red-50 rounded-full flex items-center justify-center mb-6">
                    <FontAwesomeIcon
                        icon={faLayerGroup}
                        className="text-5xl text-brand/50"
                    />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2 2xl:text-xl">
                    Você ainda não possui nenhuma categoria criada
                </h3>
                <p className="text-gray-500 text-sm mb-8 text-center max-w-md 2xl:text-base">
                    Adicione uma categoria agora mesmo clicando no botão
                    &quot;Adicionar categoria&quot;
                </p>
                <div className="flex gap-4">
                    <Button
                        variant="secondary"
                        onClick={onNewCategory}
                        className="text-brand border-brand/20 hover:bg-brand/5"
                    >
                        <FontAwesomeIcon icon={faPlus} className="mr-2" />
                        Adicionar categoria
                    </Button>
                    <Button
                        onClick={() => onAIScanMenu?.(true)}
                        variant="secondary"
                    >
                        <FontAwesomeIcon
                            icon={faWandMagicSparkles}
                            className="text-sm mr-2"
                        />{" "}
                        Scanear Cardápio com IA
                    </Button>
                </div>
            </div>
        );
    }

    const categoryOptions = [
        { value: "", label: "Todas as categorias" },
        ...categories.map((category) => ({
            value: category.id,
            label: category.name,
        })),
    ];

    return (
        <div className="w-full min-w-0 max-w-full space-y-6 overflow-x-clip">
            {mobileDragPreview && mobileDidMoveRef.current && (
                <div
                    className="pointer-events-none fixed z-[9999] flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 font-bold text-gray-800 shadow-xl opacity-95 md:hidden"
                    style={{
                        left: mobileDragPreview.x + 12,
                        top: mobileDragPreview.y + 12,
                    }}
                >
                    <FontAwesomeIcon
                        icon={faGripVertical}
                        className="text-gray-400"
                    />
                    <span className="truncate">{mobileDragPreview.name}</span>
                </div>
            )}

            <div className="grid min-w-0 max-w-full grid-cols-2 gap-4 md:flex md:flex-row">
                <div className="col-span-2 min-w-0 flex-1">
                    <Input
                        placeholder="Buscar uma categoria"
                        icon={<FontAwesomeIcon icon={faSearch} />}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="col-span-2 w-full min-w-0 md:w-64">
                    <Dropdown
                        options={categoryOptions}
                        value={selectedCategoryId}
                        onChange={(e) => setSelectedCategoryId(e.target.value)}
                    />
                </div>
                <Button
                    variant="secondary"
                    onClick={onNewCategory}
                    className="w-full min-w-0 whitespace-nowrap md:w-auto"
                >
                    <span className="md:hidden">Adicionar categ.</span>
                    <span className="hidden md:inline">Adicionar categoria</span>
                </Button>
                <Button
                    variant="secondary"
                    onClick={openOrganizer}
                    className="w-full min-w-0 whitespace-nowrap md:w-auto"
                >
                    <span className="md:hidden">Organizar categ.</span>
                    <span className="hidden md:inline">Organizar categorias</span>
                </Button>
            </div>

            <div className="min-w-0 max-w-full space-y-4 overflow-x-clip">
                {displayCategories.map((category) => (
                    <div
                        key={category.id}
                        data-category-id={category.id}
                        draggable={!isFiltering}
                        onDragStart={(e) => handleDragStart(e, category.id)}
                        onDragOver={(e) => handleDragOver(e, category.id)}
                        onDragEnd={handleFinalDragEnd}
                        className="min-w-0 max-w-full overflow-hidden transition-transform"
                    >
                        <CategorySection
                            category={category}
                            items={items.filter(
                                (item) => item.category_id === category.id
                            )}
                            restaurantId={restaurantId}
                            onRefresh={onRefresh}
                            onItemUpdated={onItemUpdated}
                            onEditCategory={() => onEditCategory(category)}
                            onOpenItemDetails={onOpenItemDetails}
                            isFeatured={localCategories[0]?.id === category.id}
                            dragHandle={
                                !isFiltering ? (
                                    <span
                                        className="inline-flex touch-none"
                                        onPointerDown={(e) =>
                                            handlePointerStart(e, category.id)
                                        }
                                        onClick={handleHandleClick}
                                    >
                                        <FontAwesomeIcon icon={faGripVertical} />
                                    </span>
                                ) : null
                            }
                        />
                    </div>
                ))}

                {displayCategories.length === 0 && (
                    <p className="py-10 text-center text-gray-500">
                        Nenhuma categoria encontrada.
                    </p>
                )}
            </div>

            <OrganizeCategoriesModal
                open={organizerOpen}
                categories={localCategories}
                saving={organizerSaving}
                onClose={() => setOrganizerOpen(false)}
                onSave={saveOrganizerOrder}
            />
        </div>
    );
}
