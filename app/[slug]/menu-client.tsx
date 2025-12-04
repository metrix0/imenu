// app/[slug]/menu-client.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Restaurant, Menu, Category, ItemsByCategory, Item, Subitem, Subcategory } from "@/lib/types/types";
import { useCheckoutStore } from "@/lib/stores/costumer/checkoutStore";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { icons } from "@/lib/fontawesome";
import { faStar } from "@fortawesome/free-solid-svg-icons";
import { supabase } from "@/lib/supabaseClient";
import { formatPrice, formatPriceNoRS } from "@/lib/utils/formatPrice";
import ModalMobile from "@/components/ui/ModalMobile";
import ItemModal from "./ItemModal";
import CartBar from "@/components/consumidor/CartBar"
import CartModal from "./CartModal"
import WarningBox from "@/components/ui/WarningBox";


export default function MenuClientPage({
                                           slug,
                                           restaurant,
                                           menu,
                                           categories,
                                           itemsByCategory,
                                       }: {
    slug: string;
    restaurant: Restaurant;
    menu: Menu;
    categories: Category[];
    itemsByCategory: ItemsByCategory;
}) {
    const router = useRouter();



    const [loadingItemId, setLoadingItemId] = useState<string | null>(null);
    const [cartOpen, setCartOpen] = useState(false);
    const [cartStep, setCartStep] = useState<"cart" | "info" | "checkout">("cart");
    const [nextOpening, setNextOpening] = useState<Date | null>(null);
    const [todaySlots, setTodaySlots] = useState<
        { open: string; close: string }[]
    >([]);
    const [openedItem, setOpenedItem] = useState<{
        item: Item;
        subcategories: Subcategory[];
        loading: boolean;
    } | null>(null);
    const [restaurantCartWarningVisible, setRestaurantCartWarningVisible] = useState(false);
    const [orderId, setOrderId] = useState<string | null>(null);




    const handleItemClick = async (item: Item) => {
        if (!item.id) return;

        setOpenedItem({
            item,
            subcategories: [],
            loading: true,
        });

        setLoadingItemId(item.id);

        try {
            const res = await fetch(`/api/items/${item.id}/subcategories`);
            if (!res.ok) {
                console.error("Erro ao carregar complementos:", await res.text());
                return;
            }


            const normalized = await res.json(); // Already sorted + normalized by API

            setOpenedItem({
                item,
                subcategories: normalized,
                loading: false,
            });

        } finally {
            setLoadingItemId(null);
        }
    };

    const deliveryTax = (() => {
        const fees = restaurant.delivery_fee_json.map(
            (i: { fee_cents: number }) => i.fee_cents
        );

        const lowest = Math.min(...fees);
        const highest = Math.max(...fees);


        return { lowest, highest };
    })();

    const checkRestaurantAvailability = () => {
        if (!restaurant.availability_json) return;

        const availability = restaurant.availability_json;
        const today = new Date().getDay();
        const slots = availability[today] ?? [];
        setTodaySlots(slots);

        const now = new Date();

        for (let slot of slots) {
            const [openH, openM] = slot.open.split(":").map(Number);
            const [closeH, closeM] = slot.close.split(":").map(Number);

            const openDate = new Date();
            openDate.setHours(openH, openM, 0, 0);

            const closeDate = new Date();
            closeDate.setHours(closeH, closeM, 0, 0);

            if (now >= openDate && now <= closeDate) {

                setNextOpening(null);
                return;
            }

            if (now < openDate) {
                setNextOpening(openDate);
                return;
            }
        }

        setNextOpening(slots[0] ? new Date(slots[0].open) : null);
    };

    useEffect(() => {
        checkRestaurantAvailability();
    }, [restaurant]);

    useEffect(() => {
        if (restaurant?.id) {
            useCheckoutStore.getState().setRestaurantId(restaurant.id);
        }
    }, [restaurant?.id]);


    const pathname = usePathname();

    useEffect(() => {
        if (typeof document === "undefined") return;

        const cookie = document.cookie
            .split("; ")
            .find((row) => row.startsWith("order_page_entered="));

        if (!cookie) return;

        const id = cookie.split("=")[1];
        if (!id) return;

        setOrderId(id);

        requestAnimationFrame(() => {
            setRestaurantCartWarningVisible(true);
        });
    }, []);

    return (

        <div className="min-h-screen bg-white text-gray-900 pb-10">
            {/* ============================
                BANNER
            ============================ */}
            <div className="relative w-full h-[21vh] overflow-hidden">
                {restaurant.banner_url && (
                    <>
                        <img
                            src={restaurant.banner_url}
                            alt="Banner"
                            className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/0 to-transparent pointer-events-none" />
                    </>
                )}
            </div>

            {/* ============================
                CARD PRINCIPAL
            ============================ */}
            <div className="relative -mt-8">
                {restaurant.logo_url && (
                    <div className="absolute left-1/2 -translate-x-1/2 -top-8 z-20">
                        <img
                            src={restaurant.logo_url}
                            className="w-17 h-17 rounded-full border-1 border-gray-200 object-cover"
                            alt="Logo"
                        />
                    </div>
                )}

                <div className="bg-white mx-5 px-5 py-4 rounded-3xl shadow-[0_2px_10px_rgba(0,0,0,0.08)]">
                    <h1 className="text-[1.2rem] font-semibold mt-6">
                        {restaurant.name}
                    </h1>

                    <p className="text-gray-600 text-xs mt-1 border-b border-gray-200 pb-2">
                        {nextOpening === null ? "Aberto" : "Fechado"} • Min{" "}
                        {restaurant.min_order_cents
                            ? formatPrice(restaurant.min_order_cents)
                            : "R$ 0,00"}
                    </p>

                    {(
                        <div className="flex items-center gap-2 mt-3 text-xs border-b border-gray-200 pb-3">
                            <FontAwesomeIcon
                                icon={faStar}
                                className="text-gray-700"
                            />
                            <span className="font-semibold">
                                4.7
                            </span>
                            <span className="text-gray-500">
                                (427 avaliações)
                            </span>
                        </div>
                    )}

                    <div className="flex items-center gap-2 mt-3 text-xs font-bold">
                        <span>Entrega</span>
                        <span>•</span>
                        <span>
                            {restaurant.prep_time_min_minutes} -{" "}
                            {restaurant.prep_time_max_minutes} min
                        </span>
                        <span>•</span>
                        <span className={"text-green"}>R$ {formatPriceNoRS(deliveryTax.lowest)}-{formatPriceNoRS(deliveryTax.highest )}</span>
                    </div>
                </div>
            </div>

            {nextOpening !== null && (
                <WarningBox icon={icons.faTriangleExclamation} className="mt-10 mx-6 ">
                    Restaurante fechado. Abre em <b>
                    {" "}
                    {Math.floor((nextOpening.getTime() - new Date().getTime()) / 3600000)
                        .toString()
                        .padStart(1, "0")}
                    h{" "}
                    {Math.floor(
                        ((nextOpening.getTime() - new Date().getTime()) % 3600000) / 60000
                    )
                        .toString()
                        .padStart(2, "0")}
                </b>
                    .
                    {todaySlots.length > 0 && (
                        <div className="text-sm mt-2">
                            Horários de Abertura:
                            {todaySlots.map((slot, i) => (
                                <div key={i}>
                                    {slot.open} - {slot.close}
                                </div>
                            ))}
                        </div>
                    )}
                </WarningBox>

            )}




            {/* ============================
                CATEGORIAS
            ============================ */}
            <div className="mt-8 px-4 space-y-12 pb-20">
                {categories.map((cat) => (
                    <div key={cat.id}>
                        <h2 className="text-xl font-medium mb-4">
                            {cat.name}
                        </h2>

                        <div className="grid grid-cols-3 gap-[4dvw] ">
                            {itemsByCategory[cat.id]?.map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => handleItemClick(item)}
                                    className={`text-left ${
                                        loadingItemId === item.id
                                            ? "opacity-60"
                                            : ""
                                    }`}
                                >
                                    <div className="w-full h-[29dvw] rounded-2xl overflow-hidden bg-gray-200 shadow-sm">
                                        <img
                                            src={item.image_public_url || ""}
                                            className="w-full h-full object-cover"
                                            alt={item.name}
                                        />
                                    </div>

                                    <div className="mt-3 flex flex-col h-[55px] justify-start">
                                        <p className="font-semibold text-sm">
                                            {formatPrice(item.price_cents)}
                                        </p>

                                        <p className="text-sm text-gray-700 line-clamp-2 leading-snug">
                                            {item.name}
                                        </p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* ============================
                ITEM MODAL
            ============================ */}
            {openedItem && (
                <ItemModal
                    restaurant={restaurant}
                    item={openedItem.item}
                    subcategories={openedItem.subcategories}
                    loading={openedItem.loading}
                    onClose={() => setOpenedItem(null)}
                    deliveryTax={deliveryTax}
                />
            )}


            {/* AQUI! */}
            {nextOpening === null && (
                <CartBar
                    onOpenCartAction={() => {
                        if (!cartOpen) {
                            setCartOpen(true);
                        } else {setCartStep("info");
                        }
                    }}
                    cartOpen={cartOpen}
                    setCartOpenAction={setCartOpen}
                    restaurant={restaurant}
                />
            )}


            {cartOpen && (
                <CartModal

                    restaurant={restaurant}
                    onClose={() => {
                        setCartOpen(false);
                        setCartStep("cart"); // reset to first page when closing
                    }}
                    step={cartStep}
                    setStep={setCartStep}
                />
            )}

            <ModalMobile
                open={restaurantCartWarningVisible}
                onClose={() => setRestaurantCartWarningVisible(false)}
                height={0.30}
                handle={true}
            >
                <div className="text-center px-6 pt-2">
                    <div className="text-text text-md font-medium mb-2 mt-2">Pedido identificado.</div>

                    <p className="text-gray-500 mb-4 text-sm">
                        Você realizou um pedido aqui recentemente, gostaria de ir até a página deste pedido?
                    </p>

                    <button
                        className="bg-brand text-white w-full py-3 rounded-lg text-sm mb-3"
                        onClick={() => {
                            setRestaurantCartWarningVisible(false);

                            if (!orderId) return;
                            setTimeout(() => {
                                try {
                                    router.push(`${pathname}/${orderId}`);
                                } catch (err) {
                                    console.error("navigate error:", err);
                                }
                            }, 180);
                        }}
                    >
                        Ir ao pedido
                    </button>

                    <p
                        className="text-brand text-sm mt-4 cursor-pointer"
                        onClick={() => setRestaurantCartWarningVisible(false)}
                    >
                        Não, obrigado
                    </p>
                </div>
            </ModalMobile>



        </div>


    );
}
