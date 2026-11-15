"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PanelIcon as FontAwesomeIcon } from "@/components/ui/PanelIcon";
import {
    faArrowDown,
    faArrowUp,
    faGripVertical,
} from "@fortawesome/free-solid-svg-icons";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import SaveStatus, { type SaveState } from "@/components/ui/SaveStatus";

type Category = {
    id: string;
    name: string;
    position: number;
};

type OrganizeCategoriesModalProps = {
    open: boolean;
    categories: Category[];
    saving?: boolean;
    onClose: () => void;
    title?: string;
    description?: string;
} & (
    | { onSave: (categories: Category[]) => Promise<void> | void; onReorder?: never; status?: never; error?: never }
    | { onSave?: never; onReorder: (categories: Category[]) => void; status: SaveState; error?: string }
);

export default function OrganizeCategoriesModal({
    open,
    categories,
    saving = false,
    onClose,
    onSave,
    onReorder,
    status = "idle",
    error,
    title = "Organizar categorias",
    description = "Arraste as categorias para definir a ordem em que aparecem no cardápio.",
}: OrganizeCategoriesModalProps) {
    const [orderedCategories, setOrderedCategories] = useState<Category[]>([]);
    const [draggedId, setDraggedId] = useState<string | null>(null);
    const draggedIdRef = useRef<string | null>(null);
    const pointerIdRef = useRef<number | null>(null);
    const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
    const pointerMovedRef = useRef(false);
    const draftRef = useRef<Category[]>([]);

    useEffect(() => {
        if (!open) return;
        draftRef.current = categories.map((category, index) => ({
            ...category,
            position: index + 1,
        }));
        setOrderedCategories(draftRef.current);
        setDraggedId(null);
        draggedIdRef.current = null;
        pointerIdRef.current = null;
        pointerStartRef.current = null;
        pointerMovedRef.current = false;
    }, [open, categories]);

    const moveCategory = useCallback((from: number, to: number) => {
        const next = [...draftRef.current];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        draftRef.current = next.map((category, index) => ({ ...category, position: index + 1 }));
        setOrderedCategories(draftRef.current);
    }, []);

    const reorderCategory = useCallback((targetId: string) => {
        const currentDraggedId = draggedIdRef.current;
        if (!currentDraggedId || currentDraggedId === targetId) return;

        const from = draftRef.current.findIndex(category => category.id === currentDraggedId);
        const to = draftRef.current.findIndex(category => category.id === targetId);
        if (from !== -1 && to !== -1) moveCategory(from, to);
    }, [moveCategory]);

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

            if (pointerMovedRef.current) onReorder?.(draftRef.current);
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
    }, [open, onReorder, reorderCategory]);

    const moveWithButton = (index: number, delta: number) => {
        const targetIndex = index + delta;
        if (targetIndex < 0 || targetIndex >= orderedCategories.length) return;
        moveCategory(index, targetIndex);
        onReorder?.(draftRef.current);
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
        <Modal height={580}
            fixedHeight
            open={open}
            onClose={() => {
                if (!saving && status !== "saving") onClose();
            }}
            className="max-w-lg !overflow-hidden"
            bodyClassName="flex min-h-0 flex-1 flex-col !overflow-hidden"
        >
            <div className="flex h-full min-h-0 flex-col p-5 sm:p-6">
                <div className="mb-5 shrink-0">
                    <div className="flex items-start justify-between gap-3">
                        <h2 className="text-xl font-bold text-gray-900">{title}</h2>
                        {onReorder && <SaveStatus status={status} />}
                    </div>
                    <p className="mt-1 text-sm text-gray-500">
                        {description}
                    </p>
                    {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
                </div>

                <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
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
                                    onClick={() => moveWithButton(index, -1)}
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
                                    onClick={() => moveWithButton(index, 1)}
                                    className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-30"
                                >
                                    <FontAwesomeIcon icon={faArrowDown} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="mt-6 flex shrink-0 justify-end gap-3">
                    <Button
                        variant="secondary"
                        onClick={onClose}
                        disabled={saving || status === "saving"}
                    >
                        {onReorder ? "Concluir" : "Cancelar"}
                    </Button>
                    {onSave && <Button
                        onClick={() => void onSave(orderedCategories)}
                        disabled={saving}
                    >
                        {saving ? "Salvando..." : "Salvar ordem"}
                    </Button>}
                </div>
            </div>
        </Modal>
    );
}
