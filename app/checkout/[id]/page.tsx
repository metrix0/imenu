// app/checkout/[id]/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useCart } from "@/lib/cartStore";
import CheckoutSummary from "@/components/CheckoutSummary";
import { icons } from "@/lib/fontawesome";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

export default function CheckoutPage() {
    const params = useParams();
    const router = useRouter(); // router para "Levar Maquininha"
    const restaurantId = params.id as string;
    
    // 1. Dados do Carrinho
    const { items, total_cents, clearCart } = useCart();
    const subtotal = total_cents();

    // 2. State do Formulário
    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const [cep, setCep] = useState("");
    const [street, setStreet] = useState("");
    const [number, setNumber] = useState("");
    const [neighborhood, setNeighborhood] = useState("");
    const [complement, setComplement] = useState("");
    const [paymentMethod, setPaymentMethod] = useState<"machine" | "online">("machine");
    
    // 3. State da Lógica
    const [deliveryFee, setDeliveryFee] = useState<number | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoadingFee, setIsLoadingFee] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // 4. Lógica de Endereço (CEP) (Sem mudanças)
    const handleCepBlur = async () => {
        const cleanCep = cep.replace(/\D/g, "");
        if (cleanCep.length !== 8) {
            setError("CEP inválido.");
            return;
        }
        setError(null);
        setIsLoadingFee(true);

        try {
            const cepResponse = await fetch(`https://brasilapi.com.br/api/cep/v1/${cleanCep}`);
            if (cepResponse.ok) {
                const cepData = await cepResponse.json();
                setStreet(cepData.street || "");
                setNeighborhood(cepData.neighborhood || "");
            }

            const feeResponse = await fetch("/api/checkout/calculate-fee", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    restaurantId: restaurantId,
                    cep: cleanCep,
                    subtotalCents: subtotal
                }),
            });

            if (!feeResponse.ok) {
                const errorData = await feeResponse.json();
                throw new Error(errorData.error || "Não entregamos neste CEP");
            }
            const feeData = await feeResponse.json();
            setDeliveryFee(feeData.delivery_fee_cents);

        } catch (err) {
            setError((err as Error).message);
            setDeliveryFee(null);
        } finally {
            setIsLoadingFee(false);
        }
    };

    // --- 5. LÓGICA DE SUBMISSÃO (ATUALIZADA) ---
    const handleSubmitOrder = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        
        if (deliveryFee === null || !cep) {
            setError("Por favor, calcule a taxa de entrega com um CEP válido.");
            return;
        }
        if (!name || !phone || !street || !number) {
            setError("Por favor, preencha todos os campos obrigatórios.");
            return;
        }

        setIsSubmitting(true);

        try {
            const fullAddress = `${street}, ${number}, ${neighborhood}, ${cep} - ${complement}`;

            // A API /api/orders agora lida com os dois casos
            const response = await fetch("/api/orders", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    restaurantId,
                    items,
                    customer_name: name,
                    customer_phone: phone,
                    customer_address: fullAddress,
                    delivery_fee_cents: deliveryFee,
                    paymentMethod: paymentMethod, // Envia 'machine' ou 'online'
                }),
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || "Falha ao criar o pedido.");
            }

            const data = await response.json();
            const newOrderId = data.order_id;

            // Limpa o carrinho
            clearCart();

            // --- Decisão de Redirecionamento ---
            if (data.payment_type === "machine") {
                // Caso 1: Levar Maquininha
                // A API criou o pedido, redirecionamos para a página de status
                router.push(`/pedido/${newOrderId}`);
            } else if (data.payment_type === "online" && data.init_point) {
                // Caso 2: Pagamento Online
                // A API criou o pedido E um link de pagamento (init_point)
                // Redirecionamos o usuário para o Mercado Pago
                window.location.href = data.init_point;
            } else {
                throw new Error("Resposta da API inválida.");
            }

        } catch (err) {
            setError((err as Error).message);
            setIsSubmitting(false); // Só para se der erro
        }
        // (Não definimos 'isSubmitting(false)' em caso de sucesso, pois estamos redirecionando)
    };

    // (O JSX restante é idêntico ao da etapa anterior)
    if (items.length === 0) {
        return <div className="text-center p-8">Seu carrinho está vazio.</div>;
    }

    return (
        <div className="max-w-4xl mx-auto p-4 md:p-8">
            <h1 className="text-3xl font-bold mb-8">Finalizar Pedido</h1>
            <form onSubmit={handleSubmitOrder} className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* Coluna da Esquerda: Formulários */}
                <div className="space-y-6">
                    {/* Dados Pessoais */}
                    <div className="p-6 bg-white border border-gray-200 rounded-lg shadow-sm">
                        <h2 className="text-xl font-semibold mb-4">Seus Dados</h2>
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="name" className="block text-sm font-medium text-gray-700">Nome*</label>
                                <input type="text" id="name" value={name} onChange={e => setName(e.target.value)}
                                 className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" required />
                            </div>
                            <div>
                                <label htmlFor="phone" className="block text-sm font-medium text-gray-700">Telefone (WhatsApp)*</label>
                                <input type="tel" id="phone" value={phone} onChange={e => setPhone(e.target.value)}
                                 className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" required />
                            </div>
                        </div>
                    </div>

                    {/* Endereço */}
                    <div className="p-6 bg-white border border-gray-200 rounded-lg shadow-sm">
                        <h2 className="text-xl font-semibold mb-4">Endereço de Entrega</h2>
                        <div className="grid grid-cols-3 gap-4">
                            <div className="col-span-3 sm:col-span-2">
                                <label htmlFor="cep" className="block text-sm font-medium text-gray-700">CEP*</label>
                                <input type="text" id="cep" value={cep} onChange={e => setCep(e.target.value)}
                                 onBlur={handleCepBlur}
                                 className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" required />
                            </div>
                            <div className="col-span-3 sm:col-span-1">
                                <label className="block text-sm">&nbsp;</label>
                                <button type="button" onClick={handleCepBlur} disabled={isLoadingFee}
                                 className="mt-1 w-full text-sm py-2 px-4 rounded-md border border-gray-300 disabled:opacity-50">
                                    {isLoadingFee ? "Buscando..." : "Buscar Taxa"}
                                </button>
                            </div>
                            <div className="col-span-3 sm:col-span-2">
                                <label htmlFor="street" className="block text-sm font-medium text-gray-700">Rua*</label>
                                <input type="text" id="street" value={street} onChange={e => setStreet(e.target.value)}
                                 className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" required />
                            </div>
                            <div className="col-span-3 sm:col-span-1">
                                <label htmlFor="number" className="block text-sm font-medium text-gray-700">Número*</label>
                                <input type="text" id="number" value={number} onChange={e => setNumber(e.target.value)}
                                 className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" required />
                            </div>
                             <div className="col-span-3 sm:col-span-2">
                                <label htmlFor="neighborhood" className="block text-sm font-medium text-gray-700">Bairro</label>
                                <input type="text" id="neighborhood" value={neighborhood} onChange={e => setNeighborhood(e.target.value)}
                                 className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
                            </div>
                            <div className="col-span-3 sm:col-span-1">
                                <label htmlFor="complement" className="block text-sm font-medium text-gray-700">Complemento</label>
                                <input type="text" id="complement" value={complement} onChange={e => setComplement(e.target.value)}
                                 className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
                            </div>
                        </div>
                    </div>

                    {/* Pagamento */}
                    <div className="p-6 bg-white border border-gray-200 rounded-lg shadow-sm">
                        <h2 className="text-xl font-semibold mb-4">Pagamento</h2>
                        <div className="space-y-3">
                            <label className="flex items-center p-4 border rounded-md has-[:checked]:bg-indigo-50 has-[:checked]:border-indigo-500">
                                <input type="radio" name="paymentMethod" value="machine" 
                                 checked={paymentMethod === "machine"} onChange={e => setPaymentMethod(e.target.value as "machine")}
                                 className="h-4 w-4 text-indigo-600 border-gray-300" />
                                <span className="ml-3 block text-sm font-medium text-gray-700">Levar Maquininha</span>
                            </label>
                            <label className="flex items-center p-4 border rounded-md has-[:checked]:bg-indigo-50 has-[:checked]:border-indigo-500">
                                <input type="radio" name="paymentMethod" value="online" 
                                 checked={paymentMethod === "online"} onChange={e => setPaymentMethod(e.target.value as "online")}
                                 className="h-4 w-4 text-indigo-600 border-gray-300" />
                                <span className="ml-3 block text-sm font-medium text-gray-700">Pagar Online (Cartão/PIX)</span>
                            </label>
                        </div>
                    </div>
                </div>

                {/* Coluna da Direita: Resumo e Envio */}
                <div className="space-y-6">
                    <CheckoutSummary subtotalCents={subtotal} deliveryFeeCents={deliveryFee} />
                    {error && (
                        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
                            <FontAwesomeIcon icon={icons.faTimes} className="mr-2" />
                            {error}
                        </div>
                    )}
                    <button type="submit"
                        disabled={isLoadingFee || deliveryFee === null || isSubmitting}
                        className="w-full bg-green-600 text-white py-3 px-6 rounded-lg text-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? "Finalizando..." : (paymentMethod === 'machine' ? "Finalizar Pedido" : "Ir para Pagamento")}
                    </button>
                </div>
            </form>
        </div>
    );
}