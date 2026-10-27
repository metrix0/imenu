"use client";

import { useEffect, useState } from "react";

import { supabase } from "@/lib/database/supabaseClient";
import { useCreationStore } from "@/lib/stores/restaurant-owner/creationStore";
import PayoutsDashboard from "@/components/restaurant-owner/repasses/PayoutsDashboard";
import PanelFeatureCallout from "@/components/ui/PanelFeatureCallout";
import DateFilterBar, {
    type DateFilterPreset,
    getCurrentMonthRange,
    getDateRangeForDays,
    getPreviousMonthRange,
} from "@/components/restaurant-owner/exibicoes/DateFilterBar";
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

            <PanelFeatureCallout feature="analytics" />
        </div>
    );
}
