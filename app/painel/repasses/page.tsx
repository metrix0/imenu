"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { faArrowRight, faChartLine } from "@fortawesome/free-solid-svg-icons";

import { supabase } from "@/lib/database/supabaseClient";
import { useCreationStore } from "@/lib/stores/restaurant-owner/creationStore";
import PayoutsDashboard from "@/components/restaurant-owner/exibicoes/PayoutsDashboard";
import DateFilterBar, {
    type DateFilterPreset,
    getCurrentMonthRange,
    getDateRangeForDays,
    getPreviousMonthRange,
} from "@/components/restaurant-owner/exibicoes/DateFilterBar";
import Card from "@/components/ui/Card";
import Loader from "@/components/ui/Loader";
import { PanelIcon as FontAwesomeIcon } from "@/components/ui/PanelIcon";

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
            <div>
                <h1>Repasses</h1>
                <p className="mt-1 text-sm text-gray-500">
                    Acompanhe os valores a receber e o histórico de repasses da sua loja.
                </p>
            </div>

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

            <Card className="overflow-hidden border-brand/20 bg-brand/5">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-start gap-4">
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white text-xl text-brand shadow-sm">
                            <FontAwesomeIcon icon={faChartLine} />
                        </span>
                        <div className="min-w-0 max-w-2xl">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">
                                Analytics
                            </p>
                            <h2 className="mt-1 text-lg font-bold text-gray-900 2xl:text-xl">
                                Quer entender melhor o que está por trás das vendas?
                            </h2>
                            <p className="mt-1 text-sm leading-6 text-gray-600 2xl:text-base">
                                Descubra os itens mais pedidos, categorias que mais vendem, combinações de compra e outros indicadores do seu cardápio.
                            </p>
                        </div>
                    </div>
                    <Link
                        href="/painel/analytics"
                        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-white transition hover:brightness-95"
                    >
                        Abrir Analytics
                        <FontAwesomeIcon icon={faArrowRight} />
                    </Link>
                </div>
            </Card>
        </div>
    );
}
