"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Item, Promotion } from "@/lib/types/types";
import Dropdown from "@/components/ui/Dropdown";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {icons} from "@/lib/utils/fontawesome";
import { supabase } from "@/lib/database/supabaseClient";

export default function PromotionRow({
                                         item,
                                         checked,
                                         onToggle,
                                         onChange,
                                     }: {
    item: Item;
    checked: boolean;
    onToggle: () => void;
    onChange: (promo: Promotion) => void;
}) {
    const initialPromo = item.promotion;

    const supabaseImage = (path?: string) =>
        path
            ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${path}`
            : "/placeholders/item.png";
    const [type, setType] = useState<"percent" | "fixed">(initialPromo?.type ?? "percent");
    const [value, setValue] = useState<number>(
        initialPromo ? (initialPromo.type === "fixed" ? initialPromo.value / 100 : initialPromo.value) : 0
    );
    const [startsAt, setStartsAt] = useState<string | null>(initialPromo?.starts_at ?? null);
    const [endsAt, setEndsAt] = useState<string | null>(initialPromo?.ends_at ?? null);
    const [calendarOpen, setCalendarOpen] = useState(false);

    const finalPrice = type === "percent"
        ? item.price_cents - Math.round(item.price_cents * (value / 100))
        : item.price_cents - Math.round(value * 100);

    const hasPromo = value > 0;
    const maxValue = item.price_cents / 100


    useEffect(() => {
        if (!item.promotion) {
            setType("percent");
            setValue(0);
            setStartsAt(null);
            setEndsAt(null);
            return;
        }

        setType(item.promotion.type);
        setValue(
            item.promotion.type === "fixed"
                ? item.promotion.value / 100
                : item.promotion.value
        );
        setStartsAt(item.promotion.starts_at);
        setEndsAt(item.promotion.ends_at);
    }, [item.promotion]);

    const getPublicUrl = (
        supabase: any,
        bucket: string,
        path: string | null
    ) => {
        if (!path) return null;
        const { data } = supabase.storage.from(bucket).getPublicUrl(path);
        return data?.publicUrl || null;
    };


    const formatBRL = (value: number) =>
        new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: "BRL",
            minimumFractionDigits: 2,
        }).format(value);

    // ✅ Commit whenever value OR type changes
    const commit = () => {
        // ⛔ STOP if promo was removed
        if (value <= 0) return;

        let safeValue = value;

        if (type === "percent") safeValue = Math.min(Math.max(value, 0), 100);
        if (type === "fixed") safeValue = Math.min(Math.max(value, 0), item.price_cents / 100);

        onChange({
            item_id: item.id,
            type,
            value: type === "percent" ? Math.round(safeValue) : Math.round(safeValue * 100),
            starts_at: startsAt ?? new Date().toISOString(),
            ends_at: endsAt ?? "3000-01-01T00:00:00.000Z",
        } as Promotion);
    };

    // Trigger commit on type change
    useEffect(() => {
        commit();
    }, [type]);

    console.log(supabaseImage(item.image_path || undefined))

    const imageUrl = getPublicUrl(
        supabase,
        "menu-images",
        item.image_path
    );

    return (
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 hover:bg-gray-50">
            <div className="flex items-center gap-5">
                <input
                    type="checkbox"
                    checked={checked}
                    onChange={onToggle}
                    className="accent-brand "
                />
                <img
                    src={imageUrl || "/placeholders/item.png"}
                    alt={item.name}
                    width={48}
                    height={48}
                    className="rounded-lg object-cover"
                />

                <div>
                    <div className="font-medium text-text">{item.name}</div>
                    <div className="text-sm text-gray-500 flex items-center">
                        {formatBRL(item.price_cents / 100)}
                        {hasPromo && (
                            <>
                            <span className="ml-1 text-green-600 font-medium">
      → {formatBRL(finalPrice / 100)}
    </span>
                                <div title="Remover promoção"
                                     onClick={() => onChange({ active: false } as Promotion)}
                                     className={" ml-1 cursor-pointer text-red-600 text-[0.65rem] hover:text-red-700 duration-100 hover:bg-gray-200 h-5 w-5 flex justify-center items-center rounded-full"}>

                                <FontAwesomeIcon icon={icons.faTrash}
                                    className=""

                                />
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-2">
                <Dropdown
                    value={type}
                    options={[
                        { label: "%", value: "percent" },
                        { label: "R$", value: "fixed" },
                    ]}
                    onChange={(e) => setType(e.target.value as "fixed" | "percent")}
                    className={"border-none !bg-transparent !pr-7"}
                    chevronClassName="!text-xs"
                />

                <Input
                    type="number"
                    value={type === "percent" ? Math.min(Math.max(value, 0), 100) : Math.max(value, 0)}
                    placeholder={type === "fixed" ? "0,00" : "%"}
                    min={0}
                    max={type === "percent" ? 100 : maxValue}
                    className="max-w-20"
                    onChange={(e) => setValue(Number(e.target.value || 0))}
                    onBlur={commit}
                />

                <div className="relative ml-3">
                    <FontAwesomeIcon
                        onClick={() => {
                            setCalendarOpen(v => !v);
                            commit(); // save when toggling calendar
                        }}
                        className={` cursor-pointer duration-100 ${
                            startsAt || endsAt ? "text-brand hover:text-dark-brand" : "text-gray-500 hover:text-gray-700"
                        }`}
                        icon={icons.faCalendarDays}
                    />

                    {calendarOpen && (
                        <div className="absolute right-0 mt-2 bg-white border border-gray-100 rounded-lg shadow-lg p-3 z-50">
                            <label className="text-xs text-gray-500">Início</label>
                            <input
                                type="date"
                                value={startsAt?.slice(0, 10) ?? ""}
                                onChange={(e) => setStartsAt(e.target.value)}
                                onBlur={commit}
                                className="block w-full mb-2 border border-gray-100  rounded px-2 py-1"
                            />

                            <label className="text-xs text-gray-500">Fim</label>
                            <input
                                type="date"
                                value={endsAt?.slice(0, 10) ?? ""}
                                onChange={(e) => setEndsAt(e.target.value)}
                                onBlur={commit}
                                className="block w-full border rounded border-gray-100 px-2 py-1"
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
