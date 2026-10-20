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
    const [selectedShortcut, setSelectedShortcut] = useState<"today" | "yesterday" | "month" | null>(null);

    const applyRange = (range: DateRange, shortcut: "today" | "yesterday" | "month") => {
        setStartDate(range.startDate);
        setEndDate(range.endDate);
        setSelectedShortcut(shortcut);
    };
    const applyYesterday = () => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const date = formatDate(yesterday);
        applyRange({ startDate: date, endDate: date }, "yesterday");
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
            <div className="flex flex-wrap items-center justify-end gap-3">
                <div className="flex flex-wrap justify-end gap-2">
                    <Button type="button" variant={selectedShortcut === "today" ? "primary" : "secondary"} aria-pressed={selectedShortcut === "today"} className="h-11" onClick={() => applyRange(getDateRangeForDays(1), "today")}>Hoje</Button>
                    <Button type="button" variant={selectedShortcut === "yesterday" ? "primary" : "secondary"} aria-pressed={selectedShortcut === "yesterday"} className="h-11" onClick={applyYesterday}>Ontem</Button>
                    <Button type="button" variant={selectedShortcut === "month" ? "primary" : "secondary"} aria-pressed={selectedShortcut === "month"} className="h-11" onClick={() => applyRange(getCurrentMonthRange(), "month")}>Mês atual</Button>
                </div>
                <div className="w-full sm:w-[320px] [&_[data-ui=field-label]]:sr-only">
                    <DateFilterBar startDate={startDate} endDate={endDate} onStartDateChange={date => { setStartDate(date); setSelectedShortcut(null); }} onEndDateChange={date => { setEndDate(date); setSelectedShortcut(null); }} showPresets />
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
