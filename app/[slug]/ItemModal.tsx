// app/[slug]/ItemModal.tsx
"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { Restaurant, Item } from "@/lib/stores/types";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faChevronDown,
    faCircle as faCircleSolid,
    faMinus,
    faPlus,
    faComment,
} from "@fortawesome/free-solid-svg-icons";
import { faCircle as faCircleRegular } from "@fortawesome/free-solid-svg-icons";
import Loader from "@/components/ui/Loader";
import Tooltip from "@/components/ui/Tooltip";
import { useCartStore } from "@/lib/stores/costumer/cartStore";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
type ItemSubitem = {
    id: string;
    item_subcategory_id: string;
    name: string;
    description: string | null;
    price_cents: number;
    is_available: boolean;
    position: number;
};

type ItemSubcategoryWithSubitems = {
    id: string;
    name: string;
    description: string | null;
    min_select: number;
    max_select: number;
    position: number;
    subitems: ItemSubitem[];
};

type Props = {
    restaurant: Restaurant;
    item: Item;
    subcategories: ItemSubcategoryWithSubitems[];
    loading: boolean;
    onClose: () => void;
};

export default function ItemModal({
                                      restaurant,
                                      item,
                                      subcategories,
                                      loading,
                                      onClose,
                                  }: Props) {
    // ─────────────────────────────────────────────
    // States
    // ─────────────────────────────────────────────
    const [qty, setQty] = useState(1);
    const [observation, setObservation] = useState("");
    const [open, setOpen] = useState(false);
    const [selected, setSelected] = useState<Record<string, Set<string>>>({});
    const addToCart = useCartStore((s) => s.addItem);

    // SWIPE-DOWN (iFood behavior)
    const [dragStartY, setDragStartY] = useState<number | null>(null);
    const [dragY, setDragY] = useState(0);
    const [isDragging, setIsDragging] = useState(false);

    const sheetRef = useRef<HTMLDivElement | null>(null);
    const scrollRef = useRef<HTMLDivElement | null>(null);
    const [isRestaurantOpen, setIsRestaurantOpen] = useState(true);

    // ─────────────────────────────────────────────
    // Open animation
    // ─────────────────────────────────────────────
    useEffect(() => {
        const t = setTimeout(() => setOpen(true), 10);
        return () => clearTimeout(t);
    }, []);

    useEffect(() => {
        if (!restaurant.availability_json) return;

        const availability = restaurant.availability_json;
        const today = new Date().getDay();
        const slots = availability[today] ?? [];

        const now = new Date();
        let openNow = false;

        for (let slot of slots) {
            const [openH, openM] = slot.open.split(":").map(Number);
            const [closeH, closeM] = slot.close.split(":").map(Number);

            const openDate = new Date();
            openDate.setHours(openH, openM, 0, 0);

            const closeDate = new Date();
            closeDate.setHours(closeH, closeM, 0, 0);

            if (now >= openDate && now <= closeDate) {
                openNow = true;
                break;
            }
        }

        setIsRestaurantOpen(openNow);
    }, [restaurant]);
    const closeWithAnimation = () => {
        setOpen(false);
        setTimeout(onClose, 200);
    };

    // ─────────────────────────────────────────────
    // Handlers
    // ─────────────────────────────────────────────


    const formatPrice = (cents: number) =>
        (cents / 100).toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
        });

    const changeQty = (delta: number) => {
        setQty((q) => Math.max(1, Math.min(99, q + delta)));
    };

    const toggleSubitem = (sc: ItemSubcategoryWithSubitems, si: ItemSubitem) => {
        setSelected((prev) => {
            const set = new Set(prev[sc.id] || []);
            const isSingle = sc.max_select === 1 || sc.max_select === 0;

            if (isSingle) {
                set.clear();
                set.add(si.id);
            } else {
                if (set.has(si.id)) set.delete(si.id);
                else set.add(si.id);

                if (sc.max_select > 0 && set.size > sc.max_select) {
                    const first = set.values().next().value || "";
                    set.delete(first);
                }
            }

            return { ...prev, [sc.id]: set };
        });
    };

    // ─────────────────────────────────────────────
    // Totals
    // ─────────────────────────────────────────────
    const extrasTotal = useMemo(() => {
        let total = 0;
        for (const sc of subcategories) {
            const ids = selected[sc.id];
            if (!ids) continue;
            for (const si of sc.subitems) {
                if (ids.has(si.id)) total += si.price_cents;
            }
        }
        return total;
    }, [selected, subcategories]);

    const unitTotal = item.price_cents + extrasTotal;
    const total = unitTotal * qty;

    const missingRequired = useMemo(() => {
        return subcategories.some((sc) => {
            if (sc.min_select <= 0) return false;
            const ids = selected[sc.id];
            return !ids || ids.size < sc.min_select;
        });
    }, [selected, subcategories]);

    const canAdd = !missingRequired;

    const handleAdd = () => {
        if (!canAdd) return;

        const selectedSubitems: any[] = [];

        for (const sc of subcategories) {
            const ids = selected[sc.id];
            if (!ids) continue;

            for (const si of sc.subitems) {
                if (ids.has(si.id)) {
                    selectedSubitems.push({
                        subcategoryId: sc.id,
                        subcategoryName: sc.name,
                        subitemId: si.id,
                        subitemName: si.name,
                        price_cents: si.price_cents,
                    });
                }
            }
        }

        console.log("ADD TO CART", {
            item: item.id,
            qty,
            observation,
            selectedSubitems,
            total,
        });

        if (!canAdd) return;

        addToCart({
            id: crypto.randomUUID(),   // ✅ REQUIRED
            base_item_id: item.id,
            name: item.name,
            image: item.image_public_url || "",
            qty,
            unit_price_cents: unitTotal,
            total_cents: total,
            observation,
            selectedSubitems,
        });

        closeWithAnimation();
    };

    // ─────────────────────────────────────────────
    // SWIPE DOWN (iFood style)
    // ─────────────────────────────────────────────
    const onTouchStart = (e: React.TouchEvent) => {
        if (!scrollRef.current) return;

        // Só permite swipe se o usuário estiver no topo do modal
        if (scrollRef.current.scrollTop !== 0) return;

        setIsDragging(true);
        setDragStartY(e.touches[0].clientY);
    };

    const onTouchMove = (e: React.TouchEvent) => {
        if (!isDragging || dragStartY === null) return;

        const delta = e.touches[0].clientY - dragStartY;

        if (delta > 0) {
            setDragY(delta);
        }
    };

    const onTouchEnd = () => {
        if (!isDragging) return;

        setIsDragging(false);

        if (dragY > 60) {
            closeWithAnimation();
        } else {
            setDragY(0);
        }
    };

    // ─────────────────────────────────────────────
    // Render Content (loading or real content)
    // ─────────────────────────────────────────────
    const renderContent = () => {
        if (loading) {
            return (
                <div className="flex items-center justify-center h-[55vh]">
                    <Loader />
                </div>
            );
        }

        return (
            <>
                {/* ITEM CARD */}
                <div className="mt-3 px-4">
                    <div className="px-1">
                        <h1 className="text-[22px] font-semibold mb-2">
                            {item.name}
                        </h1>

                        {item.description && (
                            <p className="text-[15px] text-gray-700 leading-snug mb-3">
                                {item.description}
                            </p>
                        )}

                        <p className="text-[18px] font-semibold">
                            {formatPrice(item.price_cents)}
                        </p>
                    </div>
                </div>

                {/* SUBCATEGORIES */}
                <div className="mt-6">
                    {subcategories.map((sc) => {
                        const set = selected[sc.id];
                        const isSingle =
                            sc.max_select === 1 || sc.max_select === 0;

                        return (
                            <div key={sc.id} className="mt-4">
                                <div className="bg-gray-100 px-4 py-3 flex justify-between">
                                    <div>
                                        <p className="text-[16px] font-semibold text-gray-600">
                                            {sc.name}
                                        </p>
                                        <p className="text-[13px] text-gray-600">
                                            {sc.max_select > 0
                                                ? `Escolha até ${sc.max_select}`
                                                : "Escolha o quanto quiser"}
                                        </p>
                                    </div>

                                    {sc.min_select > 0 && (
                                        <span className="text-[11px] bg-black text-white px-2 py-1 rounded-full">
                                            OBRIGATÓRIO
                                        </span>
                                    )}
                                </div>

                                {sc.subitems.map((si) => {
                                    const isSelected =
                                        set && set.has(si.id);

                                    return (
                                        <button
                                            key={si.id}
                                            onClick={() =>
                                                toggleSubitem(sc, si)
                                            }
                                            className="w-full px-4 py-3 flex justify-between"
                                        >
                                            <div className={"text-left"}>
                                                <p className="text-[15px] font-medium">
                                                    {(si.name).replace(/\n/g, ' ')}
                                                </p>

                                                {si.price_cents > 0 && (
                                                <p className="text-[13px] text-gray-500">
                                                    +{" "}
                                                    {formatPrice(
                                                        si.price_cents
                                                    )}
                                                </p>
                                                )}
                                            </div>

                                            <div className={"flex items-center"}>
                                                {isSingle ? (
                                                    <FontAwesomeIcon
                                                        icon={
                                                            isSelected
                                                                ? faCircleSolid
                                                                : faCircleRegular
                                                        }
                                                        className={
                                                            isSelected
                                                                ? "text-brand text-lg"
                                                                : "text-gray-400 text-lg"
                                                        }
                                                    />
                                                ) : (
                                                    <span
                                                        className={`duration-200 w-7 h-7 rounded-full border flex items-center justify-center ${
                                                            isSelected
                                                                ? "border-brand font-bold bg-brand text-white"
                                                                : "border-gray-300 bg-gray-100 text-gray-400"
                                                        }`}
                                                    >
                                                        {isSelected ? "–" : "+"}
                                                    </span>
                                                )}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        );
                    })}
                </div>

                {/* OBSERVATION */}
                <div className="px-4 mt-8">
                    <p className="text-[15px] font-semibold text-gray-500">
                        <FontAwesomeIcon icon={faComment} /> Alguma observação?
                    </p>

                    <textarea
                        value={observation}
                        onChange={(e) =>
                            setObservation(
                                e.target.value.slice(0, 140)
                            )
                        }
                        className="w-full mt-2 p-3 border border-gray-200 rounded-xl text-[14px] outline-none resize-none"
                        rows={3}
                        placeholder="Ex: tirar cebola..."
                    />
                </div>
            </>
        );
    };

    // ─────────────────────────────────────────────
    // Return
    // ─────────────────────────────────────────────
    return (
        <div className="fixed inset-0 z-[999] flex items-end justify-center">
            {/* BACKDROP */}
            <div
                className={`absolute inset-0 bg-black/40 transition-opacity duration-200 ${
                    open ? "opacity-100" : "opacity-0"
                }`}
                onClick={closeWithAnimation}
            />

            {/* BOTTOM SHEET */}
            <div
                ref={sheetRef}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
                className="absolute left-0 right-0 bottom-0 h-[93%] bg-white rounded-2xl shadow-2xl overflow-hidden"
                style={{
                    transform: isDragging
                        ? `translateY(${dragY}px)`
                        : open
                            ? "translateY(0)"
                            : "translateY(100%)",
                    transition: isDragging
                        ? "none"
                        : "transform 0.25s ease",
                }}
            >
                {/* SCROLLABLE CONTENT */}
                <div
                    ref={scrollRef}
                    className="overflow-y-auto h-full pb-32"
                >
                    {/* IMAGE */}
                    <div className="relative w-full h-[260px] bg-black">
                        <img
                            src={item.image_public_url || ""}
                            className="w-full h-full object-cover"
                            alt={item.name}
                        />

                        <button
                            onClick={closeWithAnimation}
                            className="absolute left-4 top-6 w-10 h-10 bg-black/50 text-white rounded-full flex items-center justify-center"
                        >
                            <FontAwesomeIcon icon={faChevronDown} />
                        </button>

                        <div className="absolute left-4 bottom-4 bg-white shadow-md rounded-full px-3 pr-4 py-2 flex items-center gap-2">
                            {restaurant.logo_url && (
                                <img
                                    src={restaurant.logo_url}
                                    className="w-8 h-8 rounded-full object-cover"
                                />
                            )}

                            <div className="flex flex-col">
                                <span className="text-[13px] font-semibold leading-tight">
                                    {restaurant.name}
                                </span>
                                <span className="text-[12px] text-gray-600">
                                    {restaurant.prep_time_min_minutes}–
                                    {restaurant.prep_time_max_minutes} min •{" "}
                                    <span className="text-green-600">
                                        Grátis
                                    </span>
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* CONTENT OR LOADING */}
                    {renderContent()}
                </div>

                {/* FOOTER */}
                <div className="absolute left-0 right-0 bottom-0 bg-white border-t border-gray-200 pt-5 pb-14 px-4 py-3 flex items-center gap-3">
                    <div className="flex items-center border border-gray-200 rounded-xl px-3 py-2 w-[110px] justify-between">
                        <button
                            onClick={() => changeQty(-1)}
                            className="w-6 h-6 flex items-center justify-center text-gray-400"
                        >
                            <FontAwesomeIcon icon={faMinus} className="text-xs" />
                        </button>

                        <span className="text-[16px]">{qty}</span>

                        <button
                            onClick={() => changeQty(1)}
                            className="w-6 h-6 flex items-center justify-center text-brand"
                        >
                            <FontAwesomeIcon icon={faPlus} className="text-xs" />
                        </button>
                    </div>
                        <button
                            disabled={!canAdd || !isRestaurantOpen}
                            onClick={handleAdd}
                            className={`w-full flex-1 rounded-xl px-5 py-3 flex items-center justify-between text-[15px] font-semibold ${
                                !isRestaurantOpen
                                    ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                                    : canAdd
                                        ? "bg-brand text-white"
                                        : "bg-gray-200 text-gray-400"
                            }`}
                        >
                            <span>Adicionar</span>
                            <span>{formatPrice(total)}</span>
                        </button>
                </div>
            </div>
        </div>
    );
}
