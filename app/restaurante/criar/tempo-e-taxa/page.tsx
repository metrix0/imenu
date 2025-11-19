// app/restaurante/criar/tempo-e-taxa/page.tsx
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

import CreationStepper from "@/components/restaurante/configuracoes/CreationStepper";
import DeliveryRules from "@/components/restaurante/configuracoes/TempoeTaxa";

export default function TempoETaxaPage() {
    const [restaurantId, setRestaurantId] = useState<string | null>(null);

    // KEEPING THE WORKING LOGIC EXACTLY AS IT WAS
    useEffect(() => {
        const load = async () => {
            console.log("➡️ load() starting…");

            // Load session
            const {
                data: { session },
                error: sessionError,
            } = await supabase.auth.getSession();

            console.log("📌 session =", session);
            console.log("📌 sessionError =", sessionError);

            if (!session?.user) {
                console.log("❌ No logged user");
                return;
            }

            const user = session.user;

            // Get restaurant for this user
            const { data: restaurant, error: restError } = await supabase
                .from("restaurants")
                .select("id, user_id, delivery_fee_json")
                .eq("user_id", user.id)
                .single();

            console.log("🏪 restaurant =", restaurant);
            console.log("🔴 restError =", restError);

            if (!restaurant) {
                console.log("❌ User has no restaurant yet");
                return;
            }

            setRestaurantId(restaurant.id);

            console.log("✅ restaurantId =", restaurant.id);
        };

        load();
    }, []);

    // DO NOT RETURN NULL → this was giving you a blank screen
    if (!restaurantId) {
        return <div>Carregando restaurante...</div>;
    }

    return (
        <div className="max-w-3xl mx-auto py-10 px-6">
            <CreationStepper currentStep={2} />

            {/* ✔ YOU COMMANDED THIS: isNew ALWAYS true */}
            <DeliveryRules
                restaurantId={restaurantId}
                isNew={true}
            />
        </div>
    );
}
