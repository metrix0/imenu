"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { Item, Promotion } from "@/lib/types/types";
import Dropdown from "@/components/ui/Dropdown";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import DateRangePicker from "@/components/ui/DateRangePicker";
import { supabase } from "@/lib/database/supabaseClient";

export default function PromotionRow({ item, checked, onToggle, onChange }: {
    item: Item; checked: boolean; onToggle: () => void; onChange: (promo: Promotion) => void;
}) {
    const [type, setType] = useState<"percent" | "fixed">(item.promotion?.type ?? "percent");
    const [value, setValue] = useState(item.promotion ? (item.promotion.type === "fixed" ? item.promotion.value / 100 : item.promotion.value) : 0);
    const [startsAt, setStartsAt] = useState<string | null>(item.promotion?.starts_at ?? null);
    const [endsAt, setEndsAt] = useState<string | null>(item.promotion?.ends_at ?? null);

    useEffect(() => {
        const promo = item.promotion;
        setType(promo?.type ?? "percent");
        setValue(promo ? (promo.type === "fixed" ? promo.value / 100 : promo.value) : 0);
        setStartsAt(promo?.starts_at ?? null);
        setEndsAt(promo?.ends_at ?? null);
    }, [item.promotion]);

    const safeValue = Math.min(Math.max(value, 0), type === "percent" ? 100 : item.price_cents / 100);
    const finalPrice = item.price_cents - (type === "percent" ? Math.round(item.price_cents * safeValue / 100) : Math.round(safeValue * 100));
    const hasPromo = value > 0;
    const formatBRL = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    const imageUrl = item.image_path ? supabase.storage.from("menu-images").getPublicUrl(item.image_path).data.publicUrl : "/placeholders/item.png";
    const now = new Date();
    const status = !hasPromo ? "Sem desconto" : startsAt && new Date(startsAt) > now ? "Programada" : endsAt && new Date(endsAt) < now ? "Encerrada" : "Ativa";

    const commit = (nextType = type, nextStart = startsAt, nextEnd = endsAt) => {
        if (value <= 0) return;
        const nextValue = Math.min(Math.max(value, 0), nextType === "percent" ? 100 : item.price_cents / 100);
        onChange({
            item_id: item.id, type: nextType,
            value: nextType === "percent" ? Math.round(nextValue) : Math.round(nextValue * 100),
            starts_at: nextStart ?? new Date().toISOString(),
            ends_at: nextEnd ?? "3000-01-01T00:00:00.000Z",
        } as Promotion);
    };

    return (
        <div className={`panel-promotion-row grid gap-4 border-b border-gray-200 p-4 last:border-b-0 lg:grid-cols-[minmax(220px,1fr)_minmax(0,1.3fr)] lg:items-center ${checked ? "bg-brand/5" : "hover:bg-gray-50"}`}>
            <div className="flex min-w-0 items-center gap-3">
                <input type="checkbox" checked={checked} onChange={onToggle} aria-label={`Selecionar ${item.name}`} className="h-4 w-4 shrink-0 cursor-pointer accent-brand" />
                <img src={imageUrl} alt="" width={48} height={48} className="h-12 w-12 shrink-0 rounded-lg border border-gray-200 object-cover" />
                <div className="min-w-0">
                    <p className="break-words font-medium text-gray-900">{item.name}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm tabular-nums">
                        <span className={hasPromo ? "text-gray-400 line-through" : "text-gray-500"}>{formatBRL(item.price_cents)}</span>
                        {hasPromo && <span className="font-medium text-green-800">{formatBRL(finalPrice)}</span>}
                        <span className={`rounded-full px-2 py-0.5 text-xs ${status === "Ativa" ? "bg-green-50 text-green-800" : status === "Programada" ? "bg-amber-50 text-amber-800" : "bg-gray-100 text-gray-500"}`}>{status}</span>
                    </div>
                </div>
            </div>
            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)_40px] items-end gap-3 sm:grid-cols-[minmax(100px,1fr)_90px_minmax(0,1.6fr)_40px]">
                <Dropdown label="Desconto" aria-label={`Tipo de desconto de ${item.name}`} value={type}
                    options={[{ label: "Percentual", value: "percent" }, { label: "Valor fixo", value: "fixed" }]}
                    onChange={event => { const next = event.target.value as "fixed" | "percent"; setType(next); commit(next); }} />
                <Input label={type === "percent" ? "Valor (%)" : "Valor (R$)"} aria-label={`Desconto de ${item.name}`}
                    type="number" inputMode="decimal" min={0} max={type === "percent" ? 100 : item.price_cents / 100} step={type === "percent" ? 1 : 0.01}
                    value={value} onChange={event => setValue(Number(event.target.value || 0))} onBlur={() => commit()} />
                <div className="col-span-2 row-start-2 sm:col-span-1 sm:row-start-auto">
                    <DateRangePicker label="Vigência" presets={[]} allowFuture allowOpenEnd allowClear emptyLabel="Sem data final"
                        value={{ startDate: startsAt?.slice(0, 10) ?? "", endDate: endsAt?.startsWith("3000-") ? "" : endsAt?.slice(0, 10) ?? "" }}
                        onChange={range => { const start = range.startDate || null; const end = range.endDate || null; setStartsAt(start); setEndsAt(end); commit(type, start, end); }} />
                </div>
                <Button variant="secondary" disabled={!item.promotion} aria-label={`Remover promoção de ${item.name}`} title="Remover promoção"
                    className="col-start-3 row-start-1 !h-11 !w-10 !px-0 text-red-600 sm:col-start-auto sm:row-start-auto"
                    onClick={() => onChange({ active: false } as Promotion)}><Trash2 size={16} /></Button>
            </div>
        </div>
    );
}
