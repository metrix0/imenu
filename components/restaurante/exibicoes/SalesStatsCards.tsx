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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
                <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Total de Vendas</h4>
                <p className="mt-2 text-3xl font-bold text-brand">
                    {formatPrice(total_sales_cents)}
                </p>
            </Card>
            <Card>
                <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wide">N° de Pedidos</h4>
                <p className="mt-2 text-3xl font-bold text-gray-900">
                    {total_orders}
                </p>
            </Card>
        </div>
    );
}