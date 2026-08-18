// app/[slug]/CartModal.tsx
"use client";

import { useEffect, useState, useRef } from "react";
import { useCartStore } from "@/lib/stores/costumer/cartStore";
import { useCheckoutStore } from "@/lib/stores/costumer/checkoutStore";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { icons } from "@/lib/utils/fontawesome";
import { faPix } from "@fortawesome/free-brands-svg-icons"
import Input from "@/components/ui/Input";
import ModalMobile from "@/components/ui/HybridModal";
import WarningBox from "@/components/ui/WarningBox";
import Toast from "@/components/ui/Toast";
import Loader from "@/components/ui/Loader";
import {fetchAddressByCEP, fetchCoordinates, fetchAddressByCoordinates, calculateDistanceKm,} from "@/lib/api/geocoding";
import {formatPriceNoRS, formatPrice, promotionPrice} from "@/lib/utils/formatPrice";
import { supabase } from "@/lib/database/supabaseClient";
import { MenuItemType } from "@/components/restaurant-owner/cardapio/MenuItemRow";
import { Item } from "@/lib/types/types";
const DEFAULT_ALLOWED_PAYMENT_METHODS = [
    "pix",
    "dinheiro",
    "trazer-maquininha",
];

const PAYMENT_OPTIONS = [
    {
        value: "pix",
        label: "Pix (Online)",
        icon: faPix,
    },
    {
        value: "pix-entrega",
        label: "Pix (Na entrega)",
        icon: faPix,
    },
    {
        value: "dinheiro",
        label: "Dinheiro",
        icon: icons.faMoneyBill,
    },
    {
        value: "trazer-maquininha",
        label: "Maquininha",
        icon: icons.faPersonBiking,
    },
];

