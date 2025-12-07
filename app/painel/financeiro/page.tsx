"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/database/supabaseClient";
import { useCreationStore } from "@/lib/stores/restaurant-owner/creationStore"; // Store Global
import SalesDashboard from "@/components/restaurant-owner/exibicoes/SalesDashboard";
import PayoutsDashboard from "@/components/restaurant-owner/exibicoes/PayoutsDashboard";
import DateFilterBar from "@/components/restaurant-owner/exibicoes/DateFilterBar"; 
import Loader from "@/components/ui/Loader";

const getISODate = (date: Date) => date.toISOString().split("T")[0];

export default function FinanceiroPage() {
    const { restaurantId, setRestaurantId } = useCreationStore();
    const [isLoading, setIsLoading] = useState(true);

    // Datas Iniciais (Últimos 7 dias)
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        return getISODate(d);
    });
    const [endDate, setEndDate] = useState(() => getISODate(new Date()));

    useEffect(() => {
        const loadRestaurant = async () => {
            if (restaurantId) {
                setIsLoading(false);
                return;
            }

            const { data: { session } } = await supabase.auth.getSession();
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
        loadRestaurant();
    }, [restaurantId, setRestaurantId]);

    if (isLoading) return <div className="flex justify-center items-center h-64"><Loader /></div>;
    
    if (!restaurantId) return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-gray-500">
            <p>Nenhum restaurante encontrado.</p>
        </div>
    );

    return (
        <div className="space-y-8 max-w-6xl mx-auto px-4 pt-8 pb-20">
            <h1 className="text-3xl font-bold text-gray-900">Dashboard Financeiro</h1>
            
            {/* Barra de Filtro */}
            <DateFilterBar 
                startDate={startDate} 
                endDate={endDate} 
                onStartDateChange={setStartDate} 
                onEndDateChange={setEndDate} 
            />
            
            {/* Payouts (Repasses) */}
            <section>
                 <PayoutsDashboard 
                    menuId={restaurantId} 
                    startDate={startDate}
                    endDate={endDate}
                 />
            </section>
            
            {/* Vendas (Gráficos) */}
            <section>
                <SalesDashboard 
                    menuId={restaurantId} 
                    startDate={startDate} 
                    endDate={endDate} 
                />
            </section>
        </div>
    );
}