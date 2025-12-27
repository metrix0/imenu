"use client";

import { useState } from "react";
import { Item, PromotionType } from "@/lib/types/types";
import { supabase } from "@/lib/database/supabaseClient";

interface Props {
    items: Item[];
    restaurantId: string;
}

export default function PromotionsTable({ items, restaurantId }: Props) {
    const [selected, setSelected] = useState<Set<string>>(new Set());

    const byCategory = items.reduce<Record<string, Item[]>>((acc, item) => {
        const key = item.category?.id || "sem-categoria";
        acc[key] ||= [];
        acc[key].push(item);
        return acc;
    }, {});

    const toggleItem = (id: string) => {
        setSelected(prev => {
            const n = new Set(prev);
            n.has(id) ? n.delete(id) : n.add(id);
            return n;
        });
    };

    const applyPromo = async (type: PromotionType, value: number) => {
        await Promise.all(
            [...selected].map(itemId =>
                supabase.from("promotions").upsert({
                    restaurant_id: restaurantId,
                    item_id: itemId,
                    type,
                    value,
                    active: true,
                    ends_at: "3000-01-01",
                })
            )
        );
    };

    return (
        <div className="space-y-8">
            {Object.values(byCategory).map(catItems => (
                <div
                    key={catItems[0].category?.id}
                    className="rounded-xl border bg-gray-50 p-4"
                >
                    <div className="mb-3 text-sm font-semibold text-gray-700 uppercase tracking-wide">
                        {catItems[0].category?.name}
                    </div>

                    <div className="space-y-2">
                        {catItems.map(item => (
                            <div
                                key={item.id}
                                className="flex items-center gap-4 rounded-lg border bg-white px-4 py-3 hover:shadow-sm transition"
                            >
                                <input
                                    type="checkbox"
                                    checked={selected.has(item.id)}
                                    onChange={() => toggleItem(item.id)}
                                    className="h-4 w-4 accent-brand"
                                />

                                <div className="flex-1">
                                    <div className="font-medium text-gray-900">
                                        {item.name}
                                    </div>

                                    {item.promotion ? (
                                        <div className="text-xs text-green-600">
                                            Promo ativa
                                        </div>
                                    ) : (
                                        <div className="text-xs text-gray-400">
                                            Sem promoção
                                        </div>
                                    )}
                                </div>

                                <select
                                    defaultValue={item.promotion?.type || "percent"}
                                    className="h-9 rounded-md border px-2 text-sm"
                                    onChange={e =>
                                        applyPromo(
                                            e.target.value as PromotionType,
                                            item.promotion?.value || 0
                                        )
                                    }
                                >
                                    <option value="percent">%</option>
                                    <option value="fixed">R$</option>
                                </select>

                                <input
                                    type="number"
                                    placeholder="0"
                                    defaultValue={item.promotion?.value || ""}
                                    className="h-9 w-24 rounded-md border px-2 text-right text-sm"
                                    onBlur={e =>
                                        applyPromo(
                                            item.promotion?.type || "percent",
                                            Number(e.target.value)
                                        )
                                    }
                                />
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
