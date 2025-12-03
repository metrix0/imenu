"use client";

import { useCartStore } from "@/lib/stores/costumer/cartStore";
import { useCheckoutStore } from "@/lib/stores/costumer/checkoutStore";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faChevronDown,
    faTrash,
    faPlus,
    faCreditCard,
    faLocationCrosshairs, faMinus, faTriangleExclamation,faMoneyBill,faPersonBiking
} from "@fortawesome/free-solid-svg-icons";
import {faPix} from "@fortawesome/free-brands-svg-icons"
import { useEffect, useRef, useState } from "react";
import Input from "@/components/ui/Input";
import DraggableModal from "@/components/ui/ModalMobile";

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

    const [openModal, setOpenModal] = useState(false);

    // --- ADDED ---
    // Local states for delivery fee + debounce
    const [deliveryFeeCents, setDeliveryFeeCents] = useState<number | null>(null);
    const [loadingCepLookup, setLoadingCepLookup] = useState(false);
    const [cepDebounceTimer, setCepDebounceTimer] = useState<number | null>(null);
    const [addressError, setAddressError] = useState<string | null>(null);
    const showAddressWarning = useCheckoutStore(s => s.showAddressWarning);
    const [cepLocationError, setCepLocationError] = useState(false);

    // --- DRAG STATES (minimal, animation only) ---
    const [translateY, setTranslateY] = useState(0);
    const DRAG_CLOSE_THRESHOLD = 80; // px required to close on release

    function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
        const toRad = (deg: number) => (deg * Math.PI) / 180;
        const R = 6371;
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) *
            Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

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

    async function geocodeAddressToLatLon(address: string): Promise<{ lat: number; lon: number } | null> {
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`, {
                headers: { "User-Agent": "checkout" }
            });
            const json = await res.json();
            if (!json || json.length === 0) return null;
            return { lat: parseFloat(json[0].lat), lon: parseFloat(json[0].lon) };
        } catch (e) {
            return null;
        }
    }

    async function reverseGeocode(lat: number, lon: number) {
        try {
            const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
            const res = await fetch(
                `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lon}&key=${apiKey}&language=pt-BR`
            );
            const json = await res.json();
            if (!json.results || json.results.length === 0) return null;

            const result = json.results[0];
            const components = result.address_components;

            const getComp = (type: string) =>
                components.find((c: any) => c.types.includes(type))?.long_name ?? "";

            return {
                postcode: getComp("postal_code"),
                road: getComp("route"),
                house_number: getComp("street_number"),
                suburb: getComp("sublocality") || getComp("neighborhood"),
                neighbourhood: getComp("neighborhood") || getComp("sublocality"),
                city: getComp("locality") || getComp("administrative_area_level_2"),
                state: getComp("administrative_area_level_1"),
            };
        } catch (e) {
            return null;
        }
    }

    async function recalcDeliveryFeeFromAddress() {
        setField("showAddressWarning",false)
        setCepLocationError(false)
        console.log("recalc")
        const st = useCheckoutStore.getState();

        if (!st.cep) return;

        console.log(`${st.rua}, ${st.bairro}, ${st.cidade} - ${st.estado}, ${st.cep}, Brasil`)
        const addressStr = `${st.rua}, ${st.bairro}, ${st.cidade} - ${st.estado}, ${st.cep}, Brasil`;

        console.log(addressStr)

        const geo = await geocodeAddressToLatLon(addressStr);

        console.log(geo)
        if (!geo) {
            setDeliveryFeeCents(null);
            setField("delivery_fee_cents", null);
            setField("delivery_time_minutes", null);
            setCepLocationError(true)
            return;
        }

        const userLat = geo.lat;
        const userLon = geo.lon;

        const restLat = Number(restaurant.latitude);
        const restLon = Number(restaurant.longitude);
        if (Number.isNaN(restLat) || Number.isNaN(restLon)) {
            setDeliveryFeeCents(null);
            setCepLocationError(true)
            return;
        }

        const distKm = haversineKm(restLat, restLon, userLat, userLon);

        const tiers = getDeliveryTiers();
        const fee = computeFeeFromTiers(distKm, tiers);
        console.log(distKm, tiers)


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
        console.log("MATCHED TIME", matchedTime)
        if (matchedTime !== null) setField("delivery_time_minutes", String(matchedTime));
    }

    async function handleCepInput(value: string) {
        console.log("handlingcep")
        const cleanCep = value.replace(/\D/g, "");
        setField("cep", cleanCep);

        if (cleanCep.length !== 8) return;

        if (cepDebounceTimer) clearTimeout(cepDebounceTimer);
        const timer = window.setTimeout(async () => {
            setLoadingCepLookup(true);
            try {
                const res = await fetch(`https://brasilapi.com.br/api/cep/v1/${cleanCep}`);
                if (!res.ok) { setCepLocationError(true); return }

                const json = await res.json();
                if (json.street) setField("rua", json.street);
                if (json.neighborhood) setField("bairro", json.neighborhood);
                if (json.city) setField("cidade", json.city);
                if (json.state) setField("estado", json.state);

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

                const addr = await reverseGeocode(lat, lon);
                if (addr) {
                    if (addr.postcode) setField("cep", String(addr.postcode).replace("-", ""));
                    if (addr.road) setField("rua", addr.road);
                    if (addr.house_number) setField("numero", String(addr.house_number));
                    if (addr.suburb) setField("bairro", addr.suburb);
                    else if (addr.neighbourhood) setField("bairro", addr.neighbourhood);
                    if (addr.city) setField("cidade", addr.city);
                    if (addr.state) setField("estado", addr.state);
                }

                const restLat = Number(restaurant.latitude);
                const restLon = Number(restaurant.longitude);

                if (!Number.isNaN(restLat) && !Number.isNaN(restLon)) {
                    const distKm = haversineKm(restLat, restLon, lat, lon);
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
    // store last move (not necessary now but keepable)
    const lastMoveDistance = useRef<number>(0);

    useEffect(() => {
        requestAnimationFrame(() => setOpenModal(true));
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

    // ---- TOUCH HANDLERS: make modal follow finger while dragging ----
    const handleTouchStart = (e: React.TouchEvent) => {
        // only start when scrolled to top so we don't conflict with scrolling inside modal
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
            // don't drag upward
            setTranslateY(0);
            return;
        }

        // Prevent native overscroll while dragging the sheet
        e.preventDefault();

        // dampen drag after 200px for resistance feel
        setTranslateY(diff);

    };

    const handleTouchEnd = () => {
        const final = lastMoveDistance.current;
        touchStartY.current = null;
        setIsDragging(false);

        // if dragged past threshold -> close
        if (final >= DRAG_CLOSE_THRESHOLD) {
            // animate modal offscreen by setting translateY to window height
            const offscreen = typeof window !== "undefined" ? window.innerHeight : 1000;
            setTranslateY(offscreen);

            // also hide openModal/backdrop by calling closeWithAnimation after the transform
            setTimeout(() => {
                // ensure modal unmount is handled by your existing close
                closeWithAnimation();
                // reset translate after close so when reopened it starts at 0
                setTranslateY(0);
            }, 200); // match transition duration
            lastMoveDistance.current = 0;
            return;
        }

        // snap back
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
        // backdrop now uses openModal for fade; unchanged markup otherwise
        <div className={`fixed inset-0 z-41 flex justify-center items-end`}>
            <DraggableModal
                open={openModal}
                onClose={closeWithAnimation}
                height={0.93}       // same height your modal already used (93vh)
                handle={false}       // keeps the drag bar
                xPadding={false}
            >
                {/* HEADER */}
                <div className="sticky top-[0.1%] z-60 flex items-center bg-white rounded-2xl justify-center pb-3 pt-4 pointer-events-none">
                    <button
                        className="absolute left-5 text-sm pointer-events-auto"
                        onClick={goBack}
                    >
                        <FontAwesomeIcon
                            icon={faChevronDown}
                            className={`duration-200 ${step === "cart" ? "rotate-0" : "rotate-90" }`}
                        />
                    </button>

                    <h1 className="text-[17px] font-semibold ">
                        {step === "cart" ? "SACOLA" : step === "info" ? "ENDEREÇO" : "CHECKOUT"}
                    </h1>

                    {step === "cart" && (
                        <button
                            onClick={clearItems}
                            className="absolute right-5 text-brand  font-semibold text-[12px] pointer-events-auto"
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
                <div className="w-full px-4 overflow-y-auto pt-2 ">
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
                            className="flex items-start justify-between py-4 w-full "
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

            </DraggableModal>
        </div>

    );
}
