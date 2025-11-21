"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import PayoutsDashboard from "@/components/restaurante/exibicoes/PayoutsDashboard";
import SalesDashboard from "@/components/restaurante/exibicoes/SalesDashboard";
import Loader from "@/components/ui/Loader"; // Usando seu loader padrão

export default function FinanceiroPage() {
    const [restaurantId, setRestaurantId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadRestaurant = async () => {
            setIsLoading(true);
            const { data: { session } } = await supabase.auth.getSession();

            if (!session?.user) {
                // Redirecionar ou mostrar erro se não tiver user
                setIsLoading(false);
                return;
            }

            // Buscar restaurante do dono
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
    }, []);

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader />
            </div>
        );
    }

    if (!restaurantId) {
        return (
            <div className="p-8 text-center">
                <p className="text-red-500">Restaurante não encontrado.</p>
            </div>
        );
    }

    // Layout ajustado para não colidir com Sidebar e ser responsivo
    return (
        <div className="space-y-8 max-w-6xl mx-auto">
            <div className="mb-8 flex flex-col  gap-1 ">
                <h1 className="text-3xl font-bold text-gray-900">Dashboard Financeiro</h1>
                <p className="text-gray-500 mb-8 mt-1">Veja o desempenho da sua loja durante um período.</p>
            </div>
            {/* Sales Graphs */}
            <section>
                <SalesDashboard menuId={restaurantId} />
            </section>

            {/* Payouts List */}
            <section>
                 <PayoutsDashboard menuId={restaurantId} />
            </section>
        </div>
    );
}