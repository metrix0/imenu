"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faArrowDown,
    faArrowUp,
    faGripVertical,
} from "@fortawesome/free-solid-svg-icons";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";

type Category = {
    id: string;
    name: string;
    position: number;
};

interface OrganizeCategoriesModalProps {
    open: boolean;
    categories: Category[];
    saving?: boolean;
    onClose: () => void;
    onSave: (categories: Category[]) => Promise<void> | void;
}

export default function OrganizeCategoriesModal({
    open,
    categories,
    saving = false,
    onClose,
    onSave,
}: OrganizeCategoriesModalProps) {
    const [orderedCategories, setOrderedCategories] = useState<Category[]>([]);
    const [draggedId, setDraggedId] = useState<string | null>(null);
    const draggedIdRef = useRef<string | null>(null);
    const pointerIdRef = useRef<number | null>(null);
    const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
    const pointerMovedRef = useRef(false);

    useEffect(() => {
        if (!open) return;
        setOrderedCategories(
            categories.map((category, index) => ({
                ...category,
                position: index + 1,
            }))
        );
        setDraggedId(null);
        draggedIdRef.current = null;
        pointerIdRef.current = null;
        pointerStartRef.current = null;
        pointerMovedRef.current = false;
    }, [open, categories]);

    const reorderCategory = useCallback((targetId: string) => {
        const currentDraggedId = draggedIdRef.current;
        if (!currentDraggedId || currentDraggedId === targetId) return;

        setOrderedCategories((current) => {
            const draggedIndex = current.findIndex(
                (category) => category.id === currentDraggedId
            );
            const targetIndex = current.findIndex(
                (category) => category.id === targetId
            );
            if (draggedIndex === -1 || targetIndex === -1) return current;

            const next = [...current];
            const [moved] = next.splice(draggedIndex, 1);
            next.splice(targetIndex, 0, moved);
            return next.map((category, index) => ({
                ...category,
                position: index + 1,
            }));
        });
    }, []);

    useEffect(() => {
        if (!open) return;

        const handlePointerMove = (event: PointerEvent) => {
            if (
                pointerIdRef.current !== event.pointerId ||
                !draggedIdRef.current
            ) {
                return;
            }

            const start = pointerStartRef.current;
            if (
                start &&
                Math.hypot(
                    event.clientX - start.x,
                    event.clientY - start.y
                ) > 5
            ) {
                pointerMovedRef.current = true;
            }

            if (!pointerMovedRef.current) return;
            event.preventDefault();

            const target = document
                .elementFromPoint(event.clientX, event.clientY)
                ?.closest<HTMLElement>("[data-organizer-category-id]");
            const targetId = target?.dataset.organizerCategoryId;
            if (targetId) reorderCategory(targetId);
        };

        const finishPointerDrag = (event?: PointerEvent) => {
            if (
                event &&
                pointerIdRef.current !== null &&
                event.pointerId !== pointerIdRef.current
            ) {
                return;
            }

            pointerIdRef.current = null;
            pointerStartRef.current = null;
            pointerMovedRef.current = false;
            draggedIdRef.current = null;
            setDraggedId(null);
        };

        window.addEventListener("pointermove", handlePointerMove, {
            passive: false,
        });
        window.addEventListener("pointerup", finishPointerDrag);
        window.addEventListener("pointercancel", finishPointerDrag);

        return () => {
            window.removeEventListener("pointermove", handlePointerMove);
            window.removeEventListener("pointerup", finishPointerDrag);
            window.removeEventListener("pointercancel", finishPointerDrag);
        };
    }, [open, reorderCategory]);

    const moveCategory = (index: number, delta: number) => {
        const targetIndex = index + delta;
        if (targetIndex < 0 || targetIndex >= orderedCategories.length) return;

        setOrderedCategories((current) => {
            const next = [...current];
            const [moved] = next.splice(index, 1);
            next.splice(targetIndex, 0, moved);
            return next.map((category, nextIndex) => ({
                ...category,
                position: nextIndex + 1,
            }));
        });
    };

    const startPointerDrag = (
        event: React.PointerEvent<HTMLSpanElement>,
        categoryId: string
    ) => {
        if (saving || pointerIdRef.current !== null) return;
        event.preventDefault();
        event.stopPropagation();
        pointerIdRef.current = event.pointerId;
        pointerStartRef.current = {
            x: event.clientX,
            y: event.clientY,
        };
        pointerMovedRef.current = false;
        draggedIdRef.current = categoryId;
        setDraggedId(categoryId);
    };

    return (
        <Modal
            open={open}
            onClose={() => {
                if (!saving) onClose();
            }}
            className="max-w-lg"
        >
            <div className="p-5 sm:p-6">
                <div className="mb-5">
                    <h2 className="text-xl font-bold text-gray-900">
                        Organizar categorias
                    </h2>
                    <p className="mt-1 text-sm text-gray-500">
                        Arraste as categorias para definir a ordem em que aparecem no cardápio.
                    </p>
                </div>

                <div className="max-h-[55dvh] space-y-2 overflow-y-auto pr-1">
                    {orderedCategories.map((category, index) => (
                        <div
                            key={category.id}
                            data-organizer-category-id={category.id}
                            className={`flex min-w-0 items-center gap-3 rounded-xl border bg-white px-3 py-3 transition ${
                                draggedId === category.id
                                    ? "border-brand/40 opacity-60"
                                    : "border-gray-200"
                            }`}
                        >
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-500">
                                {index + 1}
                            </span>

                            <span
                                className="inline-flex touch-none cursor-grab items-center justify-center p-1 text-gray-400 active:cursor-grabbing"
                                onPointerDown={(event) =>
                                    startPointerDrag(event, category.id)
                                }
                            >
                                <FontAwesomeIcon icon={faGripVertical} />
                            </span>

                            <span className="min-w-0 flex-1 truncate font-medium text-gray-800">
                                {category.name}
                            </span>

                            <div className="flex shrink-0 gap-1">
                                <button
                                    type="button"
                                    aria-label={`Mover ${category.name} para cima`}
                                    disabled={saving || index === 0}
                                    onClick={() => moveCategory(index, -1)}
                                    className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-30"
                                >
                                    <FontAwesomeIcon icon={faArrowUp} />
                                </button>
                                <button
                                    type="button"
                                    aria-label={`Mover ${category.name} para baixo`}
                                    disabled={
                                        saving ||
                                        index === orderedCategories.length - 1
                                    }
                                    onClick={() => moveCategory(index, 1)}
                                    className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-30"
                                >
                                    <FontAwesomeIcon icon={faArrowDown} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="mt-6 flex justify-end gap-3">
                    <Button
                        variant="secondary"
                        onClick={onClose}
                        disabled={saving}
                    >
                        Cancelar
                    </Button>
                    <Button
                        onClick={() => void onSave(orderedCategories)}
                        disabled={saving}
                    >
                        {saving ? "Salvando..." : "Salvar ordem"}
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
