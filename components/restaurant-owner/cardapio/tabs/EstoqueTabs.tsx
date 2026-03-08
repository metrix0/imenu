"use client";

import { supabase } from "@/lib/database/supabaseClient";
import Loader from "@/components/ui/Loader";
import { useMemo, useState } from "react";
import { formatPrice } from "@/lib/utils/formatPrice";

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

export default function EstoqueTab({
                                       items,
                                       categories,
                                       restaurantId,
                                       onRefresh,
                                       onToast,
                                   }: {
    items: ItemWithStock[];
    categories: Category[];
    restaurantId: string;
    onRefresh: () => void;
    onToast: (message: string, type?: "success" | "error" | "info") => void;
}) {
    const [savingId, setSavingId] = useState<string | null>(null);
    const [draftStock, setDraftStock] = useState<Record<string, string>>({});

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

    const getDraftValue = (item: ItemWithStock) => {
        if (draftStock[item.id] !== undefined) return draftStock[item.id];
        return String(item.stock_quantity ?? 0);
    };

    const updateStockEnabled = async (item: ItemWithStock, enabled: boolean) => {
        setSavingId(item.id);

        const payload: any = {
            stock_enabled: enabled,
        };

        if (!enabled) {
            payload.stock_quantity = null;
        } else if (item.stock_quantity == null) {
            payload.stock_quantity = 0;
        }

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

        onToast("Estoque atualizado.", "success");
        onRefresh();
    };

    const saveStockQuantity = async (item: ItemWithStock) => {
        const raw = getDraftValue(item).trim();
        const parsed = Number(raw);

        if (raw === "" || Number.isNaN(parsed) || parsed < 0 || !Number.isInteger(parsed)) {
            onToast("Informe uma quantidade válida.", "error");
            return;
        }

        setSavingId(item.id);

        const { error } = await supabase
            .from("items")
            .update({
                stock_enabled: true,
                stock_quantity: parsed,
                is_available: parsed > 0,
            })
            .eq("id", item.id)
            .eq("restaurant_id", restaurantId);

        setSavingId(null);

        if (error) {
            console.error(error);
            onToast("Erro ao salvar quantidade.", "error");
            return;
        }

        onToast("Quantidade salva.", "success");
        onRefresh();
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
                <h2 className="text-xl font-semibold text-gray-900">Estoque</h2>
                <p className="text-gray-500 mt-1">
                    Ative o controle de estoque por produto e defina a quantidade disponível.
                </p>
            </div>

            <div className="space-y-6">
                {categories
                    .filter((category) => (itemsByCategory[category.id] || []).length > 0)
                    .map((category) => (
                        <div key={category.id}>
                            <h3 className="text-lg font-semibold text-gray-900 mb-3">
                                {category.name}
                            </h3>

                            <div className="space-y-2">
                                {(itemsByCategory[category.id] || []).map((item) => {
                                    const enabled = !!item.stock_enabled;
                                    const isSaving = savingId === item.id;

                                    return (
                                        <div
                                            key={item.id}
                                            className="border border-gray-200 rounded-xl px-4 py-3 bg-white"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="min-w-0 flex-1">
                                                    <div className="font-medium text-gray-900 truncate">
                                                        {item.name}
                                                    </div>
                                                </div>

                                                {enabled && (
                                                    <div className={"mr-4"}>
                                                        <input
                                                            type="number"
                                                            min={0}
                                                            step={1}
                                                            value={getDraftValue(item)}
                                                            onChange={(e) =>
                                                                setDraftStock((prev) => ({
                                                                    ...prev,
                                                                    [item.id]: e.target.value,
                                                                }))
                                                            }
                                                            className="w-24 border border-gray-200 rounded-xl px-3 py-2 outline-none text-sm"
                                                        />

                                                        <button
                                                            type="button"
                                                            onClick={() => saveStockQuantity(item)}
                                                            disabled={isSaving}
                                                            className="cursor-pointer bg-brand text-white rounded-xl px-4 py-2 text-sm disabled:opacity-60 whitespace-nowrap"
                                                        >
                                                            Salvar
                                                        </button>
                                                    </div>
                                                )}

                                                <label className="flex items-center gap-2 cursor-pointer select-none whitespace-nowrap">
                                                    <span className="text-sm text-gray-700">Estoque</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => updateStockEnabled(item, !enabled)}
                                                        disabled={isSaving}
                                                        className={`cursor-pointer w-12 h-7 rounded-full relative transition ${
                                                            enabled ? "bg-brand" : "bg-gray-300"
                                                        } ${isSaving ? "opacity-60" : ""}`}
                                                    >
                                            <span
                                                className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all ${
                                                    enabled ? "left-6" : "left-1"
                                                }`}
                                            />

                                                    </button>
                                                </label>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
            </div>        </div>
    );
}