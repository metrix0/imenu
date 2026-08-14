"use client";

import { useState } from "react";
import AnalyticsDashboard from "@/components/restaurant-owner/exibicoes/AnalyticsDashboard";
import ConsumerPipelineDashboard from "@/components/restaurant-owner/exibicoes/ConsumerPipelineDashboard";
import DateFilterBar, { getDateRangeForDays } from "@/components/restaurant-owner/exibicoes/DateFilterBar";
import Loader from "@/components/ui/Loader";
import { useCreationStore } from "@/lib/stores/restaurant-owner/creationStore";

export default function AnalyticsPageContent() {
    const { restaurantId } = useCreationStore();
    const initialRange = getDateRangeForDays(7);
    const [startDate, setStartDate] = useState(initialRange.startDate);
    const [endDate, setEndDate] = useState(initialRange.endDate);

    if (!restaurantId) {
        return <div className="flex h-64 items-center justify-center"><Loader /></div>;
    }

    return (
        <div className="mx-auto max-w-6xl space-y-8 px-4 pb-20 pt-8 2xl:max-w-8xl">
            <div>
                <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
                <p className="mt-1 text-sm text-gray-500">Entenda vendas, pedidos e comportamento dos seus clientes.</p>
            </div>
            <DateFilterBar startDate={startDate} endDate={endDate} onStartDateChange={setStartDate} onEndDateChange={setEndDate} showPresets />
            <AnalyticsDashboard restaurantId={restaurantId} startDate={startDate} endDate={endDate} />
            <section>
                <div className="mb-4">
                    <h2 className="text-xl font-bold text-gray-900">Consumidor</h2>
                    <p className="mt-1 text-sm text-gray-500">Funil do cardápio até a criação do pedido no período selecionado.</p>
                </div>
                <ConsumerPipelineDashboard restaurantId={restaurantId} startDate={startDate} endDate={endDate} />
            </section>
        </div>
    );
}
