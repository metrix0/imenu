// app/[slug]/menu-client.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Restaurant, Menu, Category, ItemsByCategory, Item, Subitem, Subcategory } from "@/lib/types/types";
import { useCheckoutStore } from "@/lib/stores/costumer/checkoutStore";
import { useCartStore } from "@/lib/stores/costumer/cartStore";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { icons } from "@/lib/utils/fontawesome";
import { faChair, faStar } from "@fortawesome/free-solid-svg-icons";
import { supabase } from "@/lib/database/supabaseClient";
import Input from "@/components/ui/Input";
import { formatPrice, formatPriceNoRS, promotionPrice } from "@/lib/utils/formatPrice";
import ModalMobile from "@/components/ui/HybridModal";
import ItemModal from "./ItemModal";
import CartBar from "@/components/costumer/CartBar"
import CartModal from "./CartModal"
import WarningBox from "@/components/ui/WarningBox";
import Tabs from "@/components/ui/Tabs";
import SearchModal from "./SearchModal";
import HistoryModal from "@/components/costumer/HistoryModal";
import type { QrTableMenuContext } from "@/lib/qr-table/types";
import { parseNeighborhoodDeliveryRules } from "@/lib/delivery/neighborhood";



export default function MenuClientPage({
                                           slug,
                                           restaurant,
                                           categories,
                                           itemsByCategory,
    selectedCouponCode,
    openedProductId,
    tableOrder,
                                       }: {
    slug: string;
    restaurant: Restaurant;
    categories: Category[];
    itemsByCategory: ItemsByCategory;
    openedProductId?: string | null;
    selectedCouponCode?: string | null;
    tableOrder?: QrTableMenuContext | null;
}) {
    const router = useRouter();

    const [historyOpen, setHistoryOpen] = useState(false);
    const coupon_code = useCheckoutStore((s) => s.coupon_code);
    const coupon_value = useCheckoutStore((s) => s.coupon_value);
    const coupon_type = useCheckoutStore((s) => s.coupon_type);
    const coupon_id = useCheckoutStore((s) => s.coupon_id);
    const coupon_discount_cents = useCheckoutStore((s) => s.coupon_discount_cents);
    const setField = useCheckoutStore((s) => s.setField);
    const [loadingItemId, setLoadingItemId] = useState<string | null>(null);
    const [cartOpen, setCartOpen] = useState(false);
    const [cartStep, setCartStep] = useState<"cart" | "info" | "checkout">("cart");
    const [nextOpening, setNextOpening] = useState<Date | null>(null);
    const [isRestaurantOpen, setIsRestaurantOpen] = useState(false);
    const [availabilityChecked, setAvailabilityChecked] = useState(false);
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
    const [closedForToday, setClosedForToday] = useState(false);
    const [searchText, setSearchText] = useState("");
    const [searchOpen, setSearchOpen] = useState(false);
    const [showMobileSearch, setShowMobileSearch] = useState(false);
    const [activeTab, setActiveTab] = useState(categories[0]?.name ?? "");
    const [manualScrollLock, setManualScrollLock] = useState(false);
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [couponUsed, setCouponUsed] = useState("");
    const isItemModalOpen = Boolean(openedItem);
    const isTableOrder = Boolean(tableOrder);
    const [selectedTableId, setSelectedTableId] = useState(
        tableOrder?.tableId || ""
    );
    const selectedTable = tableOrder?.tables.find(
        (table) => table.id === selectedTableId
    );

    useEffect(() => {
        if (!tableOrder) return;

        const checkout = useCheckoutStore.getState();
        checkout.setField("coupon_id", null);
        checkout.setField("coupon_code", null);
        checkout.setField("coupon_type", null);
        checkout.setField("coupon_value", null);
        checkout.setField("coupon_max_value", null);
        checkout.setField("coupon_min_order", null);
        checkout.setField("coupon_discount_cents", null);
        useCheckoutStore.setState({
            is_pickup: false,
            scheduled_for: null,
        } as any);
    }, [tableOrder]);

    function trackMeta(slug: string, eventName: string, customData?: any) {
        const eventID =
            crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;

        const fbq = (window as any).fbq;
        if (typeof fbq === "function") {
            fbq("track", eventName, customData ?? {}, { eventID });
        }

        fetch("/api/meta", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                slug,
                event_name: eventName,
                event_id: eventID,
                custom_data: customData ?? {},
                fbp: document.cookie.match(/_fbp=([^;]+)/)?.[1],
                fbc: document.cookie.match(/_fbc=([^;]+)/)?.[1],
            }),
        }).catch(() => {});
    }

    useEffect(() => {
        const shouldLockScroll = cartOpen || isItemModalOpen;

        if (shouldLockScroll) {
            document.body.style.overflow = "hidden";
            document.body.style.touchAction = "none";
        } else {
            document.body.style.overflow = "";
            document.body.style.touchAction = "";
        }

        return () => {
            document.body.style.overflow = "";
            document.body.style.touchAction = "";
        };
    }, [cartOpen, isItemModalOpen]);

    useEffect(() => {
        if (!selectedCouponCode) return;
        if (coupon_code === selectedCouponCode) return;
        setField("coupon_code", selectedCouponCode);
    }, [selectedCouponCode]);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchText);
        }, 300);

        return () => clearTimeout(timer);
    }, [searchText]);


    useEffect(() => {
        if(coupon_code === couponUsed) return
        if (!useCheckoutStore.getState().coupon_code || !restaurant?.id) {
            const store = useCheckoutStore.getState();
            store.setField("coupon_id", null);
            store.setField("coupon_code", null);
            store.setField("coupon_type", null);
            store.setField("coupon_value", null);
            store.setField("coupon_max_value", null);
            store.setField("coupon_min_order", null);
            store.setField("coupon_discount_cents", null);
            return;
        }

        const fetchCouponOnce = async () => {
            const { data, error } = await supabase
                .from("coupons")
                .select(`
                id,
                code,
                discount_type,
                discount_value,
                max_discount_value,
                min_order_value,
                one_coupon_per_user
            `)
                .eq("code", useCheckoutStore.getState().coupon_code)
                .eq("restaurant_id", restaurant.id)
                .eq("active", true)
                .single();

            if (error || !data) {
                const store = useCheckoutStore.getState();
                store.setField("coupon_id", null);
                store.setField("coupon_code", null);
                store.setField("coupon_type", null);
                store.setField("coupon_value", null);
                store.setField("coupon_max_value", null);
                store.setField("coupon_min_order", null);
                store.setField("coupon_discount_cents", null);
                return;
            }

            const store = useCheckoutStore.getState();
            store.setField("coupon_id", data.id);
            store.setField("coupon_code", data.code);
            store.setField("coupon_type", data.discount_type);
            store.setField("coupon_value", data.discount_value);
            store.setField("coupon_max_value", data.max_discount_value);
            store.setField("coupon_min_order", data.min_order_value);
            store.setField("coupon_one_coupon_per_user", data.one_coupon_per_user)
        };


        fetchCouponOnce();
    }, [coupon_code, restaurant?.id]);

    useEffect(() => {
        const cart = useCartStore.getState();
        const checkout = useCheckoutStore.getState();

        try {
            if (checkout.coupon_id && checkout.coupon_code && checkout.coupon_one_coupon_per_user === true) {
                const raw = localStorage.getItem(`coupon_used_${checkout.restaurantId}`);
                if (raw) {
                    const stored = JSON.parse(raw);

                    const isSameCoupon =
                        stored.coupon_id === checkout.coupon_id &&
                        stored.coupon_code === checkout.coupon_code;


                    if (isSameCoupon) {
                        setCouponUsed(checkout.coupon_code)
                        checkout.setField("coupon_discount_cents", null);
                        checkout.setField("coupon_id", null);
                        checkout.setField("coupon_type", null);
                        checkout.setField("coupon_code", null);
                        return;
                    }
                }
            }
        } catch (err) {
            console.error("[COUPON] Failed to read stored coupon usage", err);
        }

        if (!checkout.coupon_id || !checkout.coupon_type) {
            checkout.setField("coupon_discount_cents", null);
            return;
        }

        const cartSubtotal = cart.items.reduce(
            (sum, i) => sum + (promotionPrice(i) || i.total_cents),
            0
        );

        const deliveryFee =
            typeof checkout.delivery_fee_cents === "number" || "string"
                ? Number(checkout.delivery_fee_cents)
                : 0;

        if (
            checkout.coupon_min_order &&
            cartSubtotal < checkout.coupon_min_order
        ) {
            checkout.setField("coupon_discount_cents", null);
            return;
        }

        let discountCents = 0;

        if (checkout.coupon_type === "percent") {
            discountCents = Math.floor(
                cartSubtotal * checkout.coupon_value!
            );
        }

        if (checkout.coupon_type === "fixed") {
            discountCents = checkout.coupon_value!;
        }

        if (checkout.coupon_type === "delivery") {
            discountCents = deliveryFee;
        }

        if (
            checkout.coupon_max_value &&
            discountCents > checkout.coupon_max_value
        ) {
            discountCents = checkout.coupon_max_value;
        }

        discountCents = Math.min(
            discountCents,
            cartSubtotal + deliveryFee
        );

        checkout.setField("coupon_discount_cents", discountCents);
    }, [
        useCartStore((s) => s.items),
        useCheckoutStore((s) => s.delivery_fee_cents),
        useCheckoutStore((s) => s.coupon_type),
        useCheckoutStore((s) => s.coupon_value),
        useCheckoutStore((s) => s.coupon_max_value),
        useCheckoutStore((s) => s.coupon_min_order),
        useCheckoutStore((s) => s.coupon_id),
        useCheckoutStore((s) => s.coupon_code),
    ]);



    useEffect(() => {
        const btn = document.querySelector(
            `button[data-tab="${CSS.escape(activeTab)}"]`
        );
        if (btn) {
            btn.scrollIntoView({ behavior: "smooth", inline: "center" });
        }
    }, [activeTab]);

    useEffect(() => {
        if (!restaurant?.is_closed) {
            setClosedForToday(false);
            return;
        }

        const closedDate = new Date(restaurant.is_closed);
        const now = new Date();

        if (now.getHours() < 4) {
            now.setDate(now.getDate() - 1);
        }


        const sameDay =
            closedDate.getFullYear() === now.getFullYear() &&
            closedDate.getMonth() === now.getMonth() &&
            closedDate.getDate() === now.getDate();

        setClosedForToday(sameDay);
    }, [restaurant?.is_closed]);

    useEffect(() => {
        if (openedProductId) {
            const allItems = Object.values(itemsByCategory).flat();
            const item = allItems.find(i => i.id === openedProductId);
            if (item) {
                handleItemClick(item);
            }
        }
    }, []);


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


            const normalized = await res.json();

            setOpenedItem({
                item,
                subcategories: normalized,
                loading: false,
            });

        } finally {
            setLoadingItemId(null);
        }
    };

    const handleTabChange = (tab: string) => {
        setManualScrollLock(true);
        setActiveTab(tab);

        setTimeout(() => {
            const btn = document.querySelector(
                `button[data-tab="${CSS.escape(tab)}"]`
            );
            if (btn) btn.scrollIntoView({ behavior: "smooth", inline: "center" });
        }, 0);

        const cat = categories.find(c => c.name === tab);
        if (!cat) return;
        const el = document.getElementById(`cat-${cat.id}`);
        if (el) {
            const yOffset = -250;
            const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
            window.scrollTo({ top: y, behavior: "smooth" });
        }


        setTimeout(() => setManualScrollLock(false), 600);
    };


    const filteredItemsByCat = Object.fromEntries(
        Object.entries(itemsByCategory).map(([catId, arr]) => [
            catId,
            debouncedSearch
                ? arr.filter(i =>
                    i.name.toLowerCase().includes(debouncedSearch.toLowerCase())
                )
                : arr,
        ])
    );
    const taxText = () => {

        if(deliveryTax.lowest === deliveryTax.highest){
            return `R$ ${formatPriceNoRS(deliveryTax.lowest)}`
        }
        return `R$ ${formatPriceNoRS(deliveryTax.lowest)}-${formatPriceNoRS(deliveryTax.highest )}`
    }

    useEffect(() => {
        const hScroll = document.querySelector('.scroll-wrapper');
        if (!hScroll) return;

        if (hScroll.scrollWidth > hScroll.clientWidth) {
            hScroll.classList.add('visible');
        }
    }, []);

    const deliveryTax = (() => {
        const rules = restaurant.delivery_fee_mode === "neighborhood"
            ? parseNeighborhoodDeliveryRules(restaurant.delivery_neighborhood_fee_json)
            : restaurant.delivery_fee_json;
        const fees = rules.map(
            (i: { fee_cents: number }) => i.fee_cents
        );

        const lowest = Math.min(...fees);
        const highest = Math.max(...fees);


        return { lowest, highest };
    })();

    const deliveryTime = (() => {
        const fees = restaurant.delivery_fee_json.map(
            (i: { time_minutes: number }) => i.time_minutes
        );

        const lowest = Math.min(...fees);
        let highest = Math.max(...fees);

        if(highest-lowest >= 20){
            highest = lowest+20
        }

        return { lowest, highest };
    })();

    const deliveryText = (()=>{

        if(deliveryTime.lowest === deliveryTime.highest){
            return `${deliveryTime.lowest} min`
        }
        return `${deliveryTime.lowest}-${deliveryTime.highest} min`
    })


    const checkRestaurantAvailability = () => {
        setIsRestaurantOpen(false);

        if (!restaurant.availability_json) {
            setTodaySlots([]);
            setNextOpening(null);
            return;
        }


        const availability = restaurant.availability_json;
        const today = new Date().getDay();
        const slots = availability[today] ?? [];
        setTodaySlots(slots);

        const now = new Date();

        if (!Array.isArray(slots) || slots.length === 0) {
            setTodaySlots([]);

            if (restaurant.allow_future_order_scheduling === true) {
                for (let i = 1; i <= 7; i++) {
                    const nextDay = (today + i) % 7;
                    const nextSlots = availability[nextDay];

                    if (Array.isArray(nextSlots) && nextSlots.length > 0) {
                        const [openH, openM] = nextSlots[0].open.split(":").map(Number);
                        const next = new Date();
                        next.setDate(now.getDate() + i);
                        next.setHours(openH, openM, 0, 0);
                        setNextOpening(next);
                        return;
                    }
                }
            }

            setNextOpening(null);
            return;
        }


        for (let slot of slots) {
            const [openH, openM] = slot.open.split(":").map(Number);
            const [closeH, closeM] = slot.close.split(":").map(Number);

            const openDate = new Date();
            openDate.setHours(openH, openM, 0, 0);

            const closeDate = new Date();
            closeDate.setHours(closeH, closeM, 0, 0);

            console.log("NOW",now,"open", openDate, closeDate, now >= openDate && now <= closeDate)

            if (now >= openDate && now <= closeDate) {

                setIsRestaurantOpen(true);
                setNextOpening(null);
                return;
            }

            if (now < openDate) {
                setNextOpening(openDate);
                return;
            }
        }

        console.log(slots)

        if (restaurant.allow_future_order_scheduling !== true) {
            setNextOpening(null);
            return;
        }

        for (let i = 1; i <= 7; i++) {
            const nextDay = (today + i) % 7;
            const nextSlots = availability[nextDay];

            if (Array.isArray(nextSlots) && nextSlots.length > 0) {
                const [openH, openM] = nextSlots[0].open.split(":").map(Number);
                const next = new Date();
                next.setDate(now.getDate() + i);
                next.setHours(openH, openM, 0, 0);
                setNextOpening(next);
                return;
            }
        }

        setNextOpening(null);
    };

    const couponLabel = () => {
        if (!coupon_code || !coupon_type ) return null;

        if (coupon_type === "delivery") {
            return `ENTREGA GRÁTIS`;
        }

        if (coupon_value === null) return null;

        if (coupon_type === "percent") {
            return `${coupon_value*100}% OFF`;
        }

        if (coupon_type === "fixed") {
            return `R$ ${formatPriceNoRS(coupon_value!)} OFF`;
        }



        return null;
    };

    useEffect(() => {
        const onScroll = () => {
            const threshold = window.innerHeight * 0.30;
            setShowMobileSearch(window.scrollY > threshold);
        };
        window.addEventListener("scroll", onScroll);
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    useEffect(() => {
        checkRestaurantAvailability();
        setAvailabilityChecked(true);
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
            .find((row) => row.startsWith("order_page_entered"));

        if (!cookie) return;

        const id = cookie.split("=")[1];
        const restaurantId = cookie.split("_id_")[1].split("=")[0];

        if (!id) return;
        if(restaurantId === restaurant.id){
            setOrderId(id);

            requestAnimationFrame(() => {
                setRestaurantCartWarningVisible(true);
            });
        }
    }, []);

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (manualScrollLock) return;
                entries.forEach((e) => {
                    if (e.isIntersecting) {
                        const id = e.target.getAttribute("data-cat")!;
                        const cat = categories.find((c) => c.id.toString() === id);
                        if (cat) setActiveTab(cat.name);
                    }
                });
            },
            {
                root: null,
                rootMargin: "-20% 0px -70% 0px"
            }
        );

        categories.forEach((cat) => {
            const el = document.getElementById(`cat-${cat.id}`);
            if (el) {
                el.setAttribute("data-cat", cat.id.toString());
                observer.observe(el);
            }
        });

        return () => observer.disconnect();
    }, [categories, manualScrollLock]);

    const canScheduleToday = (() => {
        if (!nextOpening || closedForToday) return false;
        const now = new Date();
        return nextOpening.getTime() > now.getTime() &&
            nextOpening.getFullYear() === now.getFullYear() &&
            nextOpening.getMonth() === now.getMonth() &&
            nextOpening.getDate() === now.getDate();
    })();

    const nextOpeningForWarning = (() => {
        if (!restaurant.availability_json) return null;

        const availability = restaurant.availability_json;
        const now = new Date();
        const today = now.getDay();

        for (let i = 0; i <= 7; i++) {
            const day = (today + i) % 7;
            const slots = availability[day];

            if (!Array.isArray(slots) || slots.length === 0) continue;

            for (const slot of slots) {
                const [openH, openM] = slot.open.split(":").map(Number);
                const opening = new Date(now);
                opening.setDate(now.getDate() + i);
                opening.setHours(openH, openM, 0, 0);

                if (opening > now) return opening;
            }
        }

        return null;
    })();

    const warningOpening = nextOpening ?? nextOpeningForWarning;

    const openingHoursSlots = (() => {
        if (closedForToday || !warningOpening) return todaySlots;
        const slots = restaurant.availability_json?.[warningOpening.getDay()] ?? [];
        return Array.isArray(slots) ? slots : [];
    })();

    console.log(nextOpening, closedForToday)

    return (

        <div className="min-h-screen bg-white text-gray-900 pb-10">
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

            <div className="relative -mt-8 ">
                {restaurant.logo_url && (
                    <div className="absolute left-1/2 -translate-x-1/2 -top-10 md:-top-8 z-20">
                        <img
                            src={restaurant.logo_url}
                            className="h-[78px] w-[78px] md:w-23 md:h-23 2xl:h-30 2xl:w-30 rounded-full border-1 border-gray-200 object-cover"
                            alt="Logo"
                        />
                    </div>
                )}

                <div className="bg-white mx-5 md:mx-48 2xl:mx-80 px-5 py-4 2xl:py-7 rounded-3xl shadow-[0_2px_10px_rgba(0,0,0,0.08)]">
                    <h1 className="text-[1.2rem] 2xl:text-2xl font-semibold mt-6 md:max-w-[45%]">
                        {restaurant.name}
                    </h1>

                    <p className="text-gray-600 text-xs 2xl:text-[1rem] mt-1 border-b border-gray-200 pb-2">
                        {(isRestaurantOpen && !closedForToday) ? "Aberto" : "Fechado" }
                        {isTableOrder ? (
                            <> • {selectedTable?.name || tableOrder?.tableName || "Atendimento na mesa"}</>
                        ) : (
                            <> • Min{" "}
                                {restaurant.min_order_cents
                                    ? formatPrice(restaurant.min_order_cents)
                                    : "R$ 0,00"}
                            </>
                        )}
                    </p>

                    <div className={"block md:flex justify-between mt-3"}>
                        {isTableOrder ? (
                            <div className="flex items-center gap-2 text-xs font-bold 2xl:text-[1rem]">
                                <FontAwesomeIcon icon={faChair} />
                                <span>Pedido direto da mesa</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 text-xs 2xl:text-[1rem] font-bold">
                                <span>Entrega</span>
                                <span>•</span>
                                <span>{deliveryText()}</span>
                                <span>•</span>
                                <span className={"text-green"}>{taxText()}</span>
                            </div>
                        )}
                        <div className={"hidden md:inline-block"}>
                            {!isTableOrder && (coupon_code && coupon_type) && (
                                <div className="px-2.5 py-1.5 rounded-lg bg-brand/10 text-brand text-xs 2xl:text-sm font-normal">
                                    <FontAwesomeIcon icon={icons.faTicket} /> CUPOM {coupon_code} APLICADO - <b>{couponLabel()}</b>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            {!isTableOrder && coupon_code && (
            <div className={"mt-6 -mb-4 mx-5 flex md:hidden justify-center"}>
                    <div className="px-2.5 py-1.5 rounded-lg bg-brand/10 text-brand text-xs 2xl:text-sm font-normal">
                        <FontAwesomeIcon icon={icons.faTicket} /> CUPOM {coupon_code} APLICADO - <b>{couponLabel()}</b>
                    </div>
            </div>
            )}

            {availabilityChecked && (!isRestaurantOpen || closedForToday) && (
                <WarningBox icon={icons.faTriangleExclamation} className="mt-10 mx-5 md:mx-48 2xl:mx-80">
                    {closedForToday && (
                        "Hoje o restaurante está fechado no horário comum de funcionamento, devido à possíveis feriados ou eventos especiais."
                        )}
                    {!isTableOrder && canScheduleToday && nextOpening && (
                        <>
                            Restaurante fechado no momento. <b>{restaurant.allow_future_order_scheduling === true
                                ? "Você pode montar seu pedido e agendar para qualquer dia"
                                : "Você pode montar seu pedido e agendar para hoje"}</b>.
                        </>
                    )}
                    {warningOpening !== null && !closedForToday && (!canScheduleToday || isTableOrder) && (() => {
                        const now = new Date();
                        const diffMs = warningOpening.getTime() - now.getTime();

                        if (diffMs <= 0) return null;

                        const todayStart = new Date(now);
                        todayStart.setHours(0, 0, 0, 0);
                        const openingStart = new Date(warningOpening);
                        openingStart.setHours(0, 0, 0, 0);
                        const days = Math.round((openingStart.getTime() - todayStart.getTime()) / 86_400_000);
                        const weekdayRaw = warningOpening.toLocaleDateString("pt-BR", { weekday: "long" });
                        const weekday = weekdayRaw.charAt(0).toUpperCase() + weekdayRaw.slice(1);
                        const weekdayPreposition = [0, 6].includes(warningOpening.getDay()) ? "no" : "na";

                        if (days === 1) {
                            return (
                                <>
                                    Restaurante fechado. Abre <b>amanhã, {weekday}</b>.
                                </>
                            );
                        }

                        if (days > 1) {
                            return (
                                <>
                                    Restaurante fechado. Abre em <b>{days} dias, {weekdayPreposition} {weekday}</b>.
                                </>
                            );
                        }

                        const totalMinutes = Math.floor(diffMs / 60000);
                        const hours = Math.floor(totalMinutes / 60);
                        const minutes = totalMinutes % 60;

                        return (
                            <>
                                Restaurante fechado. Abre em <b>
                                {hours}h {minutes.toString().padStart(2, "0")}min
                            </b>.
                            </>
                        );
                    })()}
                    {!isTableOrder &&
                        restaurant.allow_future_order_scheduling === true &&
                        warningOpening !== null &&
                        !closedForToday &&
                        !canScheduleToday && (
                            <> <b>Você pode montar seu pedido e agendar para qualquer dia</b>.</>
                        )}


                    {openingHoursSlots.length > 0 && (
                        <div className="text-sm mt-2">
                            Horários de Abertura:
                            {openingHoursSlots.map((slot, i) => (
                                <div key={i}>
                                    {slot.open} - {slot.close}
                                </div>
                            ))}
                        </div>
                    )}
                </WarningBox>

            )}

            <div
                className={`
        top-7 right-5 fixed flex gap-4 md:hidden
        transition-all duration-300 ease-out
        ${showMobileSearch
                    ? "opacity-0 translate-y-2 pointer-events-none"
                    : "opacity-100 translate-y-0"}
    `}
            >
                {!isTableOrder && (
                    <div onClick={() => setHistoryOpen(true)}
                        className="cursor-pointer pointer-events-auto h-10 w-10 rounded-full bg-black/50 text-white flex justify-center items-center">
                        <FontAwesomeIcon icon={icons.faHistory} />
                    </div>
                )}

                <div
                    onClick={() => setSearchOpen(true)}
                    className="h-10 w-10 rounded-full bg-black/50 text-white flex justify-center items-center"
                >
                    <FontAwesomeIcon icon={icons.faMagnifyingGlass} />
                </div>
            </div>


            <div
                className={`
        md:hidden fixed w-full top-0 bg-white z-[40] border-b border-gray-100
        transition-all duration-300 ease-out
        ${showMobileSearch
                    ? "opacity-100 translate-y-0"
                    : "opacity-0 -translate-y-2 pointer-events-none"}
    `}
            >
                <div className="px-4 py-2 shadow-sm flex items-center gap-3">
                    <button
                        onClick={() => setSearchOpen(true)}
                        className="flex-1 focus:outline-none"
                        onFocus={(e) => e.preventDefault()}
                    >
                        <Input
                            icon={<FontAwesomeIcon icon={icons.faMagnifyingGlass} />}
                            placeholder="Buscar no cardápio..."
                            readOnly
                            className="focus:outline-none focus:border-gray-300"
                            onFocus={(e) => e.preventDefault()}
                        />
                    </button>
                </div>

                <div className="hidden-x-scroll mt-1 px-2 overflow-x-auto">
                    <Tabs
                        tabs={categories.map((c) => c.name)}
                        active={activeTab}
                        onChange={handleTabChange}
                        className="border-none"
                        childClassName="whitespace-nowrap"
                    />
                </div>
            </div>


            <div className="mt-8 px-4 md:mx-44 space-y-12 pb-20 2xl:mx-80 2xl:mt-12 relative">
                <div className="absolute top-0 right-4 hidden md:flex justify-end gap-4">
                    <button
                        className={`text-sm 2xl:text-base text-brand mt-1 transition-opacity duration-200 ${
                            searchText.length > 0 ? "opacity-100 pointer-events-auto cursor-pointer" : "opacity-0 pointer-events-none"
                        }`}
                        onClick={() => {
                            setSearchText("");
                            setDebouncedSearch("");
                        }}
                    >
                        Cancelar
                    </button>
                    <Input
                        icon={<FontAwesomeIcon icon={icons.faMagnifyingGlass} />}
                        placeholder="Buscar..."
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        className={"!py-2"}
                    />
                </div>


                {debouncedSearch && Object.values(filteredItemsByCat).every(arr => arr.length === 0) && (
                    <div className="flex flex-col items-center justify-center text-center mx-10 pt-16">
                        <img src="/images/meh_emoji.png" alt="Nada encontrado" className="w-38 h-38 mb-4 2xl:w-46 2xl:h-46" />
                        <p className="text-gray-500 text-md 2xl:text-xl">Nenhum item encontrado para <b>{searchText}</b>.</p>
                    </div>
                )}

                {categories.filter(cat => filteredItemsByCat[cat.id]?.length > 0).map((cat) => (
                    <div key={cat.id}>
                    {cat.position === 1
                        ?
                        <div key={cat.id}>

                            <h2 className="text-xl 2xl:text-2xl font-medium mb-4 md:mb-8">
                                <div id={`cat-${cat.id}`} />
                                {cat.name}
                            </h2>

                            <div className="grid grid-cols-3 md:grid-cols-4 gap-[4dvw] w-full relative ">
                                {filteredItemsByCat[cat.id]?.map((item) => (
                                    <button
                                        key={item.id}
                                        onClick={() => handleItemClick(item)}
                                        className={`text-left cursor-pointer ${
                                            loadingItemId === item.id
                                                ? "opacity-60"
                                                : ""
                                        }`}
                                    >
                                        <div className=" w-full aspect-square rounded-2xl overflow-hidden bg-gray-200 shadow-sm">
                                            <img
                                                src={item.image_public_url || "/placeholders/item.png"}
                                                className="w-full h-full object-cover"
                                                alt={item.name}
                                                loading="lazy"
                                            />
                                        </div>

                                        <div className="mt-3 flex flex-col h-[55px] justify-start ">
                                            <p className="font-semibold text-sm 2xl:text-lg">
                                                {(item.promotion && item.promotion.value > 0) ? <><span className={"text-green"}>{formatPrice(promotionPrice(item) || item.price_cents)}</span> <span className={"font-normal text-gray-400 line-through text-xs"}>{formatPrice(item.price_cents)}</span></>
                                                    : formatPrice(item.price_cents)
                                                }
                                            </p>

                                            <p className="text-sm 2xl:text-lg text-gray-700 line-clamp-2 leading-snug">
                                                {item.name}
                                            </p>
                                        </div>
                                    </button>
                                )
                                )}
                            </div>
                        </div>
                        :
                        <div key={cat.id}>

                            <h2 className="text-xl 2xl:text-2xl font-medium mb-6 md:mb-8">
                                <div id={`cat-${cat.id}`} />
                                {cat.name}
                            </h2>

                            <div className="space-y-6 md:space-y-0 w-full md:grid md:grid-cols-2 md:gap-x-[4dvw] md:gap-y-[2dvw]">
                                {filteredItemsByCat[cat.id]?.map((item) => (
                                    <button
                                        key={item.id}
                                        onClick={() => handleItemClick(item)}
                                        className={`cursor-pointer w-full flex justify-between items-start text-left border-b-1 pb-4 border-gray-200 ${
                                            loadingItemId === item.id ? "opacity-60" : ""
                                        }`}
                                    >
                                        <div className="flex flex-col pr-4 flex-1 items-start justify-start max-w-[70%] ">
                                            <p className="text-sm 2xl:text-lg font-semibold leading-tight">
                                                {item.name}
                                            </p>

                                            <p className="text-sm 2xl:text-lg text-gray-600 line-clamp-2 mt-1 leading-tight">
                                                {(item.description ?? "").slice(0, 60)}{item.description && item.description.length > 60 ? "…" : ""}
                                            </p>

                                            <p className="text-sm 2xl:text-lg font-bold mt-2">
                                                {(item.promotion && item.promotion.value > 0) ? <><span className={"text-green"}>{formatPrice(promotionPrice(item) || item.price_cents)}</span> <span className={"font-normal text-gray-400 line-through text-xs"}>{formatPrice(item.price_cents)}</span></>
                                                    : formatPrice(item.price_cents)
                                                    }
                                            </p>
                                        </div>

                                        <div className="w-[22vw] h-[22vw] md:w-[10vw] md:h-[10vw] rounded-2xl overflow-hidden
                    bg-gray-200 shadow-sm flex-shrink-0">
                                            <img
                                                src={item.image_public_url || "/placeholders/item.png"}
                                                className="w-full h-full object-cover"
                                                alt={item.name}
                                                loading="lazy"
                                            />
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    }
                    </div>
                ))}
            </div>

            {openedItem && (
                <ItemModal
                    restaurant={restaurant}
                    item={openedItem.item}
                    subcategories={openedItem.subcategories}
                    loading={openedItem.loading}
                    onClose={() => setOpenedItem(null)}
                    deliveryTax={deliveryTax}
                    deliveryTime={deliveryTime}
                    trackMeta={trackMeta}
                    slug={slug}
                />
            )}

            {searchOpen && (
                <SearchModal
                    restaurant={restaurant}
                    categories={categories}
                    itemsByCategory={itemsByCategory}
                    onClose={() => setSearchOpen(false)}
                />
            )}

            {(isTableOrder
                ? !closedForToday && isRestaurantOpen
                : restaurant.allow_future_order_scheduling === true ||
                  (!closedForToday && (isRestaurantOpen || canScheduleToday))) && (
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
                    closeItemModalOpen={() => setOpenedItem(null)}
                    trackMeta={trackMeta}
                    slug={slug}
                    tableOrder={tableOrder || null}
                    selectedTableId={selectedTableId || null}
                    selectedTableName={
                        selectedTable?.name || tableOrder?.tableName || null
                    }
                />
            )}


            {cartOpen && (
                <CartModal
                    restaurant={restaurant}
                    onClose={() => {
                        setCartOpen(false);
                        setCartStep("cart");
                    }}
                    step={cartStep}
                    setStep={setCartStep}
                    selectedCouponCode={selectedCouponCode}
                    tableOrder={tableOrder || null}
                    selectedTableId={selectedTableId || null}
                    selectedTableName={
                        selectedTable?.name || tableOrder?.tableName || null
                    }
                    onTableChange={setSelectedTableId}


                    onSelectItem={(item: Item) => {
                        setCartOpen(false);
                        setCartStep("cart");
                        handleItemClick(item);
                    }}
                />
            )}

            {!isTableOrder && (
                <HistoryModal
                    open={historyOpen}
                    onClose={() => setHistoryOpen(false)}
                    restaurantId={restaurant.id}
                />
            )}

            <ModalMobile
                open={restaurantCartWarningVisible}
                onClose={() => setRestaurantCartWarningVisible(false)}
                height={0.30}
                handle={true}
                contentClassName="!overflow-y-hidden !pb-0"
                className={"md:!py-4 md:!pb-6 2xl:!w-4xl 2xl:!max-w-4xl"}
            >
                <div className="text-center px-6 pt-2 2xl:px-12">
                    <div className="text-text text-md 2xl:text-xl font-medium mb-2 2xl:mb-4 mt-2">Pedido identificado.</div>

                    <p className="text-gray-500 mb-4 2xl:mb-8 text-sm 2xl:text-lg">
                        Você realizou um pedido aqui recentemente, gostaria de ir até a página deste pedido?
                    </p>

                    <button
                        className="bg-brand cursor-pointer text-white w-full py-3 rounded-lg text-sm 2xl:text-lg mb-3"
                        onClick={() => {
                            setRestaurantCartWarningVisible(false);

                            if (!orderId) return;
                            setTimeout(() => {
                                try {
                                    const base =
                                        window.location.host === "dominoslimeira.com.br" ||
                                        window.location.host === "www.dominoslimeira.com.br"
                                            ? "https://www.imenuapp.com.br"
                                            : "";

                                    router.push(`${base}/pedido/${orderId}`);                                } catch (err) {
                                    console.error("navigate error:", err);
                                }
                            }, 180);
                        }}
                    >
                        Ir ao pedido
                    </button>

                    <p
                        className="text-brand text-sm mt-4 2xl:text-lg md:mt-0 cursor-pointer"
                        onClick={() => setRestaurantCartWarningVisible(false)}
                    >
                        Não, obrigado
                    </p>
                </div>
            </ModalMobile>



        </div>


    );
}
