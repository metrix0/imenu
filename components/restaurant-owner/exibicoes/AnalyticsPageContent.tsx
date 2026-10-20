"use client";

import { useState } from "react";
import AnalyticsDashboard from "@/components/restaurant-owner/exibicoes/AnalyticsDashboard";
import Button from "@/components/ui/Button";
import ConsumerPipelineDashboard from "@/components/restaurant-owner/exibicoes/ConsumerPipelineDashboard";
import DateFilterBar, { getCurrentMonthRange, getDateRangeForDays, type DateRange } from "@/components/restaurant-owner/exibicoes/DateFilterBar";
import { formatDate } from "@/lib/utils/dateRange";
import Loader from "@/components/ui/Loader";
import { useCreationStore } from "@/lib/stores/restaurant-owner/creationStore";

export default function AnalyticsPageContent() {
    const { restaurantId } = useCreationStore();
    const initialRange = getDateRangeForDays(7);
    const [startDate, setStartDate] = useState(initialRange.startDate);
    const [endDate, setEndDate] = useState(initialRange.endDate);

    const applyRange = (range: DateRange) => {
        setStartDate(range.startDate);
        setEndDate(range.endDate);
    };
    const applyYesterday = () => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const date = formatDate(yesterday);
        applyRange({ startDate: date, endDate: date });
    };

    if (!restaurantId) {
        return <div className="flex h-64 items-center justify-center"><Loader /></div>;
    }

    return (
        <div className="mx-auto max-w-7xl space-y-6 pb-20">
            <div className="panel-page-heading">
                <h1>Analytics</h1>
                <p className="mt-1 text-sm text-gray-500">Entenda vendas, pedidos e comportamento dos seus clientes.</p>
            </div>
            <div className="ml-auto flex max-w-full flex-wrap items-end gap-3">
                <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="secondary" className="h-11" onClick={() => applyRange(getDateRangeForDays(1))}>Hoje</Button>
                    <Button type="button" variant="secondary" className="h-11" onClick={applyYesterday}>Ontem</Button>
                    <Button type="button" variant="secondary" className="h-11" onClick={() => applyRange(getCurrentMonthRange())}>Mês atual</Button>
                </div>
                <DateFilterBar startDate={startDate} endDate={endDate} onStartDateChange={setStartDate} onEndDateChange={setEndDate} showPresets />
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
