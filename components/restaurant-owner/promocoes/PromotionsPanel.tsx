"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/database/supabaseClient";
import { Item, Category, Promotion } from "@/lib/types/types";
import PromotionRow from "./PromotionRow";
import Card from "@/components/ui/Card";
import Dropdown from "@/components/ui/Dropdown";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import ListLoader from "@/components/ui/ListLoader";
import DateRangePicker from "@/components/ui/DateRangePicker";
import SaveStatus, { type SaveState } from "@/components/ui/SaveStatus";

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
        <div className="space-y-3 border-b border-gray-200 bg-gray-50 px-5 py-4">
            <p className="text-sm font-medium">{items.length} {items.length === 1 ? "produto selecionado" : "produtos selecionados"}</p>
            <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] items-end gap-3 lg:grid-cols-[minmax(0,1fr)_100px_minmax(0,1.5fr)_auto]">
                <Dropdown
                    label="Desconto"
                    value={type}
                    options={[
                        { label: "Percentual", value: "percent" },
                        { label: "Valor fixo", value: "fixed" },
                    ]}
                    onChange={e => setType(e.target.value as any)}
                />

                <Input
                    label={type === "percent" ? "Valor (%)" : "Valor (R$)"}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={type === "percent" ? 100 : undefined}
                    step={type === "percent" ? 1 : 0.01}
                    value={value}
                    onChange={e => setValue(Number(e.target.value || 0))}
                />

                <div className="col-span-2 lg:col-span-1">
                    <DateRangePicker label="Validade" presets={[]} allowFuture allowOpenEnd allowClear emptyLabel="Sem data final"
                        value={{ startDate: startsAt ?? "", endDate: endsAt ?? "" }}
                        onChange={range => { setStartsAt(range.startDate || null); setEndsAt(range.endDate || null); }} />
                </div>
            <div className="col-span-2 flex flex-wrap items-center gap-2 lg:col-span-1">
                <Button
                    onClick={() =>
                        items.forEach(item =>
                            onBulkChange({ active: false } as Promotion, item.id)
                        )
                    }
                    variant={"secondary"}
                    className="text-red-600"
                >
                    Remover promoções
                </Button>

                <Button
                    onClick={apply}
                    disabled={value <= 0}
                    className="text-sm"
                >
                    Aplicar
                </Button>
            </div>
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
            aria-label="Selecionar todos os produtos da categoria"
            checked={allSelected}
            onChange={() => {
                const next = { ...selected };
                items.forEach(i => (next[i.id] = !allSelected));
                setSelected(next);
            }}
            className="h-5 w-5 shrink-0 cursor-pointer rounded border border-gray-200/70 accent-brand"
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
    const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({});
    const statuses = Object.values(saveStates);
    const saveStatus: SaveState = statuses.includes("error") ? "error" : statuses.includes("saving") ? "saving" : "saved";
    const [loading, setLoading] = useState(true);

    const debounceRef = useRef<Record<string, NodeJS.Timeout>>({});
    const saveVersions = useRef<Record<string, number>>({});

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
        const version = (saveVersions.current[itemId] ?? 0) + 1;
        saveVersions.current[itemId] = version;
        setSaveStates(prev => ({ ...prev, [itemId]: "saving" }));
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
            if (saveVersions.current[itemId] === version) {
                setSaveStates(prev => ({ ...prev, [itemId]: error ? "error" : "saved" }));
            }
        }, 500);
    };

    const removePromotion = async (itemId: string) => {
        saveVersions.current[itemId] = (saveVersions.current[itemId] ?? 0) + 1;
        clearTimeout(debounceRef.current[itemId]);
        setSaveStates(prev => ({ ...prev, [itemId]: "saving" }));
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

        const { data, error, status, statusText } = await supabase
            .from("promotions")
            .delete()
            .eq("item_id", itemId)
            .select(); // forces Supabase to return deleted rows

        if (error) {
            setSaveStates(prev => ({ ...prev, [itemId]: "error" }));
            console.error("[removePromotion] Supabase error:", {
                itemId,
                status,
                statusText,
                message: error.message,
                details: error.details,
                hint: error.hint,
            });

            // optional: rollback UI here if needed
            return;
        }

        setSaveStates(prev => ({ ...prev, [itemId]: "saved" }));
        console.log("[removePromotion] Promotion removed successfully", {
            itemId,
            status,
            deletedRows: data,
        });    };

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
        <div className="mt-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-gray-500">Ajuste o desconto de cada produto ou selecione vários para editar em lote.</p>
                <SaveStatus status={saveStatus} />
            </div>
            {data.length === 0 && <Card><p className="py-8 text-center text-sm text-gray-500">Nenhum produto disponível para criar promoções.</p></Card>}

            {data.map(({ category, items }) => {
                const anySelected = items.some(i => selected[i.id]);

                return (
                    <Card key={category.id} className="!p-0">
                        <div className="flex items-center gap-3 border-b border-gray-200 px-5 py-4">
                            <CategoryCheckbox
                                items={items}
                                selected={selected}
                                setSelected={setSelected}
                            />
                            <h3 className="min-w-0 flex-1 break-words font-medium">
                                {category.name}
                            </h3>
                            <span className="text-xs text-gray-500">{items.length} {items.length === 1 ? "produto" : "produtos"}</span>
                        </div>

                        {anySelected && <div>
                            <BulkEditBar
                                items={items.filter(i => selected[i.id])}
                                onBulkChange={(promo, itemId) =>
                                    promo.active === false
                                        ? removePromotion(itemId)
                                        : savePromotionDebounced(itemId, promo)
                                }
                            />
                        </div>}
                        <div>
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
                        </div>
                    </Card>
                );
            })}
        </div>
    );
}
