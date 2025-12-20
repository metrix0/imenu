// app/[slug]/ItemModal.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Restaurant, Item, Subitem, Subcategory } from "@/lib/types/types";
import { useCartStore } from "@/lib/stores/costumer/cartStore";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { icons } from "@/lib/utils/fontawesome";
import {formatPrice, formatPriceNoRS} from "@/lib/utils/formatPrice";
import ModalMobile from "@/components/ui/HybridModal";
import Loader from "@/components/ui/Loader";

type Props = {
    restaurant: Restaurant;
    item: Item;
    subcategories: Subcategory[];
    loading: boolean;
    onClose: () => void;
    deliveryTax: { lowest: number; highest: number  };
    deliveryTime: { lowest: number; highest: number  };
    onAdd?: () => void;
};

export default function ItemModal({
                                      restaurant,
                                      item,
                                      subcategories,
                                      loading,
                                      onClose,
                                        deliveryTax,
                                      deliveryTime,
    onAdd,
                                  }: Props) {
    const [qty, setQty] = useState(1);
    const [observation, setObservation] = useState("");
    const [open, setOpen] = useState(false);
    const [selected, setSelected] = useState<Record<string, Set<string>>>({});
    const addToCart = useCartStore((s) => s.addItem);
    const [isRestaurantOpen, setIsRestaurantOpen] = useState(true);


    useEffect(() => {
        setTimeout(() => setOpen(true), 10);
    }, []);

    useEffect(() => {
        if (!restaurant.availability_json) return;
        const avail = restaurant.availability_json;
        const today = new Date().getDay();
        const slots = avail[today] ?? [];

        const now = new Date();
        let isOpen = false;

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
        }

        setIsRestaurantOpen(isOpen);
    }, [restaurant]);

    const closeWithAnimation = () => {
        setOpen(false);
        setTimeout(onClose, 200);
    };

    const changeQty = (delta: number) =>
        setQty((q) => Math.max(1, Math.min(99, q + delta)));

    const toggleSubitem = (sc: Subcategory, si: Subitem) => {
        setSelected((prev) => {
            const set = new Set(prev[sc.id] || []);
            const single = sc.max_select === 1 || sc.max_select === 0;

            console.log(single, set, set.has(si.id));
            console.log(sc, si.id)

            if (single && set.has(si.id)) {
                console.log("clear");
                set.delete(si.id);
                return { ...prev, [sc.id]: set }; // ← THIS FIXES IT
            }

            if (single) {
                set.clear();
                set.add(si.id);
            } else {
                if (set.has(si.id)) set.delete(si.id);
                else set.add(si.id);

                if (sc.max_select > 0 && set.size > sc.max_select) {
                    const first = set.values().next().value;
                    if (first) set.delete(first);
                }
            }

            return { ...prev, [sc.id]: set };
        });
    };

    const extrasTotal = useMemo(() => {
        let sum = 0;
        for (const sc of subcategories) {
            const ids = selected[sc.id];
            if (!ids) continue;
            for (const si of sc.subitems) if (ids.has(si.id)) sum += si.price_cents;
        }
        return sum;
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
        });

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
                {/* ITEM HEADER */}

                <div className="mt-3 px-4">

                    <h1 className="text-[22px] 2xl:text-3xl font-semibold mb-2">{item.name}</h1>

                    {item.description && (
                        <p className="text-[15px] 2xl:text-lg text-gray-700 mb-3">
                            {item.description}
                        </p>
                    )}

                    <p className="text-[18px] font-semibold 2xl:text-lg">
                        {formatPrice(item.price_cents)}
                    </p>
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
                                        <span className="text-[11px] 2xl:text-lg bg-black text-white px-2 py-1 rounded-full">
                                            OBRIGATÓRIO
                                        </span>
                                    )}
                                </div>

                                {sc.subitems.map((si) => {
                                    const isSelected = set?.has(si.id);

                                    return (
                                        <button
                                            key={si.id}
                                            onClick={() =>
                                                toggleSubitem(sc, si)
                                            }
                                            className="cursor-pointer 2xl:text-lg w-full px-4 py-3 flex justify-between"
                                        >
                                            <div className="text-left">
                                                <p className="font-medium 2xl:text-lg">
                                                    {si.name.replace(/\n/g, " ")}
                                                </p>

                                                {si.price_cents > 0 && (
                                                    <p className="text-[13px] 2xl:text-lg text-gray-500">
                                                        + {formatPrice(si.price_cents)}
                                                    </p>
                                                )}
                                            </div>

                                            <div className="flex items-center ">
                                                {isSingle ? (
                                                    <span
                                                        className={`cursor-pointer w-7 h-7 2xl:w-10 2xl:h-10 rounded-full border flex items-center justify-center ${
                                                            isSelected
                                                                ? "border-brand bg-brand text-white"
                                                                : "border-gray-300 bg-gray-100 text-gray-400"
                                                        }`}
                                                    >
                                                        <FontAwesomeIcon icon={icons.faCheck} className={"text-xs 2xl:text-lg"}/>
                                                    </span>
                                                ) : (
                                                    <span
                                                        className={`w-7 h-7 2xl:w-10 2xl:h-10 rounded-full border flex items-center justify-center 2xl:text-lg ${
                                                            isSelected
                                                                ? "border-brand bg-brand text-white"
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
                    <p className="text-[15px] 2xl:text-lg font-semibold text-gray-500">
                        <FontAwesomeIcon icon={icons.faComment} /> Alguma observação?
                    </p>

                    <textarea
                        value={observation}
                        onChange={(e) =>
                            setObservation(e.target.value.slice(0, 140))
                        }
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

            {/* IMAGE HEADER */}
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
                        <span className="text-[13px] font-semibold 2xl:text-md">
                            {restaurant.name}
                        </span>
                        <br />
                        <span className="text-[12px] text-gray-600 2xl:text-md">
                            {deliveryTime.lowest}–
                            {deliveryTime.highest} min •{" "}
                            <span className="text-green">{taxText()}</span>
                        </span>
                    </div>
                </div>
            </div>


            {/* CONTENT */}
            <div className="overflow-y-auto h-screen md:h-100px md:p-4 pb-32 md:pb-0">
                <div className={" md:pb-62"}>
                {renderContent()}
                </div>
            </div>

            </div>

            {/* FOOTER */}
            <div className="absolute left-0 right-0 bottom-0 bg-white border-t border-gray-200 pt-5 pb-14 md:pb-8 px-4 flex items-center gap-3">
                <div className="flex items-center border border-gray-200 rounded-xl px-3 2xl:px-6 py-2 w-[110px] 2xl:w-[180px] justify-between">
                    <button
                        onClick={() => changeQty(-1)}
                        className="w-6 h-6 2xl:w-10 2xl:h-10 flex items-center justify-center text-gray-400 cursor-pointer  2xl:text-lg"
                    >
                        <FontAwesomeIcon icon={icons.faMinus} />
                    </button>

                    <span className="text-[16px]  2xl:text-lg">{qty}</span>

                    <button
                        onClick={() => changeQty(1)}
                        className="w-6 h-6 2xl:w-10 2xl:h-10 flex items-center justify-center text-brand cursor-pointer  2xl:text-lg"
                    >
                        <FontAwesomeIcon icon={icons.faPlus} />
                    </button>
                </div>

                <button
                    disabled={!canAdd || !isRestaurantOpen}
                    onClick={handleAdd}
                    className={`cursor-pointer w-full 2xl:text-lg flex-1 rounded-xl px-5 py-3 flex items-center justify-between text-[15px] font-semibold ${
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
        </ModalMobile>
    );
}
