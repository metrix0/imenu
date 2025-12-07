"use client";

import { useCartStore } from "@/lib/stores/costumer/cartStore";
import { useCheckoutStore } from "@/lib/checkoutStore";
// Importa a nova library
import { fetchAddressByCEP, fetchCoordinates, fetchAddressByCoordinates, calculateDistanceKm } from "@/lib/geocoding";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faChevronDown,
    faChevronLeft,
    faTrash,
    faPlus,
    faCreditCard,
    faLocationCrosshairs, faMinus, faTriangleExclamation,faMoneyBill,faPersonBiking
} from "@fortawesome/free-solid-svg-icons";
import {faPix} from "@fortawesome/free-brands-svg-icons"
import { useEffect, useRef, useState } from "react";
import Input from "@/components/ui/Input";

export default function CartModal({
                                      onClose,
                                      restaurant,
                                  }: {
    onClose: () => void;
    restaurant: any;
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

    const [visible, setVisible] = useState(false);

    // --- ADDED ---
    // Local states for delivery fee + debounce
    const [deliveryFeeCents, setDeliveryFeeCents] = useState<number | null>(null);
    const [loadingCepLookup, setLoadingCepLookup] = useState(false);
    const [cepDebounceTimer, setCepDebounceTimer] = useState<number | null>(null);
    const showAddressWarning = useCheckoutStore(s => s.showAddressWarning);
    const [cepLocationError, setCepLocationError] = useState(false);

    // --- DRAG STATES (minimal, animation only) ---
    const [translateY, setTranslateY] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const DRAG_CLOSE_THRESHOLD = 80; // px required to close on release

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
        setField("showAddressWarning",false)
        setCepLocationError(false)
        const st = useCheckoutStore.getState();

        if (!st.cep) return;

        const addressStr = `${st.rua}, ${st.bairro}, ${st.cidade} - ${st.estado}, ${st.cep}, Brasil`;

        // USA A LIBRARY
        const geo = await fetchCoordinates(addressStr);

        if (!geo) {
            setDeliveryFeeCents(null);
            setField("delivery_fee_cents", null);
            setField("delivery_time_minutes", null);
            setCepLocationError(true)
            return;
        }

        const userLat = geo.latitude;
        const userLon = geo.longitude;

        const restLat = Number(restaurant.latitude);
        const restLon = Number(restaurant.longitude);
        if (Number.isNaN(restLat) || Number.isNaN(restLon)) {
            setDeliveryFeeCents(null);
            setCepLocationError(true)
            return;
        }

        // USA A LIBRARY
        const distKm = calculateDistanceKm(restLat, restLon, userLat, userLon);

        const tiers = getDeliveryTiers();
        const fee = computeFeeFromTiers(distKm, tiers);

        if (fee === null && tiers) {
            setDeliveryFeeCents(null);
            setField("delivery_fee_cents", null);
            setField("delivery_time_minutes", null);
            return;
        }

        setDeliveryFeeCents(Number(fee));
        setField("delivery_fee_cents", String(Number(fee)));

        let matchedTime = null;
        if (Array.isArray(tiers)) {
            for (let t of tiers) {
                if ((Number(t.radius_km) >= distKm) || t === tiers[tiers.length - 1]) {
                    matchedTime = t.time_minutes ?? null;
                    break;
                }
            }
        }
        if (matchedTime !== null) setField("delivery_time_minutes", String(matchedTime));
    }

    async function handleCepInput(value: string) {
        const cleanCep = value.replace(/\D/g, "");
        setField("cep", cleanCep);

        if (cleanCep.length !== 8) return;

        if (cepDebounceTimer) clearTimeout(cepDebounceTimer);
        const timer = window.setTimeout(async () => {
            setLoadingCepLookup(true);
            try {
                // USA A LIBRARY
                const data = await fetchAddressByCEP(cleanCep);
                if (!data) { setCepLocationError(true); return }

                if (data.street) setField("rua", data.street);
                if (data.neighborhood) setField("bairro", data.neighborhood);
                if (data.city) setField("cidade", data.city);
                if (data.state) setField("estado", data.state);

                recalcDeliveryFeeFromAddress();
            } catch (err) {
            } finally {
                setLoadingCepLookup(false);
            }
        }, 600);

        setCepDebounceTimer(timer);
    }

    async function handleUseMyLocation() {
        if (!("geolocation" in navigator)) return;

        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                const lat = pos.coords.latitude;
                const lon = pos.coords.longitude;

                setField("lat", String(lat));
                setField("lon", String(lon));

                // USA A LIBRARY
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
                    // USA A LIBRARY
                    const distKm = calculateDistanceKm(restLat, restLon, lat, lon);
                    const tiers = getDeliveryTiers();
                    const fee = computeFeeFromTiers(distKm, tiers);
                    if (fee !== null) {
                        setDeliveryFeeCents(Number(fee));
                        setField("delivery_fee_cents", String(Number(fee)));
                    }
                }
            },
            () => {},
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0,
            }
        );
    }

    const modalRef = useRef<HTMLDivElement>(null);
    const touchStartY = useRef<number | null>(null);
    const lastMoveDistance = useRef<number>(0);

    useEffect(() => {
        requestAnimationFrame(() => setVisible(true));
    }, []);

    useEffect(() => {
        if (step === "checkout") {
            const saved = useCheckoutStore.getState().delivery_fee_cents;
            if (saved !== undefined && saved !== null) {
                const feeNumber = Number(saved);
                if (!isNaN(feeNumber)) {
                    setDeliveryFeeCents(feeNumber);
                }
            }
        }
    }, [step]);

    const closeWithAnimation = () => {
        setVisible(false);
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

    const handleTouchStart = (e: React.TouchEvent) => {
        if (modalRef.current && modalRef.current.scrollTop <= 0) {
            touchStartY.current = e.touches[0].clientY;
            lastMoveDistance.current = 0;
            setIsDragging(true);
            setTranslateY(0);
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (touchStartY.current === null) return;
        const currentY = e.touches[0].clientY;
        const diff = currentY - touchStartY.current;

        lastMoveDistance.current = diff;

        if (diff <= 0) {
            setTranslateY(0);
            return;
        }

        e.preventDefault();
        setTranslateY(diff);
    };

    const handleTouchEnd = () => {
        const final = lastMoveDistance.current;
        touchStartY.current = null;
        setIsDragging(false);

        if (final >= DRAG_CLOSE_THRESHOLD) {
            const offscreen = typeof window !== "undefined" ? window.innerHeight : 1000;
            setTranslateY(offscreen);

            setTimeout(() => {
                closeWithAnimation();
                setTranslateY(0);
            }, 200);
            lastMoveDistance.current = 0;
            return;
        }

        setTranslateY(0);
        lastMoveDistance.current = 0;
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

    const ruaEBairro = bairro ? `${rua}, ${bairro}` : rua;

    return (
        <div className={`fixed inset-0 z-41 flex justify-center items-end transition-opacity duration-200 ${visible ? "opacity-100 bg-black/40" : "opacity-0 bg-black/40"}`}>
            <div
                ref={modalRef}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                className={`w-full h-[93vh] bg-white rounded-t-xl p-0 transition-transform duration-200 overflow-y-auto ${
                    visible ? "translate-y-0" : "translate-y-full"
                }`}
                style={{
                    transform: visible
                        ? `translateY(${translateY}px)`
                        : `translateY(100%)`,
                    transition: isDragging ? "none" : ""
                }}
            >
                {/* O restante do JSX permanece IDÊNTICO, apenas lógica foi alterada */}
                <div className="sticky top-0 bg-white z-60 flex items-center justify-center pb-3 pt-4">
                    <button
                        className="absolute left-5 text-sm"
                        onClick={goBack}
                    >
                        <FontAwesomeIcon
                            icon={step === "cart" ? faChevronDown : faChevronLeft}
                        />
                    </button>

                    <h1 className="text-[17px] font-semibold">
                        {step === "cart" ? "SACOLA" : step === "info" ? "ENDEREÇO" : "CHECKOUT"}
                    </h1>

                    {step === "cart" && (
                        <button
                            onClick={clearItems}
                            className="absolute right-3 text-brand font-semibold text-[12px]"
                        >
                            Limpar
                        </button>
                    )}
                </div>

                <div className="w-full overflow-x-hidden">

                    <div
                        className="flex transition-transform duration-300 overflow-x-hidden"
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
                        <div className="w-full px-4 overflow-y-auto pt-2 pb-32">
                            <div className="flex items-center gap-3 mt-2 mb-4">
                                {restaurant?.logo_url && (
                                    <img
                                        src={restaurant.logo_url}
                                        className="w-10 h-10 rounded-full object-cover"
                                    />
                                )}

                                <div className="flex flex-col">
                                <span className="font-semibold text-md">
                                    {restaurant?.name}
                                </span>

                                    <button
                                        onClick={closeWithAnimation}
                                        className="text-brand font-semibold text-[13px] text-left"
                                    >
                                        Adicionar mais itens
                                    </button>
                                </div>
                            </div>

                            {items.reduce((acc,i)=>acc+i.total_cents,0) < restaurant.min_order_cents && <div>
                                <div className="p-4 bg-warning-bg text-warning mt-8 mb-8 rounded-2xl flex gap-4 items-center">
                                    <FontAwesomeIcon icon={faTriangleExclamation} className={"text-lg"}/>
                                    <div>
                                        O pedido mínimo deste restaurante é de <b>R$ {(restaurant.min_order_cents/100).toFixed(2).replace(".",",")}</b>
                                    </div>
                                </div>
                            </div>
                            }

                            <h2 className="font-semibold text-md mt-8">
                                Itens adicionados
                            </h2>

                            {items.map((it) => (
                                <div
                                    key={it.id}
                                    className="flex items-start justify-between py-4"
                                >
                                    <div className="flex items-start gap-3">
                                        <img
                                            src={it.image}
                                            className="w-14 h-14 rounded-xl object-cover"
                                        />
                                        <div>
                                            <p className="font-semibold">{it.name}</p>

                                            <p className="text-green-700 font-semibold">
                                                R$ {((it.unit_price_cents * it.qty) / 100)
                                                .toFixed(2)
                                                .replace(".", ",")}
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

                                    <div className="flex items-center gap-5 bg-gray-100 px-3 py-3 rounded-lg text-sm mt-[0.33rem]">
                                        <button
                                            onClick={() =>
                                                it.qty > 1
                                                    ? changeQty(it.id, it.qty - 1)
                                                    : removeItem(it.id)
                                            }
                                            className="text-brand"
                                        >
                                            <FontAwesomeIcon icon={it.qty > 1 ? faMinus : faTrash} />
                                        </button>

                                        <span className="font-medium">{it.qty}</span>

                                        <button
                                            onClick={() => changeQty(it.id, it.qty + 1)}
                                            className="text-brand"
                                        >
                                            <FontAwesomeIcon icon={faPlus} />
                                        </button>
                                    </div>
                                </div>
                            ))}

                            <div className="mt-6 mb-20">
                                <button
                                    onClick={closeWithAnimation}
                                    className="text-brand font-semibold text-[14px] w-full mt-8"
                                >
                                    Adicionar mais itens
                                </button>
                            </div>
                        </div>

                        {/* PAGE 2 — INFO */}
                        <form className="w-full px-4 overflow-y-auto pt-4 pb-32" autoComplete="on">
                            <h2 className="font-semibold text-md mb-4">
                                Entregar no endereço
                            </h2>

                            <button
                                className="text-brand text-md mb-5"
                                onClick={handleUseMyLocation}
                                type="button"
                            >
                                <FontAwesomeIcon icon={faLocationCrosshairs}/> Usar minha localização
                            </button>

                            {showAddressWarning && <div>
                                <div className="p-4 bg-warning-bg text-warning mt-2 mb-8 rounded-2xl flex gap-4 items-center">
                                    <FontAwesomeIcon icon={faTriangleExclamation} className={"text-lg"}/>
                                    <div>
                                        {!cepLocationError ? "O restaurante está muito longe deste endereço para entrega!" : "Erro interno, por gentileza, recarregue a página!"}
                                    </div>
                                </div>

                            </div>
                            }

                            <div className="flex-1">
                                <Input
                                    autoComplete="postal-code"
                                    label={"CEP"}
                                    placeholder="12345-123"
                                    value={formatCep(cep)}
                                    onChange={(e) => handleCepInput(formatCep(e.target.value))}
                                    className="mb-3"
                                />

                            </div>

                            <Input
                                autoComplete="address-line1"
                                label="Rua e Bairro"
                                placeholder="Rua 123, Bairro XYZ"
                                value={ruaEBairro}
                                onChange={(e) => {
                                    const [r, ...b] = e.target.value.split(",");
                                    setField("rua", r.trim());
                                    setField("bairro", b.join(",").trim());
                                }}
                                className="mb-3"
                            />

                            <div className="flex  gap-3">
                                <Input
                                    autoComplete="address-line2"
                                    label={"Número"}
                                    placeholder="1234"
                                    value={numero}
                                    onChange={(e) => setField("numero", e.target.value)}
                                    className="mb-3"
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

                            <h2 className="font-semibold text-md mt-6 mb-6">
                                Informações pessoais
                            </h2>

                            <Input
                                autoComplete="name"
                                label="Nome"
                                placeholder="Rafael"
                                value={nome}
                                onChange={(e) => setField("nome", e.target.value)}
                                className={"mb-3"}
                            />

                            <Input
                                autoComplete="tel"
                                label="Celular"
                                placeholder="(12) 3456-7891"
                                value={celular}
                                onChange={(e) =>
                                    setField("celular", e.target.value)
                                }
                                className="mb-2"
                            />

                            <p className={"text-gray-500 text-sm"}>
                                *Seu número será usado apenas em caso de emergência
                            </p>
                        </form>

                        {/* PAGE 3 — CHECKOUT */}
                        <div className="w-full px-4 overflow-y-auto pt-4 pb-32">

                            <>
                                <h2 className="font-semibold text-md mb-4">
                                    Pagamento
                                </h2>

                                <div className="flex flex-col gap-3 mb-10">
                                    <button
                                        className={`border p-3 rounded-xl duration-200 text-left flex items-center gap-3 ${
                                            pagamento === "pix"
                                                ? "border-brand"
                                                : "border-gray-300"
                                        }`}
                                        onClick={() => setField("pagamento", "pix")}
                                    >
                                        <FontAwesomeIcon icon={faPix} />
                                        Pix
                                    </button>

                                    <button
                                        className={`border p-3 rounded-xl duration-200 text-left flex items-center gap-3 ${
                                            pagamento === "cartao"
                                                ? "border-brand"
                                                : "border-gray-300"
                                        }`}
                                        onClick={() => setField("pagamento", "cartao")}
                                    >
                                        <FontAwesomeIcon icon={faCreditCard} />
                                        Cartão de crédito
                                    </button>
                                    <button
                                        className={`border p-3 rounded-xl duration-200 text-left flex items-center gap-3 ${
                                            pagamento === "dinheiro"
                                                ? "border-brand"
                                                : "border-gray-300"
                                        }`}
                                        onClick={() => setField("pagamento", "dinheiro")}
                                    >
                                        <FontAwesomeIcon icon={faMoneyBill} />
                                        Dinheiro
                                    </button>
                                    <button
                                        className={`border p-3 rounded-xl duration-200 text-left flex items-center gap-3 ${
                                            pagamento === "trazer-maquininha"
                                                ? "border-brand"
                                                : "border-gray-300"
                                        }`}
                                        onClick={() => setField("pagamento", "trazer-maquininha")}
                                    >
                                        <FontAwesomeIcon icon={faPersonBiking} />
                                        Trazer Maquininha
                                    </button>
                                </div>

                                <h2 className="font-semibold text-md mb-4">
                                    Resumo de valores
                                </h2>

                                <div className="flex justify-between text-[15px] mb-2">
                                    <span>Subtotal</span>
                                    <span>
                                R$
                                        {(items.reduce(
                                                (acc, i) => acc + i.total_cents,
                                                0
                                            ) /
                                            100)
                                            .toFixed(2)
                                            .replace(".", ",")}
                            </span>
                                </div>

                                <div className="flex justify-between text-[15px] mb-2">
                                    <span>Taxa de entrega</span>

                                    <span className="text-green-700">
                                {deliveryFeeCents === null
                                    ? "—"
                                    : `R$ ${(deliveryFeeCents / 100).toFixed(2).replace(".", ",")}`}
                            </span>
                                </div>

                                <div className="flex justify-between font-semibold text-[18px] mt-4">
                                    <span>Total</span>
                                    <span>
                                R$
                                        {(items.reduce(
                                                (acc, i) => acc + i.total_cents,
                                                0
                                            ) /
                                            100 +
                                            (deliveryFeeCents ? deliveryFeeCents / 100 : 0)
                                        )
                                            .toFixed(2)
                                            .replace(".", ",")}
                            </span>
                                </div>
                            </>
                        </div>

                    </div>
                </div>

            </div>
        </div>
    );
}