"use client";

import { supabase } from "@/lib/database/supabaseClient";
import Loader from "@/components/ui/Loader";
import { useEffect, useMemo, useRef, useState } from "react";

type ItemWithStock = {
    id: string;
    name: string;
    description?: string | null;
    price_cents: number;
    image_url?: string | null;
    stock_enabled?: boolean | null;
    stock_quantity?: number | null;
    is_available?: boolean | null;
};

type Category = {
    id: string;
    name: string;
    position?: number | null;
};

type StockUpdates = {
    stock_enabled?: boolean;
    stock_quantity?: number | null;
    is_available?: boolean;
};

export default function EstoqueTab({
    items,
    categories,
    restaurantId,
    onStockUpdated,
    onToast,
}: {
    items: ItemWithStock[];
    categories: Category[];
    restaurantId: string;
    onStockUpdated: (itemId: string, updates: StockUpdates) => void;
    onToast: (
        message: string,
        type?: "success" | "error" | "info"
    ) => void;
}) {
    const [savingId, setSavingId] = useState<string | null>(null);
    const [draftStock, setDraftStock] = useState<Record<string, string>>({});
    const stockSaveTimersRef = useRef<
        Record<string, ReturnType<typeof setTimeout>>
    >({});
    const pendingStockRef = useRef<Record<string, string>>({});

    const itemsByCategory = useMemo(() => {
        const grouped: Record<string, ItemWithStock[]> = {};

        for (const item of items) {
            const categoryId = (item as any).category_id;
            if (!categoryId) continue;
            if (!grouped[categoryId]) grouped[categoryId] = [];
            grouped[categoryId].push(item);
        }

        for (const key of Object.keys(grouped)) {
            grouped[key].sort((a: any, b: any) => {
                const posA = a.position ?? 0;
                const posB = b.position ?? 0;
                if (posA !== posB) return posA - posB;
                return a.name.localeCompare(b.name);
            });
        }

        return grouped;
    }, [items]);

    useEffect(() => {
        setDraftStock((current) => {
            let changed = false;
            const next = { ...current };

            for (const [itemId, value] of Object.entries(current)) {
                const item = items.find((candidate) => candidate.id === itemId);
                if (!item) continue;
                if (String(item.stock_quantity ?? 0) === value.trim()) {
                    delete next[itemId];
                    changed = true;
                }
            }

            return changed ? next : current;
        });
    }, [items]);

    const getDraftValue = (item: ItemWithStock) => {
        if (draftStock[item.id] !== undefined) return draftStock[item.id];
        return String(item.stock_quantity ?? 0);
    };

    const clearStockSaveTimer = (itemId: string) => {
        const timer = stockSaveTimersRef.current[itemId];
        if (!timer) return;
        clearTimeout(timer);
        delete stockSaveTimersRef.current[itemId];
    };

    const flushPendingStockSaves = () => {
        Object.values(stockSaveTimersRef.current).forEach((timer) =>
            clearTimeout(timer)
        );
        stockSaveTimersRef.current = {};

        for (const [itemId, rawValue] of Object.entries(
            pendingStockRef.current
        )) {
            const raw = rawValue.trim();
            const parsed = Number(raw);
            if (
                raw === "" ||
                Number.isNaN(parsed) ||
                parsed < 0 ||
                !Number.isInteger(parsed)
            ) {
                continue;
            }

            void supabase
                .from("items")
                .update({
                    stock_quantity: parsed,
                    is_available: parsed > 0,
                })
                .eq("id", itemId)
                .eq("restaurant_id", restaurantId);
        }
    };

    useEffect(() => {
        const handlePageHide = () => flushPendingStockSaves();
        const handleVisibilityChange = () => {
            if (document.hidden) flushPendingStockSaves();
        };

        window.addEventListener("pagehide", handlePageHide);
        document.addEventListener("visibilitychange", handleVisibilityChange);

        return () => {
            flushPendingStockSaves();
            window.removeEventListener("pagehide", handlePageHide);
            document.removeEventListener(
                "visibilitychange",
                handleVisibilityChange
            );
        };
    }, [restaurantId]);

    const updateStockEnabled = async (
        item: ItemWithStock,
        enabled: boolean
    ) => {
        clearStockSaveTimer(item.id);
        delete pendingStockRef.current[item.id];
        setSavingId(item.id);

        const nextQuantity = enabled ? item.stock_quantity ?? 0 : null;
        const payload: StockUpdates = {
            stock_enabled: enabled,
            stock_quantity: nextQuantity,
        };

        const { error } = await supabase
            .from("items")
            .update(payload)
            .eq("id", item.id)
            .eq("restaurant_id", restaurantId);

        setSavingId(null);

        if (error) {
            console.error(error);
            onToast("Erro ao atualizar estoque.", "error");
            return;
        }

        if (!enabled) {
            setDraftStock((current) => {
                const next = { ...current };
                delete next[item.id];
                return next;
            });
        }

        onStockUpdated(item.id, payload);
        onToast("Estoque atualizado.", "success");
    };

    const saveStockQuantity = async (
        item: ItemWithStock,
        rawValue?: string,
        background = false
    ) => {
        const raw = (rawValue ?? getDraftValue(item)).trim();
        const parsed = Number(raw);

        if (
            raw === "" ||
            Number.isNaN(parsed) ||
            parsed < 0 ||
            !Number.isInteger(parsed)
        ) {
            if (!background) {
                onToast("Informe uma quantidade válida.", "error");
            }
            return;
        }

        if (parsed === Number(item.stock_quantity ?? 0)) {
            if (pendingStockRef.current[item.id] === raw) {
                delete pendingStockRef.current[item.id];
            }
            return;
        }

        if (!background) setSavingId(item.id);

        const updates: StockUpdates = {
            stock_quantity: parsed,
            is_available: parsed > 0,
        };

        const { error } = await supabase
            .from("items")
            .update(updates)
            .eq("id", item.id)
            .eq("restaurant_id", restaurantId);

        if (!background) setSavingId(null);

        if (error) {
            console.error(error);
            onToast("Erro ao salvar quantidade.", "error");
            return;
        }

        if (pendingStockRef.current[item.id] === raw) {
            delete pendingStockRef.current[item.id];
        }

        setDraftStock((current) => ({
            ...current,
            [item.id]: String(parsed),
        }));
        onStockUpdated(item.id, updates);
    };

    const scheduleStockQuantitySave = (
        item: ItemWithStock,
        value: string
    ) => {
        clearStockSaveTimer(item.id);
        pendingStockRef.current[item.id] = value;

        const raw = value.trim();
        const parsed = Number(raw);
        if (
            raw === "" ||
            Number.isNaN(parsed) ||
            parsed < 0 ||
            !Number.isInteger(parsed)
        ) {
            return;
        }

        stockSaveTimersRef.current[item.id] = setTimeout(() => {
            delete stockSaveTimersRef.current[item.id];
            void saveStockQuantity(item, value, true);
        }, 300);
    };

    const flushStockQuantitySave = (item: ItemWithStock) => {
        clearStockSaveTimer(item.id);
        void saveStockQuantity(item);
    };

    if (!items) {
        return (
            <div className="flex justify-center py-12">
                <Loader />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div>
                <h2 className="text-xl font-semibold text-gray-900">
                    Estoque
                </h2>
                <p className="mt-1 text-gray-500">
                    Ative o controle de estoque por produto e defina a quantidade disponível.
                </p>
            </div>

            <div className="space-y-6">
                {categories
                    .filter(
                        (category) =>
                            (itemsByCategory[category.id] || []).length > 0
                    )
                    .map((category) => (
                        <div key={category.id}>
                            <h3 className="mb-3 text-lg font-semibold text-gray-900">
                                {category.name}
                            </h3>

                            <div className="space-y-2">
                                {(itemsByCategory[category.id] || []).map(
                                    (item) => {
                                        const enabled = !!item.stock_enabled;
                                        const isSaving = savingId === item.id;

                                        return (
                                            <div
                                                key={item.id}
                                                className="rounded-xl border border-gray-200 bg-white px-4 py-3"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="min-w-0 flex-1">
                                                        <div className="truncate font-medium text-gray-900">
                                                            {item.name}
                                                        </div>
                                                    </div>

                                                    {enabled && (
                                                        <div className="mr-4">
                                                            <input
                                                                type="number"
                                                                min={0}
                                                                step={1}
                                                                inputMode="numeric"
                                                                value={getDraftValue(item)}
                                                                onChange={(e) => {
                                                                    const value = e.target.value;
                                                                    setDraftStock((prev) => ({
                                                                        ...prev,
                                                                        [item.id]: value,
                                                                    }));
                                                                    scheduleStockQuantitySave(
                                                                        item,
                                                                        value
                                                                    );
                                                                }}
                                                                onBlur={() =>
                                                                    flushStockQuantitySave(item)
                                                                }
                                                                onKeyDown={(e) => {
                                                                    if (e.key === "Enter") {
                                                                        e.currentTarget.blur();
                                                                    }
                                                                }}
                                                                disabled={isSaving}
                                                                className="w-24 rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none disabled:opacity-60"
                                                            />
                                                        </div>
                                                    )}

                                                    <label className="flex cursor-pointer select-none items-center gap-2 whitespace-nowrap">
                                                        <span className="text-sm text-gray-700">
                                                            Estoque
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                updateStockEnabled(
                                                                    item,
                                                                    !enabled
                                                                )
                                                            }
                                                            disabled={isSaving}
                                                            className={`relative h-7 w-12 cursor-pointer rounded-full transition ${
                                                                enabled
                                                                    ? "bg-green-500"
                                                                    : "bg-gray-300"
                                                            } ${
                                                                isSaving
                                                                    ? "opacity-60"
                                                                    : ""
                                                            }`}
                                                        >
                                                            <span
                                                                className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${
                                                                    enabled
                                                                        ? "left-6"
                                                                        : "left-1"
                                                                }`}
                                                            />
                                                        </button>
                                                    </label>
                                                </div>
                                            </div>
                                        );
                                    }
                                )}
                            </div>
                        </div>
                    ))}
            </div>
        </div>
    );
}
