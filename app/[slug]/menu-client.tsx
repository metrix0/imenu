// app/[slug]/menu-client.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Restaurant, Menu, Category, ItemsByCategory, Item, Subitem, Subcategory } from "@/lib/types/types";
import { useCheckoutStore } from "@/lib/stores/costumer/checkoutStore";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { icons } from "@/lib/utils/fontawesome";
import { faStar } from "@fortawesome/free-solid-svg-icons";
import { supabase } from "@/lib/database/supabaseClient";
import Input from "@/components/ui/Input";
import { formatPrice, formatPriceNoRS } from "@/lib/utils/formatPrice";
import ModalMobile from "@/components/ui/HybridModal";
import ItemModal from "./ItemModal";
import CartBar from "@/components/costumer/CartBar"
import CartModal from "./CartModal"
import WarningBox from "@/components/ui/WarningBox";
import Tabs from "@/components/ui/Tabs";
import SearchModal from "./SearchModal"



export default function MenuClientPage({
                                           slug,
                                           restaurant,
                                           categories,
                                           itemsByCategory,
                                       }: {
    slug: string;
    restaurant: Restaurant;
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
    const [closedForToday, setClosedForToday] = useState(false);
    const [searchText, setSearchText] = useState("");
    const [searchOpen, setSearchOpen] = useState(false);
    const [showMobileSearch, setShowMobileSearch] = useState(false);
    const [activeTab, setActiveTab] = useState(categories[0]?.name ?? "");
    const [manualScrollLock, setManualScrollLock] = useState(false);

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

        // If before 4am, treat "today" as yesterday
        if (now.getHours() < 4) {
            now.setDate(now.getDate() - 1);
        }


        const sameDay =
            closedDate.getFullYear() === now.getFullYear() &&
            closedDate.getMonth() === now.getMonth() &&
            closedDate.getDate() === now.getDate();

        setClosedForToday(sameDay);
    }, [restaurant?.is_closed]);


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

    const handleTabChange = (tab: string) => {
        setManualScrollLock(true);
        setActiveTab(tab);

        // scroll the tab horizontally
        setTimeout(() => {
            const btn = document.querySelector(
                `button[data-tab="${CSS.escape(tab)}"]`
            );
            if (btn) btn.scrollIntoView({ behavior: "smooth", inline: "center" });
        }, 0);

        // scroll to the category
        const cat = categories.find(c => c.name === tab);
        if (!cat) return;
        const el = document.getElementById(`cat-${cat.id}`);
        if (el) {
            const yOffset = -250; // adjust for your fixed headers if needed
            const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
            window.scrollTo({ top: y, behavior: "smooth" });
        }


        // unlock
        setTimeout(() => setManualScrollLock(false), 600);
    };


    const filteredItemsByCat = Object.fromEntries(
        Object.entries(itemsByCategory).map(([catId, arr]) => [
            catId,
            searchText
                ? arr.filter(i =>
                    i.name.toLowerCase().includes(searchText.toLowerCase())
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

    const hScroll = document.querySelector('.scroll-wrapper');
    if (hScroll && hScroll.scrollWidth > hScroll.clientWidth) {
        hScroll.classList.add('visible');
    }

    const deliveryTax = (() => {
        const fees = restaurant.delivery_fee_json.map(
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

        if (slots[0]) {
            const [openH, openM] = slots[0].open.split(":").map(Number);
            const next = new Date();
            next.setHours(openH, openM, 0, 0);

            if (next < now) {
                next.setDate(next.getDate() + 1);
            }

            setNextOpening(next);
        } else {
            setNextOpening(null);
        }
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

// AUTO-HIGHLIGHT TAB WHEN USER SCROLLS
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (manualScrollLock) return; // ignore while programmatic scrolling
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
            <div className="relative -mt-8 ">
                {restaurant.logo_url && (
                    <div className="absolute left-1/2 -translate-x-1/2 -top-8 z-20">
                        <img
                            src={restaurant.logo_url}
                            className="w-17 h-17 md:w-23 md:h-23 2xl:h-30 2xl:w-30 rounded-full border-1 border-gray-200 object-cover"
                            alt="Logo"
                        />
                    </div>
                )}

                <div className="bg-white mx-5 md:mx-48 2xl:mx-80 px-5 py-4 2xl:py-7 rounded-3xl shadow-[0_2px_10px_rgba(0,0,0,0.08)]">
                    <h1 className="text-[1.2rem] 2xl:text-2xl font-semibold mt-6">
                        {restaurant.name}
                    </h1>

                    <p className="text-gray-600 text-xs 2xl:text-[1rem] mt-1 border-b border-gray-200 pb-2">
                        {(nextOpening === null && !closedForToday) ? "Aberto" : "Fechado" } • Min{" "}
                        {restaurant.min_order_cents
                            ? formatPrice(restaurant.min_order_cents)
                            : "R$ 0,00"}
                    </p>

                    {/*{(*/}
                    {/*    <div className="flex items-center gap-2 mt-3 text-xs border-b border-gray-200 pb-3">*/}
                    {/*        <FontAwesomeIcon*/}
                    {/*            icon={faStar}*/}
                    {/*            className="text-gray-700"*/}
                    {/*        />*/}
                    {/*        <span className="font-semibold">*/}
                    {/*            4.7*/}
                    {/*        </span>*/}
                    {/*        <span className="text-gray-500">*/}
                    {/*            (427 avaliações)*/}
                    {/*        </span>*/}
                    {/*    </div>*/}
                    {/*)}*/}

                    <div className="flex items-center gap-2 mt-3 text-xs 2xl:text-[1rem] font-bold">
                        <span>Entrega</span>
                        <span>•</span>
                        <span>
                            {deliveryText()}
                        </span>
                        <span>•</span>
                        <span className={"text-green"}>{taxText()}</span>
                    </div>
                </div>
            </div>

            <div className="hidden md:block mx-5 md:mx-48 2xl:mx-80 mt-6">
                <Input
                    icon={<FontAwesomeIcon icon={icons.faMagnifyingGlass} />}
                    placeholder="Buscar..."
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                />
                {searchText.length > 0 && (
                    <button
                        className="text-sm text-brand mt-1"
                        onClick={() => setSearchText("")}
                    >
                        limpar
                    </button>
                )}
            </div>
            {searchText && Object.values(filteredItemsByCat).every(arr => arr.length === 0) && (
                <p className="text-gray-500 text-sm mt-3">Nenhum item encontrado.</p>
            )}

            {(nextOpening !== null || closedForToday) && (
                <WarningBox icon={icons.faTriangleExclamation} className="mt-10 mx-6 md:mx-48">
                    {closedForToday && (
                        "Hoje o restaurante está fechado no horário comum de funcionamento, devido à possíveis feriados ou eventos especiais."
                        )}
                    {(nextOpening !== null && !closedForToday) && (
                        <>
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
                            min
                        </b>.
                        </>
                    )}

                    {todaySlots.length > 0 && (
                        <div className="text-sm mt-2">
                            Horários de Abertura{closedForToday && (" Comum")}:
                            {todaySlots.map((slot, i) => (
                                <div key={i}>
                                    {slot.open} - {slot.close}
                                </div>
                            ))}
                        </div>
                    )}
                </WarningBox>

            )}

            {/* === FLOATING BUTTONS === */}
            <div
                className={`
        top-7 right-5 fixed flex gap-4 md:hidden
        transition-all duration-300 ease-out
        ${showMobileSearch
                    ? "opacity-0 translate-y-2 pointer-events-none"
                    : "opacity-100 translate-y-0"}
    `}
            >
                <div className="h-10 w-10 rounded-full bg-black/50 text-white flex justify-center items-center">
                    <FontAwesomeIcon icon={icons.faHistory} />
                </div>

                <div
                    onClick={() => setSearchOpen(true)}
                    className="h-10 w-10 rounded-full bg-black/50 text-white flex justify-center items-center"
                >
                    <FontAwesomeIcon icon={icons.faMagnifyingGlass} />
                </div>
            </div>


            {/* === MOBILE SEARCH + TABS (only after scroll) === */}
            <div
                className={`
        md:hidden fixed w-full top-0 bg-white z-[40] border-b border-gray-100
        transition-all duration-300 ease-out
        ${showMobileSearch
                    ? "opacity-100 translate-y-0"
                    : "opacity-0 -translate-y-2 pointer-events-none"}
    `}
            >
                {/* Search trigger */}
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

                {/* Category Tabs */}
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


            {/* ============================
                CATEGORIAS
            ============================ */}
            <div className="mt-8 px-4 md:mx-44 space-y-12 pb-20 2xl:mx-80 2xl:mt-12">
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
                                            />
                                        </div>

                                        <div className="mt-3 flex flex-col h-[55px] justify-start ">
                                            <p className="font-semibold text-sm 2xl:text-lg">
                                                {formatPrice(item.price_cents)}
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
                                        {/* LEFT SIDE (text) */}
                                        <div className="flex flex-col pr-4 flex-1 items-start justify-start max-w-[70%] ">
                                            <p className="text-sm 2xl:text-lg font-semibold leading-tight">
                                                {item.name}
                                            </p>

                                            <p className="text-sm 2xl:text-lg text-gray-600 line-clamp-2 mt-1 leading-tight">
                                                {(item.description ?? "").slice(0, 60)}{item.description && item.description.length > 60 ? "…" : ""}
                                            </p>

                                            <p className="text-sm 2xl:text-lg font-bold mt-2">
                                                {formatPrice(item.price_cents)}
                                            </p>
                                        </div>

                                        {/* RIGHT SIDE (image) */}
                                        <div className="w-[22vw] h-[22vw] md:w-[10vw] md:h-[10vw] rounded-2xl overflow-hidden
                    bg-gray-200 shadow-sm flex-shrink-0">
                                            <img
                                                src={item.image_public_url || "/placeholders/item.png"}
                                                className="w-full h-full object-cover"
                                                alt={item.name}
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
                    deliveryTime={deliveryTime}
                />
            )}

            {/* === SEARCH MODAL === */}
            {searchOpen && (
                <SearchModal
                    restaurant={restaurant}
                    categories={categories}
                    itemsByCategory={itemsByCategory}
                    setSearchText={setSearchText}
                    onClose={() => setSearchOpen(false)}
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
                    closeItemModalOpen={() => setOpenedItem(null)}
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
                className={"md:!py-4 md:!pb-6 2xl:!w-4xl 2xl:!max-w-4xl"}
            >
                <div className="text-center px-6 pt-2 2xl:px-12">
                    <div className="text-text text-md 2xl:text-xl font-medium mb-2 2xl:mb-4 mt-2">Pedido identificado.</div>

                    <p className="text-gray-500 mb-4 2xl:mb-8 text-sm 2xl:text-lg 2xl:text-lg">
                        Você realizou um pedido aqui recentemente, gostaria de ir até a página deste pedido?
                    </p>

                    <button
                        className="bg-brand cursor-pointer text-white w-full py-3 rounded-lg text-sm 2xl:text-lg mb-3"
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
