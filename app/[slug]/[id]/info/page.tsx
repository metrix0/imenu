// app/[slug]/[id]/info/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import CheckoutSummary from "@/components/CheckoutSummary";
import { icons } from "@/lib/fontawesome";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { createClient } from "@supabase/supabase-js";
import posthog from "posthog-js";

// (Helper do client-side)
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Tipo para os dados da BrasilAPI
type CepData = {
    cep: string;
    state: string;
    city: string;
    neighborhood: string;
    street: string;
};

export default function CheckoutInfoPage() {
    const params = useParams();
    const router = useRouter();

    const slug = params.slug as string;
    const orderId = params.id as string;

    useEffect(() => {
        if (!slug || !orderId) return;

        posthog.capture("viewed_order_info_page", {
            restaurant_slug: slug,
            order_id: orderId,
        });
    }, [slug, orderId]);

    // (States do Formulário)
    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const [deliveryType, setDeliveryType] = useState<"delivery" | "pickup">("delivery");
    const [cep, setCep] = useState("");
    const [street, setStreet] = useState("");
    const [number, setNumber] = useState("");
    const [neighborhood, setNeighborhood] = useState("");
    const [cidade, setCidade] = useState(""); // <-- Adicionado
    const [estado, setEstado] = useState(""); // <-- Adicionado
    const [complemento, setComplemento] = useState("");

    // (States da Lógica)
    const [subtotal, setSubtotal] = useState<number | null>(null);
    const [restaurantId, setRestaurantId] = useState<string | null>(null);
    const [deliveryFee, setDeliveryFee] = useState<number | null>(null);
    const [customerLat, setCustomerLat] = useState<number | null>(null);
    const [customerLon, setCustomerLon] = useState<number | null>(null);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoadingFee, setIsLoadingFee] = useState(false); // (Usado para o CEP e para a Localização)
    const [error, setError] = useState<string | null>(null);

    // (Busca o Subtotal - sem mudança)
    useEffect(() => {
        if (!orderId) return;
        async function fetchOrderSubtotal() {
            try {
                const response = await fetch(`/api/orders/${orderId}`);
                if (!response.ok) throw new Error("Pedido não encontrado.");
                const orderData = await response.json();
                if (orderData.status !== 'pending_payment') {
                    throw new Error("Este pedido não está mais na sacola.");
                }
                setSubtotal(orderData.subtotal_cents || 0);
                setRestaurantId(orderData.restaurant_id || null);
            } catch (err) {
                setError((err as Error).message);
                setTimeout(() => router.push(`/${slug}`), 2000);
            }
        }
        fetchOrderSubtotal();
    }, [orderId, slug, router]);

    // --- 1. LÓGICA DE AUTOCOMPLETAR ENDEREÇO (via CEP) ---
    const handleCepBlur = async () => {
        const cleanCep = cep.replace(/\D/g, "");
        if (cleanCep.length !== 8) return;

        setIsLoadingFee(true); // (Usamos o mesmo loading)
        setError(null);

        try {
            const response = await fetch(`https://brasilapi.com.br/api/cep/v1/${cleanCep}`);
            if (!response.ok) {
                throw new Error("CEP não encontrado.");
            }
            const data: CepData = await response.json();

            // Preenche o formulário
            setEstado(data.state || "");
            setCidade(data.city || "");
            setNeighborhood(data.neighborhood || "");
            setStreet(data.street || "");

        } catch (err) {
            setError((err as Error).message);
        } finally {
            setIsLoadingFee(false);
        }
    };

    // --- 2. LÓGICA DE CALCULAR TAXA (via GPS) ---
    const handleGetLocationAndFee = () => {
        if (!navigator.geolocation) {
            setError("Geolocalização não é suportada (Tente em um celular).");
            return;
        }
        if (!restaurantId || subtotal === null) {
            setError("A página ainda está carregando. Tente novamente em 1 segundo.");
            return;
        }

        setIsLoadingFee(true);
        setError(null);

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                setCustomerLat(latitude);
                setCustomerLon(longitude);

                try {
                    // Chama a API 'calculate-fee' com as coordenadas
                    const feeResponse = await fetch("/api/checkout/calculate-fee", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            restaurantId: restaurantId,
                            latitude: latitude,
                            longitude: longitude,
                        }),
                    });

                    if (!feeResponse.ok) {
                        const errorData = await feeResponse.json();
                        throw new Error(errorData.error || "Não entregamos nesta localização.");
                    }

                    const feeData = await feeResponse.json();
                    setDeliveryFee(feeData.delivery_fee_cents);

                } catch (err) {
                    setError((err as Error).message);
                    setDeliveryFee(null);
                } finally {
                    setIsLoadingFee(false);
                }
            },
            (error) => {
                console.error("Erro de Geolocalização:", error);
                setError("Não foi possível obter sua localização. Verifique as permissões do navegador.");
                setIsLoadingFee(false);
            }
        );
    };

    // (Efeito para Tipo de Entrega - Atualizado)
    useEffect(() => {
        if (!orderId) return;
        async function fetchOrderSubtotal() {
            try {
                // Chama a API GET (que agora retorna subtotal e restaurant_id)
                const response = await fetch(`/api/orders/${orderId}`);
                if (!response.ok) throw new Error("Pedido não encontrado.");

                const orderData = await response.json();

                // CORREÇÃO: Verifica o status 'pending_payment'
                if (orderData.status !== 'pending_payment') {
                    throw new Error("Este pedido não está mais na sacola.");
                }

                setSubtotal(orderData.subtotal_cents || 0);
                setRestaurantId(orderData.restaurant_id || null);
            } catch (err) {
                setError((err as Error).message);
                setTimeout(() => router.push(`/${slug}`), 2000);
            }
        }
        fetchOrderSubtotal();
    }, [orderId, slug, router]);


    // (handleSaveInfoAndContinue - sem mudança)
    const handleSaveInfoAndContinue = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        const isDelivery = deliveryType === 'delivery';

        // (Validações - sem mudança)
        if (isDelivery && (deliveryFee === null)) {
            setError("Por favor, use o botão 'Usar Localização' para calcular a taxa.");
            return;
        }
        if (!name || !phone) {
            setError("Por favor, preencha Nome e Telefone.");
            return;
        }
        if (isDelivery && (!cep || !street || !number || !neighborhood || !cidade || !estado)) {
            setError("Por favor, preencha o endereço de entrega completo.");
            return;
        }

        setIsSubmitting(true);

        try {
            const fullAddress = isDelivery
                ? `${street}, ${number}, ${neighborhood}, ${cidade} - ${estado}, ${cep}${complemento ? `, ${complemento}` : ''}`
                : null;

            // Calcula o total ANTES de enviar
            const finalDeliveryFee = deliveryFee || 0;
            const finalTotal = (subtotal || 0) + finalDeliveryFee;

            // CORREÇÃO: Chama a API PATCH correta
            const response = await fetch(`/api/orders/${orderId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    customer_name: name,
                    customer_phone: phone,
                    customer_address: fullAddress,
                    delivery_cents: finalDeliveryFee,
                    total_cents: finalTotal,
                    is_delivery: isDelivery,
                }),
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || "Falha ao salvar informações.");
            }

            router.push(`/${slug}/${orderId}/checkout`);

        } catch (error) {
            setError((error as Error).message);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Variável para checar se o formulário de endereço está pronto
    const isAddressFormComplete = cep && street && number && neighborhood && cidade && estado;

    // --- JSX ---
    return (
        <div className="max-w-4xl mx-auto p-4 md:p-8">
            <h1 className="text-3xl font-bold mb-8">Informações de Entrega</h1>
            <form onSubmit={handleSaveInfoAndContinue} className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                {/* Coluna da Esquerda: Formulários */}
                <div className="space-y-6">
                    {/* Dados Pessoais */}
                    <div className="p-6 bg-white border border-gray-200 rounded-lg shadow-sm">
                        <h2 className="text-xl font-semibold mb-4">Seus Dados</h2>
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="name" className="block text-sm font-medium text-gray-700">Nome*</label>
                                <input type="text" id="name" value={name} onChange={e => setName(e.target.value)} required
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
                            </div>
                            <div>
                                <label htmlFor="phone" className="block text-sm font-medium text-gray-700">Telefone (WhatsApp)*</label>
                                <input type="tel" id="phone" value={phone} onChange={e => setPhone(e.target.value)} required
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
                            </div>
                        </div>
                    </div>

                    {/* Tipo de Entrega */}
                    <div className="p-6 bg-white border border-gray-200 rounded-lg shadow-sm">
                        <h2 className="text-xl font-semibold mb-4">Como deseja receber?</h2>
                        <div className="space-y-3">
                            <label className="flex items-center p-4 border rounded-md has-[:checked]:bg-indigo-50 has-[:checked]:border-indigo-500">
                                <input type="radio" name="deliveryType" value="delivery"
                                    checked={deliveryType === "delivery"} onChange={e => setDeliveryType(e.target.value as "delivery")}
                                    className="h-4 w-4 text-indigo-600 border-gray-300" />
                                <span className="ml-3 block text-sm font-medium text-gray-700">Entrega (Delivery)</span>
                            </label>
                            <label className="flex items-center p-4 border rounded-md has-[:checked]:bg-indigo-50 has-[:checked]:border-indigo-500">
                                <input type="radio" name="deliveryType" value="pickup"
                                    checked={deliveryType === "pickup"} onChange={e => setDeliveryType(e.target.value as "pickup")}
                                    className="h-4 w-4 text-indigo-600 border-gray-300" />
                                <span className="ml-3 block text-sm font-medium text-gray-700">Retirar na loja (Sem taxa)</span>
                            </label>
                        </div>
                    </div>

                    {/* Endereço (SÓ APARECE SE FOR 'delivery') */}
                    {deliveryType === 'delivery' && (
                        <div className="p-6 bg-white border border-gray-200 rounded-lg shadow-sm">
                            <h2 className="text-xl font-semibold mb-4">Endereço de Entrega</h2>

                            {/* --- FORMULÁRIO DE ENDEREÇO --- */}
                            <div className="space-y-4">
                                <div>
                                    <label htmlFor="cep" className="block text-sm font-medium text-gray-700">CEP*</label>
                                    <input type="text" id="cep" value={cep}
                                        onChange={(e) => setCep(e.target.value)}
                                        onBlur={handleCepBlur} // <-- REQUISITO 3: Autocompleta
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" required />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div className="sm:col-span-2">
                                        <label htmlFor="cidade" className="block text-sm font-medium text-gray-700">Cidade*</label>
                                        <input id="cidade" type="text" value={cidade} onChange={e => setCidade(e.target.value)} required
                                            disabled={isLoadingFee} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm disabled:bg-gray-100" />
                                    </div>
                                    <div>
                                        <label htmlFor="estado" className="block text-sm font-medium text-gray-700">Estado*</label>
                                        <input id="estado" type="text" value={estado} onChange={e => setEstado(e.target.value)} required
                                            disabled={isLoadingFee} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm disabled:bg-gray-100" />
                                    </div>
                                </div>

                                <div>
                                    <label htmlFor="rua" className="block text-sm font-medium text-gray-700">Rua*</label>
                                    <input id="rua" type="text" value={street} onChange={e => setStreet(e.target.value)} required
                                        disabled={isLoadingFee} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm disabled:bg-gray-100" />
                                </div>

                                <div>
                                    <label htmlFor="bairro" className="block text-sm font-medium text-gray-700">Bairro*</label>
                                    <input id="bairro" type="text" value={neighborhood} onChange={e => setNeighborhood(e.target.value)} required
                                        disabled={isLoadingFee} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm disabled:bg-gray-100" />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div className="sm:col-span-1">
                                        <label htmlFor="numero" className="block text-sm font-medium text-gray-700">Número*</label>
                                        <input id="numero" type="text" value={number} onChange={e => setNumber(e.target.value)} required
                                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
                                    </div>
                                    <div className="sm:col-span-2">
                                        <label htmlFor="complemento" className="block text-sm font-medium text-gray-700">Complemento</label>
                                        <input id="complemento" type="text" value={complemento} onChange={e => setComplemento(e.target.value)}
                                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
                                    </div>
                                </div>

                                {/* --- BOTÃO DE CÁLCULO DE TAXA (MOVIDO) --- */}
                                <button
                                    type="button"
                                    onClick={handleGetLocationAndFee}
                                    // REQUISITO 2: Desabilitado se o formulário não estiver pronto
                                    disabled={!isAddressFormComplete || isLoadingFee || subtotal === null}
                                    className="w-full text-sm py-2 px-4 rounded-md border border-gray-300 disabled:opacity-50 mt-4"
                                >
                                    {isLoadingFee ? "Calculando..." : "Usar Localização para Calcular Taxa"}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Coluna da Direita: Resumo e Envio */}
                <div className="space-y-6">
                    <CheckoutSummary subtotalCents={subtotal || 0} deliveryFeeCents={deliveryFee} />
                    {error && (
                        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
                            <FontAwesomeIcon icon={icons.faTimes} className="mr-2" />
                            {error}
                        </div>
                    )}
                    <button
                        type="submit"
                        disabled={isLoadingFee || (deliveryType === 'delivery' && deliveryFee === null) || isSubmitting || subtotal === null}
                        className="w-full bg-black text-white py-3 px-6 rounded-lg text-lg font-medium hover:bg-gray-800 disabled:opacity-50"
                    >
                        {isSubmitting ? "Salvando..." : "Ir para Pagamento"}
                    </button>
                </div>
            </form>
        </div>
    );
}