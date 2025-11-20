// components/CheckoutSummary.tsx
"use client";

const formatPrice = (priceInCents: number) => {
    return (priceInCents / 100).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
    });
};

interface CheckoutSummaryProps {
    subtotalCents: number;
    deliveryFeeCents: number | null;
}

export default function CheckoutSummary({ subtotalCents, deliveryFeeCents }: CheckoutSummaryProps) {
    const totalCents = (subtotalCents || 0) + (deliveryFeeCents || 0);

    return (
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold mb-4">Resumo do Pedido</h2>
            <div className="space-y-3">
                <div className="flex justify-between text-gray-700">
                    <span>Subtotal</span>
                    <span>{formatPrice(subtotalCents)}</span>
                </div>
                <div className="flex justify-between text-gray-700">
                    <span>Taxa de Entrega</span>
                    <span>
                        {deliveryFeeCents === null ? "---" : formatPrice(deliveryFeeCents)}
                    </span>
                </div>
                <hr className="my-2" />
                <div className="flex justify-between text-lg font-bold text-gray-900">
                    <span>Total</span>
                    <span>
                        {deliveryFeeCents === null ? "---" : formatPrice(totalCents)}
                    </span>
                </div>
            </div>
        </div>
    );
}