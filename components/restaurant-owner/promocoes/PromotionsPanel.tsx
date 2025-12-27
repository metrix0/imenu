"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/database/supabaseClient";
import { Item, Category, Promotion } from "@/lib/types/types";
import PromotionRow from "./PromotionRow";
import Card from "@/components/ui/Card";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { icons } from "@/lib/utils/fontawesome";
import Dropdown from "@/components/ui/Dropdown";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import ListLoader from "@/components/ui/ListLoader";

/* -------------------------------- BULK BAR -------------------------------- */

function BulkEditBar({
                         items,
                         onBulkChange,
                     }: {
    items: Item[];
    onBulkChange: (promo: Promotion, itemId: string) => void;
}) {
    const [type, setType] = useState<"percent" | "fixed">("percent");
    const [value, setValue] = useState(0);
    const [startsAt, setStartsAt] = useState<string | null>(null);
    const [endsAt, setEndsAt] = useState<string | null>(null);

    const apply = () => {
        let safeValue =
            type === "percent"
                ? Math.min(Math.max(value, 0), 100)
                : Math.max(value, 0);

        items.forEach(item => {
            const finalValue =
                type === "fixed"
                    ? Math.min(safeValue, item.price_cents / 100)
                    : safeValue;

            onBulkChange(
                {
                    active: true,
                    item_id: item.id,
                    type,
                    value:
                        type === "percent"
                            ? Math.round(finalValue)
                            : Math.round(finalValue * 100),
                    starts_at: startsAt ?? new Date().toISOString(),
                    ends_at: endsAt ?? "3000-01-01T00:00:00.000Z",
                } as Promotion,
                item.id
            );
        });
    };

    return (
        <div className="px-4 pr-6 shadow-xs py-3 bg-gray-100 border rounded-3xl mb-4 mt-2 flex items-center gap-4 border-gray-200 justify-between">
            <div className={"flex items-center gap-4 border-gray-200"}>
                <Dropdown
                    value={type}
                    options={[
                        { label: "%", value: "percent" },
                        { label: "R$", value: "fixed" },
                    ]}
                    onChange={e => setType(e.target.value as any)}
                    className={"border-none !bg-transparent !pr-7"}
                    chevronClassName="!text-xs"
                />

                <Input
                    type="number"
                    value={value}
                    className="max-w-24 -ml-3 !py-2"
                    onChange={e => setValue(Number(e.target.value || 0))}
                />

                <input
                    type="date"
                    value={startsAt ?? ""}
                    onChange={e => setStartsAt(e.target.value || null)}
                    className="border border-gray-300 cursor-pointer px-2 py-2 bg-white rounded text-sm"
                />
                <input
                    type="date"
                    value={endsAt ?? ""}
                    onChange={e => setEndsAt(e.target.value || null)}
                    className="border border-gray-300 cursor-pointer px-2 py-2 bg-white rounded text-sm"
                />
            </div>

            <div className={"flex items-center gap-4 border-gray-200"}>
                <Button
                    onClick={() =>
                        items.forEach(item =>
                            onBulkChange({ active: false } as Promotion, item.id)
                        )
                    }
                    variant={"secondary"}
                    className={"text-sm bg-gray-200 hover:bg-gray-300 text-text"}
                >
                    Remover promoções
                </Button>

                <Button
                    onClick={apply}
                    className="text-sm"
                >
                    Aplicar
                </Button>
            </div>
        </div>
    );
}

/* -------------------------- CATEGORY CHECKBOX -------------------------- */

function CategoryCheckbox({
                              items,
                              selected,
                              setSelected,
                          }: {
    items: Item[];
    selected: Record<string, boolean>;
    setSelected: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}) {
    const ref = useRef<HTMLInputElement>(null);

    const allSelected = items.every(i => selected[i.id]);
    const anySelected = items.some(i => selected[i.id]);

    useEffect(() => {
        if (ref.current) {
            ref.current.indeterminate = anySelected && !allSelected;
        }
    }, [anySelected, allSelected]);

    return (
        <input
            ref={ref}
            type="checkbox"
            checked={allSelected}
            onChange={() => {
                const next = { ...selected };
                items.forEach(i => (next[i.id] = !allSelected));
                setSelected(next);
            }}
            className="w-4 h-4 rounded accent-brand"
        />
    );
}

/* ------------------------------- PANEL ------------------------------- */

type CategoryWithItems = {
    category: Category;
    items: Item[];
};