export default function CartModal({
                                       onClose,
                                       restaurant,
    selectedCouponCode, onSelectItem
                                   }: {
    onClose: () => void;
    restaurant: any;
    step: "cart" | "info" | "checkout";
    setStep: React.Dispatch<React.SetStateAction<"cart" | "info" | "checkout">>;
    selectedCouponCode?: string | null;
    onSelectItem: (item: Item) => void;

}) {
    const { items, changeQty, removeItem, clear } = useCartStore();

    const {
        step,
        setStep,
        cep,
        rua,
        bairro,
        numero,
        complemento,
        nome,
        celular,
        pagamento,
        setField,
    } = useCheckoutStore();
    const isPickup = useCheckoutStore((state: any) => Boolean(state.is_pickup));

    const [openModal, setOpenModal] = useState(false);

    // --- ADDED ---
    // Local states for delivery fee + debounce
    const [deliveryFeeCents, setDeliveryFeeCents] = useState<number | null>(null);
    const [loadingCepLookup, setLoadingCepLookup] = useState(false);
    const [cepDebounceTimer, setCepDebounceTimer] = useState<number | null>(null);
    const [addressError, setAddressError] = useState<string | null>(null);
    const showAddressWarning = useCheckoutStore(s => s.showAddressWarning);
    const [cepLocationError, setCepLocationError] = useState(false);
    const [showNoGeolocationToast, setShowNoGeolocationToast] = useState(false);
    const cepTrigger = useCheckoutStore((s) => s.cepTrigger);
    const [loadingUseMyLocation, setLoadingUseMyLocation] = useState(false);
    const setContinueBlocked = useCheckoutStore(state => state.setContinueBlocked);
    const couponDebounceRef = useRef<number | null>(null);
    const [showDiscountInput, setShowDiscountInput] = useState(false);
    const [upsells, setUpsells] = useState<Item[]>([]);
    const [loadingUpsells, setLoadingUpsells] = useState(false);
    const coupon_code = useCheckoutStore((s) => s.coupon_code);
    const coupon_type = useCheckoutStore((s) => s.coupon_type);
    const coupon_discount_cents = useCheckoutStore((s) => s.coupon_discount_cents);
    const troco = useCheckoutStore((s: any) => String(s.troco ?? ""));

    const restaurantAddress = (() => {
        const rawAddress = restaurant?.address;
        if (!rawAddress) return null;
        if (typeof rawAddress === "string") {
            try {
                return JSON.parse(rawAddress);
            } catch {
                return null;
            }
        }
        return typeof rawAddress === "object" ? rawAddress : null;
    })();

    const hasRestaurantAddress = Boolean(
        restaurantAddress &&
        [restaurantAddress.street, restaurantAddress.number, restaurantAddress.neighborhood, restaurantAddress.city, restaurantAddress.state, restaurantAddress.cep]
            .some((value) => String(value ?? "").trim().length > 0)
    );

    const formattedRestaurantAddress = restaurantAddress
        ? [
            [restaurantAddress.street, restaurantAddress.number].filter(Boolean).join(", "),
            restaurantAddress.neighborhood,
            [restaurantAddress.city, restaurantAddress.state].filter(Boolean).join(" - "),
            restaurantAddress.cep ? `CEP ${restaurantAddress.cep}` : null,
        ].filter(Boolean).join(" • ")
        : "";

    const normalizeAddressPart = (value: unknown) =>
        String(value ?? "")
            .trim()
            .toLocaleLowerCase("pt-BR")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/\s+/g, " ");

    const normalizeAddressNumber = (value: unknown) => {
        const normalized = normalizeAddressPart(value);
        return /^\d+$/.test(normalized) ? String(Number(normalized)) : normalized;
    };

    const isRestaurantDeliveryAddress = (checkoutAddress: any) => Boolean(
        restaurantAddress &&
        String(checkoutAddress.cep ?? "").replace(/\D/g, "") === String(restaurantAddress.cep ?? "").replace(/\D/g, "") &&
        normalizeAddressPart(checkoutAddress.rua) === normalizeAddressPart(restaurantAddress.street) &&
        normalizeAddressNumber(checkoutAddress.numero) === normalizeAddressNumber(restaurantAddress.number) &&
        normalizeAddressPart(checkoutAddress.bairro) === normalizeAddressPart(restaurantAddress.neighborhood) &&
        normalizeAddressPart(checkoutAddress.cidade) === normalizeAddressPart(restaurantAddress.city) &&
        normalizeAddressPart(checkoutAddress.estado) === normalizeAddressPart(restaurantAddress.state)
    );

    function getDeliveryTiers() {
        try {
            if (!restaurant) return null;
            const raw = restaurant.delivery_fee_json;
            if (!raw) return null;
            if (typeof raw === "string") return JSON.parse(raw);
            return raw;
        } catch (e) {
            return null;
        }
    }

    const getPublicUrl = (
        supabase: any,
        bucket: string,
        path: string | null
    ) => {
        if (!path) return null;
        const { data } = supabase.storage.from(bucket).getPublicUrl(path);
        return data?.publicUrl || null;
    };

    function computeFeeFromTiers(distanceKm: number, tiersAny: any): number | null {
        if (!tiersAny) return null;

        let tiers = Array.isArray(tiersAny)
            ? tiersAny
            : Array.isArray(tiersAny.entrega)
                ? tiersAny.entrega.map((t: any) => ({
                    fee_cents: t.taxa !== undefined ? Math.round(t.taxa * 100) : t.fee_cents,
                    radius_km: t.distancia_km ?? t.radius_km,
                    time_minutes: t.time_minutes ?? 0,
                }))
                : null;

        if (!tiers) return null;

        tiers.sort((a: any, b: any) => (a.radius_km ?? 0) - (b.radius_km ?? 0));

        const lastTier = tiers[tiers.length - 1];

        if (distanceKm > lastTier.radius_km) return null;

        for (let t of tiers) {
            if (distanceKm <= t.radius_km) {
                return Number(t.fee_cents);
            }
        }

        return null;
    }

    async function recalcDeliveryFeeFromAddress() {
        const st = useCheckoutStore.getState() as any;
        if (st.is_pickup) {
            setDeliveryFeeCents(0);
            setField("delivery_fee_cents", "0");
            setField("delivery_time_minutes", null);
            return;
        }

        setField("showAddressWarning", false);
        setCepLocationError(false);

        if (
            !st.cep ||
            !st.rua ||
            !st.bairro ||
            !st.cidade ||
            !st.estado ||
            !st.numero
        ) {
            setDeliveryFeeCents(null);
            setField("delivery_fee_cents", null);
            setField("delivery_time_minutes", null);
            return;
        }

        const fullAddress = `${st.rua}, ${st.numero}, ${st.bairro}, ${st.cidade} - ${st.estado}, ${st.cep}, Brasil`;

        const coords = await fetchCoordinates(fullAddress);

        if (!coords) {
            setDeliveryFeeCents(null);
            setField("delivery_fee_cents", null);
            setField("delivery_time_minutes", null);
            setCepLocationError(true);
            return;
        }

        const restLat = Number(restaurant.latitude);
        const restLon = Number(restaurant.longitude);

        if (Number.isNaN(restLat) || Number.isNaN(restLon)) {
            setCepLocationError(true);
            return;
        }

        const distKm = isRestaurantDeliveryAddress(st)
            ? 0
            : calculateDistanceKm(
                restLat,
                restLon,
                coords.latitude,
                coords.longitude
            );

        const tiers = getDeliveryTiers();
        const fee = computeFeeFromTiers(distKm, tiers);

        if (fee === null) {
            setDeliveryFeeCents(null);
            setField("delivery_fee_cents", null);
            setField("delivery_time_minutes", null);
            return;
        }

        setDeliveryFeeCents(fee);
        setField("delivery_fee_cents", String(fee));

        let matchedTime = null;
        if (Array.isArray(tiers)) {
            for (let t of tiers) {
                if (Number(t.radius_km) >= distKm) {
                    matchedTime = t.time_minutes ?? null;
                    break;
                }
            }
        }

        if (matchedTime !== null) {
            setField("delivery_time_minutes", String(matchedTime));
        }
    }

    async function handleCepInput(value: string) {
        if (isPickup) return;
        setCepLocationError(false);
        setContinueBlocked(true)

        const cleanCep = value.replace(/\D/g, "");
        setField("cep", cleanCep);

        if (cleanCep.length !== 8) return;

        if (cepDebounceTimer) clearTimeout(cepDebounceTimer);

        const timer = window.setTimeout(async () => {
            setLoadingCepLookup(true);
            try {
                const addr = await fetchAddressByCEP(cleanCep);
                if (!addr) {
                    setCepLocationError(true);
                    setField("delivery_fee_cents", null);
                    return;
                }

                setField("rua", addr.street);
                setField("bairro", addr.neighborhood);
                setField("cidade", addr.city);
                setField("estado", addr.state);

                recalcDeliveryFeeFromAddress();
            } catch (error) {
                console.error("CEP lookup failed:", error);
                setCepLocationError(true);
                setField("delivery_fee_cents", null);
            } finally {
                setLoadingCepLookup(false);
                setContinueBlocked(false)
            }
        }, 600);

        setCepDebounceTimer(timer);
    }

    useEffect(() => {
        if (
            isPickup ||
            cep.replace(/\D/g, "").length !== 8 ||
            !rua ||
            !bairro ||
            !numero
        ) {
            return;
        }

        const timer = window.setTimeout(() => {
            void recalcDeliveryFeeFromAddress();
        }, 400);

        return () => window.clearTimeout(timer);
    }, [cep, rua, bairro, numero, isPickup]);

    async function handleUseMyLocation() {
        if (isPickup) return;
        if (!("geolocation" in navigator)){
            console.log("no geo")
            setShowNoGeolocationToast(true)
            return;
        }

        setContinueBlocked(true)
        setField("showAddressWarning", false);
        setCepLocationError(false)
        setLoadingUseMyLocation(true)

        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                try {
                    const lat = pos.coords.latitude;
                    const lon = pos.coords.longitude;

                    setField("lat", String(lat));
                    setField("lon", String(lon));

                    const addr = await fetchAddressByCoordinates(lat, lon);

                    if (addr) {
                        if (addr.cep) setField("cep", addr.cep);
                        if (addr.street) setField("rua", addr.street);
                        if (addr.number) setField("numero", addr.number);
                        if (addr.neighborhood) setField("bairro", addr.neighborhood);
                        if (addr.city) setField("cidade", addr.city);
                        if (addr.state) setField("estado", addr.state);
                    }

                    const restLat = Number(restaurant.latitude);
                    const restLon = Number(restaurant.longitude);

                    if (!Number.isNaN(restLat) && !Number.isNaN(restLon)) {
                        const distKm = calculateDistanceKm(restLat, restLon, lat, lon);
                        const fee = computeFeeFromTiers(distKm, getDeliveryTiers());

                        if (fee !== null) {
                            setDeliveryFeeCents(fee);
                            setField("delivery_fee_cents", String(fee));
                        }
                    }
                } catch (err) {
                    console.error("Failed to use location", err);
                    setShowNoGeolocationToast(true)
                } finally {
                    setLoadingUseMyLocation(false);
                    setContinueBlocked(false)
                }
            },
            (error) => {
                console.error("Geolocation error", error);
                setShowNoGeolocationToast(true)
                setLoadingUseMyLocation(false);
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );

    }

    const handlePickupChange = (checked: boolean) => {
        useCheckoutStore.setState({ is_pickup: checked } as any);
        setField("showAddressWarning", false);
        setCepLocationError(false);

        if (checked) {
            setDeliveryFeeCents(0);
            setField("delivery_fee_cents", "0");
            setField("delivery_time_minutes", null);
            if (coupon_type === "delivery") {
                setField("coupon_discount_cents", 0);
            }
            setContinueBlocked(false);
            return;
        }

        setDeliveryFeeCents(null);
        setField("delivery_fee_cents", null);
        setField("delivery_time_minutes", null);
        if (cep.replace(/\D/g, "").length === 8) {
            window.setTimeout(() => recalcDeliveryFeeFromAddress(), 0);
        }
    };

    useEffect(() => {
        if (!hasRestaurantAddress && isPickup) {
            useCheckoutStore.setState({ is_pickup: false } as any);
            setDeliveryFeeCents(null);
            setField("delivery_fee_cents", null);
        }
    }, [hasRestaurantAddress, isPickup]);

    useEffect(() => {
        if (!restaurant?.id) return;

        const loadUpsells = async () => {
            setLoadingUpsells(true);

            const { data: upsellRows } = await supabase
                .from("upsell")
                .select("item_id, position")
                .eq("restaurant_id", restaurant.id)
                .order("position", { ascending: true });

            if (!upsellRows || upsellRows.length === 0) {
                setUpsells([]);
                setLoadingUpsells(false);
                return;
            }

            const itemIds = upsellRows.map(u => u.item_id);

            const { data: items } = await supabase
                .from("items")
                .select("*")
                .in("id", itemIds)
                .eq("is_available", true);

            if (!items) {
                setUpsells([]);
                setLoadingUpsells(false);
                return;
            }

            // keep order defined in upsell table
            const ordered: Item[] = upsellRows
                .map(u => {
                    const item = items.find(i => i.id === u.item_id);
                    if (!item) return null;

                    return {
                        ...item,
                        image_public_url: getPublicUrl(
                            supabase,
                            "menu-images",
                            item.image_path
                        ),
                    };
                })
                .filter((i): i is Item => i !== null);

            setUpsells(ordered);
            setLoadingUpsells(false);
        };

        loadUpsells();
    }, [restaurant?.id]);

    useEffect(() => {
        requestAnimationFrame(() => setOpenModal(true));
    }, []);

    useEffect(() => {
        if (step === "checkout") {
            if (isPickup) {
                setDeliveryFeeCents(0);
                setField("delivery_fee_cents", "0");
                return;
            }

            const saved = useCheckoutStore.getState().delivery_fee_cents;
            if (saved !== undefined && saved !== null) {
                const feeNumber = Number(saved);
                if (!isNaN(feeNumber)) {
                    setDeliveryFeeCents(feeNumber);
                }
            }
        }
    }, [step, isPickup]);

    // keep matching timeout so backdrop/slide finish
    const closeWithAnimation = () => {
        // run slide/fade out (we keep openModal=false so backdrop fades)
        setOpenModal(false);
        // give animation time (200ms)
        setTimeout(() => {
            setStep("cart");
            onClose();
        }, 200);
    };

    const goBack = () => {
        if (step === "info") setStep("cart");
        else if (step === "checkout") setStep("info");
        else closeWithAnimation();
    };

    function clearItems() {
        clear();
        setTimeout(closeWithAnimation, 150);
    }

    function formatCep(v: string) {
        v = v.replace(/\D/g, "");
        if (v.length > 5) return v.slice(0, 5) + "-" + v.slice(5, 8);
        return v;
    }

    useEffect(() => {
        if (!cepTrigger || isPickup) return;

        handleCepInput(cep);

        useCheckoutStore.setState({ cepTrigger: false });
    }, [cepTrigger, isPickup]);

    useEffect(() => {
        console.log("checkout coupons")

        const checkCoupons = async () => {
            const { count, error } = await supabase
                .from("coupons")
                .select("id", { count: "exact", head: true })
                .eq("restaurant_id", restaurant.id)
                .eq("active", true);

            console.log("coupon count:", count);

            if (error) {
                console.error("Failed to check coupons", error);
                setShowDiscountInput(false);
                return;
            }

            setShowDiscountInput((count ?? 0) > 0);
        };

        checkCoupons();
    },[] );

    const allowedPaymentMethods =
        Array.isArray(restaurant?.allowed_payment_methods) &&
        restaurant.allowed_payment_methods.length > 0
            ? restaurant.allowed_payment_methods
            : DEFAULT_ALLOWED_PAYMENT_METHODS;

    const availablePaymentOptions = PAYMENT_OPTIONS.filter((option) =>
        allowedPaymentMethods.includes(option.value) &&
        !(isPickup && option.value === "pix-entrega")
    );

    useEffect(() => {
        if (availablePaymentOptions.length === 0) return;

        const isCurrentPaymentAllowed = availablePaymentOptions.some(
            (option) => option.value === pagamento
        );

        if (!isCurrentPaymentAllowed) {
            setField("pagamento", availablePaymentOptions[0].value);
        }
    }, [pagamento, allowedPaymentMethods, isPickup]);

    const effectiveDeliveryFeeCents = isPickup ? 0 : deliveryFeeCents;

    return (
        <div className={`fixed inset-0 z-41 flex justify-center items-end`}>
            <ModalMobile
                open={openModal}
                onClose={closeWithAnimation}
                height={0.93}
                handle={false}
                xPadding={false}
                className={"md:!h-[80vh] md:!mb-[12vh]"}
            >

                {showNoGeolocationToast && (
                    <Toast
                        message="Insira o endereço manualmente!"
                        type="error"
                        onClose={() => setShowNoGeolocationToast(false)}
                    />
                )}
                
                {/* HEADER */}
                <div className="sticky top-[0.1%] z-60 flex items-center bg-white rounded-2xl justify-center pb-3 pt-4 2xl:pt-6 2xl:pb-6 pointer-events-none">
                    <button
                        className="md:hidden absolute left-5 md:left-auto md:right-5 2xl:right-8 text-sm pointer-events-auto cursor-pointer"
                        onClick={goBack}
                    >
                        <FontAwesomeIcon
                            icon={icons.faChevronDown}
                            className={`md:!hidden duration-200 ${step === "cart" ? "rotate-0" : "rotate-90" }`}
                        />
                    </button>
                    <button
                        className="hidden md:block absolute left-5 md:left-auto md:right-5 2xl:right-8 text-sm pointer-events-auto cursor-pointer"
                        onClick={()=>{setStep("cart");closeWithAnimation()}}
                    >
                        <FontAwesomeIcon
                            icon={icons.faTimes}
                            className={`hidden md:block text-gray-700 hover:text-gray-950 text-lg 2xl:text-xl duration-200`}
                        />
                    </button>

                    {step !== "cart" && (
                        <button
                            className="hidden md:block absolute left-8 text-xl pointer-events-auto cursor-pointer "
                            onClick={goBack}

                        >
                        <FontAwesomeIcon
                            icon={icons.faChevronDown}
                            className={`md:block duration-200 rotate-90`}
                        />
                        </button>
                    )}

                    <h1 className="text-[17px] 2xl:text-lg font-semibold ">
                        {step === "cart" ? "SACOLA" : step === "info" ? "ENDEREÇO" : "CHECKOUT"}
                    </h1>

                    {step === "cart" && (
                        <button
                            onClick={clearItems}
                            className="absolute right-5 2xl:left-8 md:right-auto 2xl:text-[1rem] md:left-5 cursor-pointer text-brand  font-semibold text-[12px] pointer-events-auto"
                        >
                            Limpar
                        </button>
                    )}
                </div>

                {/* SLIDER */}
                <div className="w-full overflow-x-hidden ">

                    <div
                        className="flex transition-transform duration-300 overflow-x-hidden "
                        style={{
                            width: "300%",
                            transform:
                                step === "cart"
                                    ? "translateX(0%)"
                                    : step === "info"
                                        ? "translateX(-33.33%)"
                                        : "translateX(-66.66%)",
                        }}
                    >

                {/* SACOLA */}
                <div className="w-full px-4 2xl:px-8 overflow-y-auto pt-2 ">
                    <div className="flex items-center gap-3 mt-2 mb-4">
                        {restaurant?.logo_url && (
                            <img
                                src={restaurant.logo_url}
                                className="w-10 h-10 2xl:w-15 2xl:h-15 rounded-full object-cover"
                            />
                        )}

                        <div className="flex flex-col">
                                <span className="font-semibold text-md 2xl:text-lg">
                                    {restaurant?.name}
                                </span>

                            <button
                                onClick={closeWithAnimation}
                                className="cursor-pointer text-brand font-semibold text-[13px] 2xl:text-lg text-left"
                            >
                                Adicionar mais itens
                            </button>
                        </div>
                    </div>

                    {(items.length > 0 && items.reduce((acc,i)=>acc+(promotionPrice(i) || i.total_cents),0) < restaurant.min_order_cents) &&
                        <WarningBox
                            icon={icons.faTriangleExclamation}
                            className="mt-8 mb-8 p-4 2xl:text-lg"
                        >
                            O pedido mínimo deste restaurante é de{" "}
                            <b>R$ {(restaurant.min_order_cents / 100)
                                .toFixed(2)
                                .replace(".", ",")}</b>
                        </WarningBox>
                    }

                    <h2 className="font-semibold text-md 2xl:text-lg mt-8">
                        Itens adicionados
                    </h2>

                    {items.map((it) => (
                        <div
                            key={it.id}
                            className="flex items-start justify-between py-4 2xl:py-6 w-full"
                        >
                            <div className="flex items-start gap-3 2xl:gap-5">
                                <img
                                    src={it.image || "/placeholders/item.png"}
                                    className="w-14 h-14 2xl:w-20 2xl:h-20 rounded-xl object-cover"
                                />
                                <div>
                                    <p className="font-semibold 2xl:text-lg line-clamp-2 leading-normal">{it.name}</p>

                                    <p className="font-semibold 2xl:text-base sm:text-sm mt-0.5">
                                        {(it.promotion && it.promotion.value > 0) ? <><span className={"text-green"}>{formatPrice(promotionPrice(it) || it.unit_price_cents*it.qty)}</span> <span className={"font-normal text-gray-400 line-through text-xs"}>{formatPrice(it.unit_price_cents*it.qty)}</span></>
                                            : formatPrice(it.unit_price_cents*it.qty)
                                        }
                                    </p>

                                    {(it.selectedSubitems?.length > 0 || it.observation) && (
                                        <div className="text-sm text-gray-500 mb-2 mt-2">
                                            {it.selectedSubitems?.map((s) => (
                                                <p key={s.subitemId}>+ {s.subitemName}</p>
                                            ))}
                                            {it.observation && (
                                                <p className="italic mt-1">Obs: {it.observation}</p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-5 bg-gray-100 px-3 py-3 rounded-lg text-sm 2xl:text-lg mt-[0.33rem]">
                                <button
                                    onClick={() =>
                                        it.qty > 1
                                            ? changeQty(it.id, it.qty - 1)
                                            : removeItem(it.id)
                                    }
                                    className="text-brand cursor-pointer"
                                >
                                    <FontAwesomeIcon icon={it.qty > 1 ? icons.faMinus : icons.faTrash} />
                                </button>

                                <span className="font-medium">{it.qty}</span>

                                <button
                                    onClick={() => changeQty(it.id, it.qty + 1)}
                                    className="text-brand cursor-pointer"
                                >
                                    <FontAwesomeIcon icon={icons.faPlus} />
                                </button>
                            </div>
                        </div>
                    ))}

                    <div className="mt-6 mb-20">
                        <button
                            onClick={closeWithAnimation}
                            className="cursor-pointer text-brand font-semibold text-[14px] 2xl:text-lg w-full mt-8"
                        >
                            Adicionar mais itens
                        </button>
                    </div>

                    {/* Upsells */}
                    {upsells.length > 0 && (
                    <div className="-mt-10 mb-10 md:-mt-13 md:mb-13 relative overflow-hidden">
                        <h3 className="text-base font-semibold mb-3">Peça também</h3>
                        <div className={"pointer-events-none w-[20%] h-full bg-gradient-to-l from-white/67 to-transparent absolute -right-1 -top-1 z-232"}></div>

                        <div className="flex relative gap-3 overflow-x-auto pb-2 items-start hidden-x-scroll">
                            {upsells.map(item => (
                                <button
                                    key={item.id}
                                    onClick={() => onSelectItem(item)} // SAME add logic as other items
                                    className="w-[28.3vw] md:w-[33%] h-auto aspect-square flex-shrink-0 text-left"
                                >
                                    <div className="relative">
                                        <img
                                            src={item.image_public_url || "/placeholders/item.png"}
                                            alt={item.name}
                                            className="w-full h-28 md:h-40 aspect-square object-cover rounded-xl"
                                        />

                                        <div className="absolute bottom-2 right-2 cursor-pointer bg-white rounded-full w-8 h-8 flex items-center justify-center shadow">
                                            <FontAwesomeIcon icon={icons.faPlus} className="text-sm" />
                                        </div>
                                    </div>
                                    <p className="text-sm font-semibold mt-2 ">
                                        {formatPrice(item.price_cents)}
                                    </p>
                                    <p className="text-sm mt-1 leading-tight line-clamp-2">
                                        {item.name}
                                    </p>

                                </button>
                            ))}
                        </div>
                    </div>
                    )}

                </div>

                {/* PAGE 2 — INFO */}
                <form className="w-full px-4 overflow-y-auto pt-4 pb-32 2xl:pb-10 2xl:px-8" autoComplete="on">
                    {hasRestaurantAddress && (
                        <label className={`mb-5 flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition-colors ${isPickup ? "border-brand bg-brand/5" : "border-gray-200 bg-white hover:border-gray-300"}`}>
                            <input
                                type="checkbox"
                                checked={isPickup}
                                onChange={(event) => handlePickupChange(event.target.checked)}
                                className="sr-only"
                            />
                            <span
                                aria-hidden="true"
                                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${isPickup ? "border-brand bg-brand" : "border-gray-300 bg-white"}`}
                            >
                                {isPickup && <FontAwesomeIcon icon={icons.faCheck} className="text-[11px] text-white" />}
                            </span>
                            <span className="flex min-w-0 flex-col">
                                <span className="font-semibold text-md 2xl:text-lg">Retirar pedido no balcão</span>
                                <span className="mt-1 text-sm text-gray-500 2xl:text-base">{formattedRestaurantAddress}</span>
                            </span>
                        </label>
                    )}

                    <fieldset
                        disabled={isPickup}
                        className={`transition-opacity ${isPickup ? "pointer-events-none opacity-40" : "opacity-100"}`}
                    >
                        <div className={"md:flex md:justify-between md:pr-4 md:mx-1 md:mb-4"}>
                            <h2 className="font-semibold text-md 2xl:text-lg mb-4 md:mb-0">
                                Entregar no endereço
                            </h2>

                            <button
                                className={`relative inline-flex justify-center items-center gap-1 text-brand text-md 2xl:text-lg cursor-pointer mb-5 md:mb-0`}
                                onClick={handleUseMyLocation}
                                type="button"
                            >
                                {loadingUseMyLocation && (<Loader className={"scale-75 absolute !border-brand/20 !border-t-brand -right-9 md:-left-9 md:right-0"}/>)}
                                <FontAwesomeIcon icon={icons.faLocationCrosshairs}/> Usar minha localização
                            </button>
                        </div>

                        {showAddressWarning && !isPickup &&
                            <WarningBox
                                icon={icons.faTriangleExclamation}
                                className="mt-2 mb-8 p-4 2xl:text-lg"
                            >
                                {!cepLocationError
                                    ? "O restaurante está muito longe deste endereço para entrega!"
                                    : "Verifique se o endereço está correto ou tente usar sua localização."}
                            </WarningBox>
                        }

                        <div className="flex-1 2xl:mt-2 md:text-sm ">
                            <Input
                                autoComplete="postal-code"
                                label={"CEP"}
                                placeholder="12345-123"
                                value={formatCep(cep)}
                                onChange={(e) => handleCepInput(formatCep(e.target.value))}
                                className="mb-3 2xl:text-lg 2xl:mb-6"
                            />

                        </div>

                        <div className="grid grid-cols-2 gap-3 2xl:gap-6 md:text-sm">
                            <Input
                                autoComplete="address-line1"
                                label="Rua"
                                placeholder="Rua das Flores"
                                value={rua}
                                onChange={(e) => setField("rua", e.target.value)}
                                className="min-w-0 mb-3 2xl:text-lg 2xl:mb-6"
                            />

                            <Input
                                autoComplete="address-level3"
                                label="Bairro"
                                placeholder="Centro"
                                value={bairro}
                                onChange={(e) => setField("bairro", e.target.value)}
                                className="min-w-0 mb-3 2xl:text-lg 2xl:mb-6"
                            />
                        </div>

                        <div className="flex  gap-3 2xl:gap-6 md:text-sm ">
                            <Input
                                autoComplete="address-line2"
                                label={"Número"}
                                placeholder="1234"
                                value={numero}
                                onChange={(e) => setField("numero", e.target.value)}
                                className="mb-3 2xl:text-lg 2xl:mb-6"
                            />
                            <Input
                                autoComplete="address-line3"
                                label={"Complemento"}
                                placeholder="Apto 123 (Opcional)"
                                value={complemento}
                                onChange={(e) =>
                                    setField("complemento", e.target.value)
                                }
                            />
                        </div>
                    </fieldset>

                    <h2 className="font-semibold text-md mt-3 mb-5 md:text-sm 2xl:text-lg">
                        Informações pessoais
                    </h2>

                    <Input
                        autoComplete="name"
                        label="Nome"
                        placeholder="Rafael"
                        value={nome}
                        onChange={(e) => setField("nome", e.target.value)}
                        className={"mb-3 2xl:text-lg 2xl:mb-6 md:text-sm "}
                    />

                    <Input
                        autoComplete="tel"
                        label="Celular"
                        placeholder="(12) 3456-7891"
                        value={celular}
                        onChange={(e) =>
                            setField("celular", e.target.value)
                        }
                        className="mb-2 2xl:text-lg 2xl:mb-3 md:text-sm "
                    />

                    <p className={"text-gray-500 text-sm 2xl:text-md"}>
                        *Seu número será usado apenas em caso de emergência
                    </p>
                </form>

                {/* PAGE 3 — CHECKOUT */}
                <div className="w-full px-4 overflow-y-auto pt-4 pb-32 2xl:px-8">

                    <>
                        <h2 className="font-semibold text-md 2xl:text-lg mb-4">
                            Pagamento
                        </h2>

                        <div className="flex flex-col gap-3 mb-5 2xl:text-lg">
                            {availablePaymentOptions.map((option) => (
                                <div key={option.value}>
                                    <button
                                        type="button"
                                        className={`w-full border cursor-pointer p-3 rounded-xl duration-200 text-left flex items-center gap-3 ${
                                            pagamento === option.value
                                                ? "border-brand"
                                                : "border-gray-300"
                                        }`}
                                        onClick={() => setField("pagamento", option.value)}
                                    >
                                        <FontAwesomeIcon icon={option.icon} />
                                        {option.label}
                                    </button>

                                    {option.value === "dinheiro" && (
                                        <div
                                            aria-hidden={pagamento !== "dinheiro"}
                                            className={`overflow-hidden transition-all duration-300 ease-out ${
                                                pagamento === "dinheiro"
                                                    ? "max-h-28 opacity-100 translate-y-0 mt-3"
                                                    : "max-h-0 opacity-0 -translate-y-1 mt-0 pointer-events-none"
                                            }`}
                                        >
                                            <Input
                                                label="Troco para quanto?"
                                                placeholder="50,00"
                                                value={troco}
                                                inputMode="decimal"
                                                icon="R$"
                                                tabIndex={pagamento === "dinheiro" ? 0 : -1}
                                                onChange={(e) => setField("troco", e.target.value)}
                                                className="2xl:text-lg"
                                            />
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        {showDiscountInput && (<div className="mb-6">
                            <Input
                                readOnly={!!selectedCouponCode && !!coupon_discount_cents}
                                locked={!!selectedCouponCode && !!coupon_discount_cents}
                                label="Cupom de desconto"
                                placeholder="EX: PROMO10"
                                defaultValue={selectedCouponCode || ""}
                                onChange={(e) => {
                                    const v = e.target.value.toUpperCase();

                                    if (couponDebounceRef.current) {
                                        clearTimeout(couponDebounceRef.current);
                                    }

                                    couponDebounceRef.current = window.setTimeout(() => {
                                        setField("coupon_code", v);
                                    }, 500);
                                }}
                                className="2xl:text-lg"
                                icon={<FontAwesomeIcon icon={icons.faEdit} className={"cursor-pointer"} onClick={() => {selectedCouponCode = null; setField("coupon_code", null); setField("coupon_discount_cents", null); console.log(selectedCouponCode)}} />}
                                iconPosition={"right"}
                            />
                        </div>)}

                            <h2 className="font-semibold text-md mb-4 mt-5 2xl:text-lg">
                            Resumo de valores
                        </h2>

                        <div className="flex justify-between text-[15px] mb-2 2xl:text-lg">
                            <span>Subtotal</span>
                            <span>
                                R$
                                {(items.reduce(
                                        (acc, i) => acc + (promotionPrice(i) || i.total_cents),
                                        0
                                    ) /
                                    100)
                                    .toFixed(2)
                                    .replace(".", ",")}
                            </span>
                        </div>

                        <div className="flex justify-between text-[15px] mb-2 2xl:text-lg">
                            <span>{isPickup ? "Retirada" : "Taxa de entrega"}</span>

                            <span className="text-green-700">
                                {effectiveDeliveryFeeCents === null
                                    ? "—"
                                    : `R$ ${(effectiveDeliveryFeeCents / 100).toFixed(2).replace(".", ",")}`}
                            </span>
                        </div>

                        { (coupon_code && coupon_discount_cents) && (
                        <div className="flex justify-between text-[15px] mb-2 2xl:text-lg border-t border-gray-200 pt-2">
                            <span>Cupom: {coupon_code}</span>
                            <span>

                                - R$ {formatPriceNoRS(coupon_discount_cents ? coupon_discount_cents : 0)}
                            </span>
                        </div>)}

                        <div className="flex justify-between font-semibold text-[18px] 2xl:text-xl mt-4">
                            <span>Total</span>
                            <span>
                                R$
                                {(items.reduce(
                                        (acc, i) => acc + (promotionPrice(i) || i.total_cents),
                                        0
                                    ) /
                                    100 +
                                    (((effectiveDeliveryFeeCents ?? 0) / 100)-(coupon_discount_cents ? coupon_discount_cents / 100 : 0))
                                )
                                    .toFixed(2)
                                    .replace(".", ",")}
                            </span>
                        </div>
                    </>
                </div>
                    </div>
                </div>

            </ModalMobile>
        </div>

    );
}
