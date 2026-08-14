"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { supabase } from "@/lib/database/supabaseClient";
import { useCreationStore } from "@/lib/stores/restaurant-owner/creationStore";
import SalesDashboard from "@/components/restaurant-owner/exibicoes/SalesDashboard";
import PayoutsDashboard from "@/components/restaurant-owner/exibicoes/PayoutsDashboard";
import DateFilterBar, {
    type DateFilterPreset,
    getCurrentMonthRange,
    getDateRangeForDays,
    getPreviousMonthRange,
} from "@/components/restaurant-owner/exibicoes/DateFilterBar";
import Card from "@/components/ui/Card";
import Loader from "@/components/ui/Loader";

const FINANCEIRO_PRESETS: DateFilterPreset[] = [
    { label: "7 dias", getRange: () => getDateRangeForDays(7) },
    { label: "Esse mês", getRange: getCurrentMonthRange },
    { label: "Mês anterior", getRange: getPreviousMonthRange },
    { label: "90 dias", getRange: () => getDateRangeForDays(90) },
];

export default function FinanceiroPage() {
    const { restaurantId, setRestaurantId } = useCreationStore();
    const [isLoading, setIsLoading] = useState(true);
    const [startDate, setStartDate] = useState(
        () => getDateRangeForDays(7).startDate
    );
    const [endDate, setEndDate] = useState(
        () => getDateRangeForDays(7).endDate
    );

    useEffect(() => {
        const loadRestaurant = async () => {
            if (restaurantId) {
                setIsLoading(false);
                return;
            }

            const {
                data: { session },
            } = await supabase.auth.getSession();
            if (!session?.user) {
                setIsLoading(false);
                return;
            }

            const { data: restaurant } = await supabase
                .from("restaurants")
                .select("id")
                .eq("user_id", session.user.id)
                .single();

            if (restaurant) {
                setRestaurantId(restaurant.id);
            }
            setIsLoading(false);
        };

        void loadRestaurant();
    }, [restaurantId, setRestaurantId]);

    if (isLoading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <Loader />
            </div>
        );
    }

    if (!restaurantId) {
        return (
            <div className="flex min-h-[50vh] flex-col items-center justify-center text-gray-500">
                <p>Nenhum restaurante encontrado.</p>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-7xl space-y-8 px-4 pb-20 pt-8 2xl:max-w-[90rem]">
            <h1 className="text-3xl font-bold text-gray-900">
                Dashboard Financeiro
            </h1>

            <DateFilterBar
                startDate={startDate}
                endDate={endDate}
                onStartDateChange={setStartDate}
                onEndDateChange={setEndDate}
                showPresets
                presets={FINANCEIRO_PRESETS}
            />

            <section>
                <PayoutsDashboard
                    menuId={restaurantId}
                    startDate={startDate}
                    endDate={endDate}
                />
            </section>

            <section>
                <SalesDashboard
                    menuId={restaurantId}
                    startDate={startDate}
                    endDate={endDate}
                />
            </section>

            <Card className="border border-brand/10 bg-gradient-to-br from-white to-brand/[0.04]">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="max-w-2xl">
                        <h2 className="text-lg font-bold text-gray-900 2xl:text-xl">
                            Quer entender melhor o que está por trás das vendas?
                        </h2>
                        <p className="mt-1 text-sm text-gray-500 2xl:text-base">
                            No Analytics você encontra itens mais pedidos, categorias, combinações de compra, comportamento do consumidor e outros indicadores do período.
                        </p>
                    </div>
                    <Link
                        href="/painel/analytics"
                        className="inline-flex shrink-0 items-center justify-center rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-white transition hover:brightness-95"
                    >
                        Abrir Analytics
                    </Link>
                </div>
            </Card>
        </div>
    );
}
