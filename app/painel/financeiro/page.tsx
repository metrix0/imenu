"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import SalesDashboard from "@/components/restaurante/exibicoes/SalesDashboard";
import PayoutsDashboard from "@/components/restaurante/exibicoes/PayoutsDashboard";
import DateFilterBar from "@/components/restaurante/exibicoes/DateFilterBar"; 
import Loader from "@/components/ui/Loader";

const getISODate = (date: Date) => date.toISOString().split("T")[0];

export default function FinanceiroPage() {
    const [restaurantId, setRestaurantId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // ESTADO GLOBAL DE DATAS
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        return getISODate(d);
    });
    const [endDate, setEndDate] = useState(() => getISODate(new Date()));

    useEffect(() => {
        const loadRestaurant = async () => {
            setIsLoading(true);
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) { setIsLoading(false); return; }

            const { data: restaurant } = await supabase
                .from("restaurants")
                .select("id")
                .eq("user_id", session.user.id)
                .single();

            if (restaurant) setRestaurantId(restaurant.id);
            setIsLoading(false);
        };
        loadRestaurant();
    }, []);

    if (isLoading) return <div className="flex justify-center items-center h-64"><Loader /></div>;
    if (!restaurantId) return <div className="p-8 text-center text-red-500">Restaurante não encontrado.</div>;

    return (
        <div className="space-y-8 max-w-6xl mx-auto">
            <h1 className="text-3xl font-bold text-gray-900">Dashboard Financeiro</h1>
            
            {/* Barra de Filtro controla o estado da página */}
            <DateFilterBar 
                startDate={startDate} 
                endDate={endDate} 
                onStartDateChange={setStartDate} 
                onEndDateChange={setEndDate} 
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


        </div>
    );
}