"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Loader from "@/components/ui/Loader";
import StoreProfileManager from "@/components/restaurante/loja/StoreProfileManager";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

export default function LojaPage() {
    const [isLoading, setIsLoading] = useState(true);
    const [restaurant, setRestaurant] = useState<any>(null);

    useEffect(() => {
        const load = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const { data } = await supabase
                .from("restaurants")
                .select("id, name, description, logo_url, banner_url")
                .eq("user_id", session.user.id)
                .single();

            if (data) setRestaurant(data);
            setIsLoading(false);
        };
        load();
    }, []);

    if (isLoading) return <div className="flex justify-center p-10"><Loader /></div>;
    if (!restaurant) return <div className="p-10 text-center text-red-500">Restaurante não encontrado.</div>;

    return(
        <div>
            
        <StoreProfileManager restaurant={restaurant} />;

        </div>
    ); 
}