export default function PromotionsPanel({
                                            restaurantId,
                                            onToast,
                                        }: {
    restaurantId: string;
    onToast?: (message: string, type: "success" | "error") => void;
}) {
    const [data, setData] = useState<CategoryWithItems[]>([]);
    const [selected, setSelected] = useState<Record<string, boolean>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [loading, setLoading] = useState(true);

    const debounceRef = useRef<Record<string, NodeJS.Timeout>>({});

    useEffect(() => {
        load();
    }, []);

    const load = async () => {
        setLoading(true);


        const { data: items } = await supabase
            .from("items")
            .select("*, category:categories(*), promotion:promotions(*)")
            .eq("restaurant_id", restaurantId)
            .order("position");

        if (!items) return;

        const grouped: Record<string, CategoryWithItems> = {};

        items.forEach(item => {
            const cat = item.category!;
            if (!grouped[cat.id]) grouped[cat.id] = { category: cat, items: [] };
            grouped[cat.id].items.push(item);
        });

        setData(
            Object.values(grouped).sort(
                (a, b) => (a.category.position ?? 0) - (b.category.position ?? 0)
            )
        );

        setLoading(false);

    };

    const savePromotionDebounced = (itemId: string, promo: Promotion) => {
        if (debounceRef.current[itemId])
            clearTimeout(debounceRef.current[itemId]);

        setData(prev =>
            prev.map(group => ({
                ...group,
                items: group.items.map(item =>
                    item.id === itemId ? { ...item, promotion: promo } : item
                ),
            }))
        );

        debounceRef.current[itemId] = setTimeout(async () => {
            setIsSaving(true);

            const { error } = await supabase
                .from("promotions")
                .upsert(
                    {
                        item_id: itemId,
                        restaurant_id: restaurantId,
                        type: promo.type,
                        value: promo.value,
                        starts_at: promo.starts_at,
                        ends_at: promo.ends_at,
                    },
                    { onConflict: "item_id" }
                );

            if (error) onToast?.("Erro ao salvar", "error");
            else onToast?.("Promoção salva", "success");

            setTimeout(() => setIsSaving(false), 300);
        }, 500);
    };

    const removePromotion = async (itemId: string) => {
        setData(prev =>
            prev.map(group => ({
                ...group,
                items: group.items.map(item =>
                    item.id === itemId
                        ? ({ ...item, promotion: null } as unknown as Item)
                        : item
                ),
            }))
        );

        await supabase.from("promotions").delete().eq("item_id", itemId);
    };

    if (loading) {
        return (
            <>
                <div className="mt-8">
                    <ListLoader lines={4}/>
                </div>

                <div className="mt-8">
                    <ListLoader lines={4}/>
                </div>
            </>

        );
    }

    return (
        <div className="mt-10">
            <div className="text-sm text-right -mb-4">
                {isSaving ? "Salvando..." : <span className={"text-green-600"}><FontAwesomeIcon icon={icons.faCheck}/> Tudo salvo</span>}
            </div>

            {data.map(({ category, items }) => {
                const anySelected = items.some(i => selected[i.id]);

                return (
                    <div key={category.id}>
                        <div className="px-4 py-3 bg-gray-50 flex items-center gap-4">
                            <CategoryCheckbox
                                items={items}
                                selected={selected}
                                setSelected={setSelected}
                            />
                            <span className="font-semibold text-xl">
                                {category.name}
                            </span>
                        </div>

                        <div
                            className={`
        overflow-hidden transition-all duration-300 ease-in
        ${anySelected
                                ? "max-h-40 opacity-100 translate-y-0"
                                : "max-h-0 opacity-0 -translate-y-2 pointer-events-none"}
    `}
                        >
                            <BulkEditBar
                                items={items.filter(i => selected[i.id])}
                                onBulkChange={(promo, itemId) =>
                                    promo.active === false
                                        ? removePromotion(itemId)
                                        : savePromotionDebounced(itemId, promo)
                                }
                            />
                        </div>
                        <Card className={"mt-2 border border-gray-200 px-0 py-0 mb-6 !shadow-md"}>
                            {items.map(item => (
                                <PromotionRow
                                    key={item.id}
                                    item={item}
                                    checked={!!selected[item.id]}
                                    onToggle={() =>
                                        setSelected(s => ({
                                            ...s,
                                            [item.id]: !s[item.id],
                                        }))
                                    }
                                    onChange={promo =>
                                        promo.active === false
                                            ? removePromotion(item.id)
                                            : savePromotionDebounced(
                                                item.id,
                                                promo
                                            )
                                    }
                                />
                            ))}
                        </Card>
                    </div>
                );
            })}
        </div>
    );
}
