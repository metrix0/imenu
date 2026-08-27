// app/[slug]/ItemModal.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Restaurant, Item, Subitem, Subcategory } from "@/lib/types/types";
import { useCartStore } from "@/lib/stores/costumer/cartStore";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { icons } from "@/lib/utils/fontawesome";
import {formatPrice, formatPriceNoRS, promotionPrice} from "@/lib/utils/formatPrice";
import ModalMobile from "@/components/ui/HybridModal";
import Loader from "@/components/ui/Loader";
import Tooltip from "@/components/ui/Tooltip";
import { captureConsumerEvent } from "@/lib/analytics/captureConsumerEvent";
import { CONSUMER_EVENTS } from "@/lib/analytics/consumerEvents";

type Props = {
    restaurant: Restaurant;
    item: Item;
    subcategories: Subcategory[];
    loading: boolean;
    onClose: () => void;
    deliveryTax: { lowest: number; highest: number  };
    deliveryTime: { lowest: number; highest: number  };
    onAdd?: () => void;
    trackMeta?: (slug: string, eventName: string, data: Record<string, any>) => void;
    slug?: string;
};

export default function ItemModal({
                                      restaurant,
                                      item,
                                      subcategories,
                                      loading,
                                      onClose,
                                        deliveryTax,
                                      deliveryTime,
    onAdd, trackMeta, slug
                                  }: Props) {
    const [qty, setQty] = useState(1);
    const [observation, setObservation] = useState("");
    const [open, setOpen] = useState(false);
    const [selected, setSelected] = useState<Record<string, Record<string, number>>>({});
    const [selectionWarnings, setSelectionWarnings] = useState<Record<string, string>>({});
    const addToCart = useCartStore((s) => s.addItem);
    const [isRestaurantOpen, setIsRestaurantOpen] = useState(true);
    const [canScheduleToday, setCanScheduleToday] = useState(false);

    useEffect(() => {
        setTimeout(() => setOpen(true), 10);
    }, []);

    useEffect(() => {
        captureConsumerEvent(CONSUMER_EVENTS.itemViewed, {
            restaurant_id: restaurant.id,
            restaurant_slug: slug || null,
            item_id: item.id,
            item_name: item.name,
            item_price_cents: item.price_cents,
        });
    }, [item.id, item.name, item.price_cents, restaurant.id, slug]);

    useEffect(() => {
        if (!restaurant.availability_json) return;
        const avail = restaurant.availability_json;
        const today = new Date().getDay();
        const slots = avail[today] ?? [];

        const now = new Date();
        let isOpen = false;
        let hasFutureSlotToday = false;

        for (let slot of slots) {
            const [openH, openM] = slot.open.split(":").map(Number);
            const [closeH, closeM] = slot.close.split(":").map(Number);

            const openT = new Date();
            openT.setHours(openH, openM, 0, 0);

            const closeT = new Date();
            closeT.setHours(closeH, closeM, 0, 0);

            if (now >= openT && now <= closeT) {
                isOpen = true;
                break;
            }

            if (now < openT) {
                hasFutureSlotToday = true;
            }
        }

        let manuallyClosedToday = false;
        if (restaurant.is_closed) {
            const closedDate = new Date(restaurant.is_closed);
            const businessToday = new Date();
            if (businessToday.getHours() < 4) {
                businessToday.setDate(businessToday.getDate() - 1);
            }
            manuallyClosedToday =
                closedDate.getFullYear() === businessToday.getFullYear() &&
                closedDate.getMonth() === businessToday.getMonth() &&
                closedDate.getDate() === businessToday.getDate();
        }

        setIsRestaurantOpen(isOpen && !manuallyClosedToday);
        setCanScheduleToday(!isOpen && hasFutureSlotToday && !manuallyClosedToday);
    }, [restaurant]);

    const closeWithAnimation = () => {
        setOpen(false);
        setTimeout(onClose, 200);
    };

    const changeQty = (delta: number) =>
        setQty((q) => Math.max(1, Math.min(99, q + delta)));

    const selectedCount = (group?: Record<string, number>) =>
        Object.values(group || {}).reduce((total, value) => total + value, 0);

    const changeSubitemQuantity = (
        sc: Subcategory,
        si: Subitem,
        delta: number,
    ) => {
        setSelected((prev) => {
            const group = { ...(prev[sc.id] || {}) };
            const current = group[si.id] || 0;

            if (sc.max_select === 1) {
                const nextGroup = delta > 0 && current === 0 ? { [si.id]: 1 } : {};
                setSelectionWarnings((warnings) => ({ ...warnings, [sc.id]: "" }));
                return { ...prev, [sc.id]: nextGroup };
            }

            if (
                delta > 0 &&
                sc.max_select > 0 &&
                selectedCount(group) >= sc.max_select
            ) {
                setSelectionWarnings((warnings) => ({
                    ...warnings,
                    [sc.id]: `Você pode escolher no máximo ${sc.max_select} adicional${sc.max_select === 1 ? "" : "is"} neste grupo.`,
                }));
                return prev;
            }

            const next = Math.max(0, Math.min(99, current + delta));
            if (next === 0) delete group[si.id];
            else group[si.id] = next;

            setSelectionWarnings((warnings) => ({ ...warnings, [sc.id]: "" }));
            return { ...prev, [sc.id]: group };
        });
    };

    const extrasTotal = useMemo(() => {
        let sum = 0;
        for (const sc of subcategories) {
            const group = selected[sc.id];
            if (!group) continue;
            for (const si of sc.subitems) {
                sum += si.price_cents * (group[si.id] || 0);
            }
        }
        return sum;
    }, [selected, subcategories]);

    const unitTotal = item.price_cents + extrasTotal;
    const total = unitTotal * qty;
    const displayedTotal =
        promotionPrice({
            ...item,
            unit_price_cents: unitTotal,
            qty,
        }) ?? total;

    const missingRequired = useMemo(() => {
        return subcategories.some((sc) => {
            if (sc.min_select <= 0) return false;
            return selectedCount(selected[sc.id]) < sc.min_select;
        });
    }, [selected, subcategories]);

    const canAdd = !missingRequired;
    const canOrderNow =
        isRestaurantOpen ||
        canScheduleToday ||
        restaurant.allow_future_order_scheduling === true;
    const disabledReason = !canOrderNow
        ? "O restaurante está fechado no momento."
        : missingRequired
            ? "Selecione os adicionais obrigatórios antes de adicionar."
            : "";

    const handleAdd = () => {
        if (!canAdd || !canOrderNow) return;

        const selectedSubitems: any[] = [];

        for (const sc of subcategories) {
            const group = selected[sc.id];
            if (!group) continue;

            for (const si of sc.subitems) {
                const quantity = group[si.id] || 0;
                if (quantity > 0) {
                    selectedSubitems.push({
                        subcategoryId: sc.id,
                        subcategoryName: sc.name,
                        subitemId: si.id,
                        subitemName: si.name,
                        price_cents: si.price_cents,
                        quantity,
                    });
                }
            }
        }

        addToCart({
            id: crypto.randomUUID(),
            base_item_id: item.id,
            name: item.name,
            image: item.image_public_url || "",
            qty,
            unit_price_cents: unitTotal,
            total_cents: total,
            observation,
            selectedSubitems,
            promotion: item.promotion ?? undefined
        });

        const cart = useCartStore.getState();
        const cartTotalCents = cart.items.reduce(
            (sum, cartItem) =>
                sum + (promotionPrice(cartItem) || cartItem.total_cents),
            0
        );
        const cartItemCount = cart.items.reduce(
            (sum, cartItem) => sum + cartItem.qty,
            0
        );

        captureConsumerEvent(CONSUMER_EVENTS.itemAddedToCart, {
            restaurant_id: restaurant.id,
            restaurant_slug: slug || null,
            item_id: item.id,
            item_name: item.name,
            quantity: qty,
            item_total_cents: displayedTotal,
            cart_total_cents: cartTotalCents,
            cart_item_count: cartItemCount,
        });

        if (trackMeta && slug) {
            trackMeta(slug, "AddToCart", {
                content_ids: [item.id],
                value: item.price_cents / 100,
                currency: "BRL",
            });
        }

        if (onAdd) {
            closeWithAnimation();
            setTimeout(() =>{
                onAdd();
            }, 200)
        }
        else{
            closeWithAnimation();
        }
    };

    const taxText = () => {
        if(deliveryTax.lowest === deliveryTax.highest){
            return `R$ ${formatPriceNoRS(deliveryTax.lowest)}`
        }
        return `R$ ${formatPriceNoRS(deliveryTax.lowest)}-${formatPriceNoRS(deliveryTax.highest )}`
    }

    const renderContent = () => {
        if (loading)
            return (
                <div className="flex items-center justify-center h-[55vh]">
                    <Loader />
                </div>
            );

        return (
            <>
                <div className="mt-3 px-4">
                    <h1 className="text-[22px] 2xl:text-3xl font-semibold mb-2">{item.name}</h1>

                    {item.description && (
                        <p className="text-[15px] 2xl:text-lg text-gray-700 mb-3">
                            {item.description}
                        </p>
                    )}

                    <p className="text-[18px] font-semibold 2xl:text-lg">
                        {(item.promotion && item.promotion.value > 0) ? <><span className={"text-green"}>{formatPrice(promotionPrice(item) || item.price_cents)}</span> <span className={"font-normal text-gray-400 line-through text-xs"}>{formatPrice(item.price_cents)}</span></>
                            : formatPrice(item.price_cents)
                        }
                    </p>
                </div>

                <div className="mt-6">
                    {subcategories.map((sc) => {
                        const group = selected[sc.id] || {};
                        const isSingle = sc.max_select === 1;

                        return (
                            <div key={sc.id} className="mt-4">
                                <div className="bg-gray-100 px-4 py-3 flex justify-between">
                                    <div>
                                        <p className="font-semibold text-gray-600 2xl:text-lg">
                                            {sc.name}
                                        </p>
                                        <p className="text-[13px] 2xl:text-lg text-gray-600">
                                            {sc.max_select > 0
                                                ? `Escolha até ${sc.max_select}`
                                                : "Escolha o quanto quiser"}
                                        </p>
                                    </div>

                                    {sc.min_select > 0 && (
                                        <span className="text-[11px] 2xl:text-lg text-gray-600 px-2 py-1 rounded-full">
                                            OBRIGATÓRIO
                                        </span>
                                    )}
                                </div>

                                {selectionWarnings[sc.id] && (
                                    <p className="px-4 pt-2 text-xs font-medium text-red-600 2xl:text-base">
                                        {selectionWarnings[sc.id]}
                                    </p>
                                )}

                                {[...sc.subitems]
                                    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
                                    .map((si) => {
                                        const quantity = group[si.id] || 0;
                                        const isSelected = quantity > 0;

                                        if (isSingle) {
                                            return (
                                                <button
                                                    key={si.id}
                                                    type="button"
                                                    onClick={() => changeSubitemQuantity(sc, si, isSelected ? -1 : 1)}
                                                    className="cursor-pointer 2xl:text-lg w-full px-4 py-3 flex justify-between"
                                                >
                                                    <div className="text-left">
                                                        <p className="font-medium 2xl:text-lg">{si.name.replace(/\n/g, " ")}</p>
                                                        {si.price_cents > 0 && (
                                                            <p className="text-[13px] 2xl:text-lg text-gray-500">+ {formatPrice(si.price_cents)}</p>
                                                        )}
                                                    </div>
                                                    <span className={`cursor-pointer w-7 h-7 2xl:w-10 2xl:h-10 rounded-full border flex items-center justify-center ${isSelected ? "border-brand bg-brand text-white" : "border-gray-300 bg-gray-100 text-gray-400"}`}>
                                                        <FontAwesomeIcon icon={icons.faCheck} className="text-xs 2xl:text-lg"/>
                                                    </span>
                                                </button>
                                            );
                                        }

                                        return (
                                            <div key={si.id} className="2xl:text-lg w-full px-4 py-3 flex items-center justify-between gap-4">
                                                <div className="text-left">
                                                    <p className="font-medium 2xl:text-lg">{si.name.replace(/\n/g, " ")}</p>
                                                    {si.price_cents > 0 && (
                                                        <p className="text-[13px] 2xl:text-lg text-gray-500">+ {formatPrice(si.price_cents)} cada</p>
                                                    )}
                                                </div>
                                                <div className="flex shrink-0 items-center gap-3 rounded-lg bg-gray-100 px-2 py-1.5">
                                                    <button
                                                        type="button"
                                                        aria-label={`Remover ${si.name}`}
                                                        disabled={quantity === 0}
                                                        onClick={() => changeSubitemQuantity(sc, si, -1)}
                                                        className="flex h-7 w-7 cursor-pointer items-center justify-center text-gray-500 disabled:cursor-default disabled:opacity-30"
                                                    >
                                                        <FontAwesomeIcon icon={icons.faMinus} />
                                                    </button>
                                                    <span className="min-w-5 text-center font-semibold">{quantity}</span>
                                                    <button
                                                        type="button"
                                                        aria-label={`Adicionar ${si.name}`}
                                                        onClick={() => changeSubitemQuantity(sc, si, 1)}
                                                        className="flex h-7 w-7 cursor-pointer items-center justify-center text-brand"
                                                    >
                                                        <FontAwesomeIcon icon={icons.faPlus} />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                            </div>
                        );
                    })}
                </div>

                <div className="px-4 mt-8">
                    <p className="text-[15px] 2xl:text-lg font-semibold text-gray-500">
                        <FontAwesomeIcon icon={icons.faComment} /> Alguma observação?
                    </p>

                    <textarea
                        value={observation}
                        onChange={(e) => setObservation(e.target.value.slice(0, 140))}
                        className="w-full mt-2 2xl:mt-4 2xl:text-lg p-3 border border-gray-200 rounded-xl text-sm resize-none"
                        rows={3}
                        placeholder="Ex: tirar cebola..."
                    />
                </div>
            </>
        );
    };

    return (
        <ModalMobile
            open={open}
            onClose={closeWithAnimation}
            height={0.93}
            handle={false}
            xPadding={false}
            className={"!max-h-[80vh] md:!mb-[11vh] 2xl:max-w-4xl"}
        >

            <div className={"md:grid md:grid-cols-2"}>
                <div className="relative w-full h-[260px] md:h-auto md:aspect-square ">
                    <img
                        src={item.image_public_url || "/placeholders/item.png"}
                        className="w-full h-full object-cover md:rounded-br-4xl "
                    />

                    <button
                        onClick={closeWithAnimation}
                        className="absolute left-4 2xl:text-xl 2xl:w-15 2xl:h-10 cursor-pointer top-6 w-10 h-10 bg-black/50 text-white rounded-full flex items-center justify-center"
                    >
                        <FontAwesomeIcon icon={icons.faChevronDown} className={"block md:!hidden"} />
                        <FontAwesomeIcon icon={icons.faTimes} className={"!hidden md:!block"} />
                    </button>

                    <div className="absolute left-4 bottom-4 bg-white shadow-md rounded-full px-3 2xl:px-5 pr-4 2xl:pr-8 py-2 2xl:py-2 flex items-center gap-2 leading-none">
                        {restaurant.logo_url && (
                            <img
                                src={restaurant.logo_url}
                                className="w-8 h-8 2xl:w-12 2xl:h-12 rounded-full object-cover "
                            />
                        )}

                        <div>
                            <span className="text-[13px] font-semibold 2xl:text-md">{restaurant.name}</span>
                            <br />
                            <span className="text-[12px] text-gray-600 2xl:text-md">
                                {deliveryTime.lowest}–{deliveryTime.highest} min •{" "}
                                <span className="text-green">{taxText()}</span>
                            </span>
                        </div>
                    </div>
                </div>

                <div className="pb-32 md:h-[80vh] md:overflow-y-auto md:p-4 md:pb-0">
                    <div className={" md:pb-62"}>
                        {renderContent()}
                    </div>
                </div>
            </div>

            <div className="absolute left-0 right-0 bottom-0 bg-white border-t border-gray-200 pt-5 pb-14 md:pb-8 px-4 flex items-center gap-3">
                <div className="flex items-center border border-gray-200 rounded-xl px-3 2xl:px-6 py-2 w-[110px] 2xl:w-[180px] justify-between">
                    <button
                        onClick={() => changeQty(-1)}
                        className="w-6 h-6 2xl:w-10 2xl:h-10 flex items-center justify-center text-gray-400 cursor-pointer 2xl:text-lg"
                    >
                        <FontAwesomeIcon icon={icons.faMinus} />
                    </button>

                    <span className="text-[16px] 2xl:text-lg">{qty}</span>

                    <button
                        onClick={() => changeQty(1)}
                        className="w-6 h-6 2xl:w-10 2xl:h-10 flex items-center justify-center text-brand cursor-pointer 2xl:text-lg"
                    >
                        <FontAwesomeIcon icon={icons.faPlus} />
                    </button>
                </div>

                <Tooltip
                    text={disabledReason}
                    showOnClick
                    parentClassName="flex-1"
                    size="line"
                    tooltipClassName="text-center"
                >
                    <button
                        aria-disabled={!canAdd || !canOrderNow}
                        onClick={handleAdd}
                        className={`cursor-pointer w-full 2xl:text-lg rounded-xl px-5 py-3 flex items-center justify-between text-[15px] font-semibold ${
                            !canOrderNow
                                ? "bg-gray-200 text-gray-400"
                                : canAdd
                                    ? "bg-brand text-white"
                                    : "bg-gray-200 text-gray-400"
                        }`}
                    >
                        <span>Adicionar</span>
                        <span>{formatPrice(displayedTotal)}</span>
                    </button>
                </Tooltip>
            </div>
        </ModalMobile>
    );
}