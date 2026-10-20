"use client";

import { useState } from "react";
import AnalyticsDashboard from "@/components/restaurant-owner/exibicoes/AnalyticsDashboard";
import ConsumerPipelineDashboard from "@/components/restaurant-owner/exibicoes/ConsumerPipelineDashboard";
import DateFilterBar, { getCurrentMonthRange, getDateRangeForDays, type DateFilterPreset } from "@/components/restaurant-owner/exibicoes/DateFilterBar";
import Loader from "@/components/ui/Loader";
import { useCreationStore } from "@/lib/stores/restaurant-owner/creationStore";

const ANALYTICS_DATE_PRESETS: DateFilterPreset[] = [
    { label: "Hoje", getRange: () => getDateRangeForDays(1) },
    { label: "Ontem", getRange: () => {
        const yesterday = getDateRangeForDays(2).startDate;
        return { startDate: yesterday, endDate: yesterday };
    } },
    { label: "Mês atual", getRange: getCurrentMonthRange },
    { label: "30 dias", getRange: () => getDateRangeForDays(30) },
];

export default function AnalyticsPageContent() {
    const { restaurantId } = useCreationStore();
    const initialRange = getDateRangeForDays(7);
    const [startDate, setStartDate] = useState(initialRange.startDate);
    const [endDate, setEndDate] = useState(initialRange.endDate);
    if (!restaurantId) {
        return <div className="flex h-64 items-center justify-center"><Loader /></div>;
    }

    return (
        <div className="mx-auto max-w-7xl space-y-6 pb-20">
            <div className="flex flex-col gap-6 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between lg:gap-4">
                <div className="panel-page-heading lg:mb-0!">
                    <h1>Analytics</h1>
                    <p className="mt-1 text-sm text-gray-500">Entenda vendas, pedidos e comportamento dos seus clientes.</p>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-3">
                    <div className="w-full sm:w-[320px] [&_[data-ui=field-label]]:sr-only">
                        <DateFilterBar startDate={startDate} endDate={endDate} onStartDateChange={setStartDate} onEndDateChange={setEndDate} showPresets presets={ANALYTICS_DATE_PRESETS} />
                    </div>
                </div>
            </div>
            <AnalyticsDashboard restaurantId={restaurantId} startDate={startDate} endDate={endDate} />
            <section className="pt-2">
                <div className="mb-4">
                    <h2>Consumidor</h2>
                    <p className="mt-1 text-sm text-gray-500">Funil do cardápio até a criação do pedido no período selecionado.</p>
                </div>
                <ConsumerPipelineDashboard restaurantId={restaurantId} startDate={startDate} endDate={endDate} />
            </section>
        </div>
    );
}
