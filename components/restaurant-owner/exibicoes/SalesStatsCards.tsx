"use client";

import Card from "@/components/ui/Card";

interface SalesStatsCardsProps {
    total_sales_cents: number;
    total_orders: number;
}

// Helper local de formatação
const formatPrice = (priceInCents: number) => {
    return (priceInCents / 100).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
    });
};

export default function SalesStatsCards({ total_sales_cents, total_orders }: SalesStatsCardsProps) {
    return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Card>
                <h3 className="!text-sm font-medium text-gray-500">Total de vendas</h3>
                <p className="mt-2 text-3xl font-medium tabular-nums tracking-tight text-gray-900">
                    {formatPrice(total_sales_cents)}
                </p>
            </Card>
            <Card>
                <h3 className="!text-sm font-medium text-gray-500">Número de pedidos</h3>
                <p className="mt-2 text-3xl font-medium tabular-nums tracking-tight text-gray-900">
                    {total_orders.toLocaleString("pt-BR")}
                </p>
            </Card>
        </div>
    );
}
