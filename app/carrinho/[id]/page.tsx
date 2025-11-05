// app/carrinho/[id]/page.tsx
"use client";

import { useCart } from "@/lib/cartStore";
import { useRouter, useParams } from "next/navigation";

export default function CartPage() {
    const router = useRouter();
    const params = useParams();
    
    
    const slug = Array.isArray(params.id) ? params.id[0] : params.id;

    const { items, remove, setQty, total_cents } = useCart();
    
  
    const formatPrice = (priceInCents: number) => {
        return (priceInCents / 100).toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
        });
    };

    const total = total_cents();

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="mx-auto max-w-lg p-4">
                <header className="my-6">
                    <button
                        onClick={() => router.push(`/cardapio/${slug}`)} // Back to menu
                        className="text-sm text-indigo-600 hover:underline"
                    >
                        &larr; Continuar comprando
                    </button>
                    <h1 className="mt-2 text-center text-3xl font-bold">Seu Pedido</h1>
                </header>

                <main className="space-y-4">
                    {items.length === 0 ? (
                        <p className="text-center text-gray-500">Seu carrinho está vazio.</p>
                    ) : (
                        items.map((item) => (
                            <div key={item.itemId} className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                                <div>
                                    <h2 className="font-semibold">{item.name}</h2>
                                    <p className="text-sm text-gray-700">{formatPrice(item.price_cents * item.qty)}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    {/* Quantity control */}
                                    <div className="flex items-center rounded-md border border-gray-300">
                                        <button
                                            onClick={() => {
                                                if (item.qty > 1) {
                                                    setQty(item.itemId, item.qty - 1);
                                                } else {
                                                    remove(item.itemId); 
                                                }
                                            }}
                                            className="px-3 py-1 text-lg font-medium text-gray-700 hover:bg-gray-100"
                                        >
                                            -
                                        </button>
                                        <span className="px-3 py-1 text-sm font-medium">{item.qty}</span>
                                        <button
                                            onClick={() => setQty(item.itemId, item.qty + 1)}
                                            className="px-3 py-1 text-lg font-medium text-gray-700 hover:bg-gray-100"
                                        >
                                            +
                                        </button>
                                    </div>
                                    {/* Remove Button */}
                                    <button
                                        onClick={() => remove(item.itemId)}
                                        className="text-xs text-red-600 hover:underline"
                                    >
                                        Remover
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </main>

                {items.length > 0 && (
                    <footer className="mt-8 space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
                        <div className="flex justify-between text-lg font-medium">
                            <span>Total</span>
                            <span>{formatPrice(total)}</span>
                        </div>
                        <p className="text-xs text-gray-500">
                            Taxas de entrega e serviço serão calculadas no checkout.
                        </p>
                        <button
                            disabled // Checkout button
                            className="w-full rounded-md bg-black px-6 py-3 text-lg font-medium text-white shadow-md focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 disabled:opacity-50"
                        >
                            Ir para o Checkout
                        </button>
                    </footer>
                )}
            </div>
        </div>
    );
}