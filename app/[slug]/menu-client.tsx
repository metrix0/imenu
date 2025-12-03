// app/[slug]/menu-client.tsx
"use client";

import { Restaurant, Menu, Category, ItemsByCategory, Item } from "@/lib/stores/types";
import { useRouter, usePathname } from "next/navigation";
import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronRight, faStar, faTriangleExclamation } from "@fortawesome/free-solid-svg-icons";
import { supabase } from "@/lib/supabaseClient";
import ItemModal from "./ItemModal";
import CartBar from "@/components/consumidor/CartBar"
import CartModal from "./CartModal"
import { useCartStore } from "@/lib/stores/costumer/cartStore";
import { useCheckoutStore } from "@/lib/stores/costumer/checkoutStore";
import { useEffect } from "react";
import RestaurantCartWarningModal from "@/components/GenericModal";
import { Subitem, Subcategory } from "@/lib/stores/types";
import DraggableModal from "@/components/ui/ModalMobile"; // path you chose



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


    const formatPrice = (cents: number) =>
        (cents / 100).toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
        });

    const formatPriceNoRS = (cents: number) =>
        (cents / 100)
            .toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
            .replace("R$", "")
            .trim();


    // ============================================================
    // 🔥 NEW: open modal instantly, load details in background
    // ============================================================
    const handleItemClick = async (item: Item) => {
        if (!item.id) return;

        // 1. Open modal IMMEDIATELY with loading=true
        setOpenedItem({
            item,
            subcategories: [],
            loading: true,
        });

        //await new Promise((r) => setTimeout(r, 1500)); // SIMULATE LOADING
        // 2. Now fetch in background
        setLoadingItemId(item.id);

        try {
            const { data, error } = await supabase
                .from("item_subcategories")
                .select(`
                    id,
                    name,
                    description,
                    min_select,
                    max_select,
                    position,
                    subitems:subitems (
                        id,
                        item_subcategory_id,
                        name,
                        description,
                        price_cents,
                        is_available,
                        position
                    )
                `)
                .eq("item_id", item.id);

            if (error) {
                console.error("Erro ao carregar complementos:", error);
                return;
            }

            // 3. Process subcategories
            const normalized = (data || []).map((sc: any) => ({
                id: sc.id,
                name: sc.name,
                description: sc.description,
                min_select: sc.min_select,
                max_select: sc.max_select,
                position: sc.position,
                subitems:
                    (sc.subitems || [])
                        .slice()
                        .sort((a: any, b: any) => a.position - b.position)
                        .map(
                            (si: any): Subitem => ({
                                id: si.id,
                                item_subcategory_id: si.item_subcategory_id,
                                name: si.name,
                                description: si.description,
                                price_cents: si.price_cents,
                                is_available: si.is_available,
                                position: si.position,
                            })
                        ) || [],
            }));

            // 4. Update modal content
            setOpenedItem({
                item,
                subcategories: normalized.sort(
                    (a, b) => a.position - b.position
                ),
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

        console.log("lowest:", lowest, "highest:", highest);

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

            console.log(openDate,closeDate,now)

            if (now >= openDate && now <= closeDate) {
                // Currently open
                console.log("OPENNN!!!")
                setNextOpening(null);
                return;
            }

            if (now < openDate) {
                // Will open later today
                setNextOpening(openDate);
                return;
            }
        }

        // All slots passed → restaurant closed today
        setNextOpening(slots[0] ? new Date(slots[0].open) : null);
    };

    useEffect(() => {
        checkRestaurantAvailability();
    }, [restaurant]);

    // ============================================================
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

        console.log("SET ORDER ID", id);
        setOrderId(id); // <-- IMPORTANT! THIS UPDATES REACT STATE

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

                    {restaurant.rating && (
                        <div className="flex hidden items-center gap-2 mt-3 text-xs border-b border-gray-200 pb-3">
                            <FontAwesomeIcon
                                icon={faStar}
                                className="text-gray-700"
                            />
                            <span className="font-semibold">
                                {restaurant.rating.toFixed(1)}
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
                <div className="p-4 bg-warning-bg text-warning mt-10 rounded-2xl mx-6 flex gap-4 items-center">
                    <FontAwesomeIcon icon={faTriangleExclamation} className={"text-lg"}/>
                    <div>
                        Restaurante fechado. Abre em<b>{" "}
                    {Math.floor((nextOpening.getTime() - new Date().getTime()) / 3600000)
                        .toString()
                        .padStart(1, "0")}
                    h{" "}
                    {Math.floor(
                        ((nextOpening.getTime() - new Date().getTime()) % 3600000) / 60000
                    )
                        .toString()
                        .padStart(2, "0")}</b>
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
                    </div>
                </div>

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

                        <div className="grid grid-cols-3 gap-[4dvw]">
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

                                    <p className="font-semibold mt-3 text-sm">
                                        {formatPrice(item.price_cents)}
                                    </p>

                                    <p className="text-sm text-gray-700 line-clamp-2">
                                        {item.name}
                                    </p>
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
                />
            )}


            {/* AQUI! */}
            {nextOpening === null && (
                <CartBar
                    onOpenCartAction={() => {
                        if (!cartOpen) {
                            console.log("!CART OPEN")
                            setCartOpen(true);
                        } else {
                            console.log("CART OPEN")
                            setCartStep("info");
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

            <RestaurantCartWarningModal
                modalVisible={restaurantCartWarningVisible}
                setModalVisible={setRestaurantCartWarningVisible}
                setCartOpenAction={() => {
                    console.log("ORDER ID:", orderId); // SHOULD BE CORRECT NOW

                    if (!orderId) {
                        console.log("OrderId not ready yet!");
                        return;
                    }

                    router.push(`${pathname}/${orderId}`);
                }}
                restaurant={restaurant}
            />
        </div>


    );
}
